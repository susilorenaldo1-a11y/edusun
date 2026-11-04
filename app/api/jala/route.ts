import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { modelCandidates, offlineReply, withPageContext } from "@/lib/jala-server";
import type { ChatMessage } from "@/lib/jala";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2000;
const MAX_TOTAL_CHARS = 12000;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Remembers the model that last answered, so an overloaded one isn't retried first every time. */
let stickyModel: string | null = null;

function allowRequest(ip: string): boolean {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}

function readMessages(payload: unknown): ChatMessage[] | null {
  if (!payload || typeof payload !== "object") return null;
  const { messages } = payload as { messages?: unknown };
  if (!Array.isArray(messages)) return null;

  const parsed: ChatMessage[] = [];
  let total = 0;

  for (const item of messages.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = record.content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;

    const text = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text) continue;
    if (total + text.length > MAX_TOTAL_CHARS) break;
    total += text.length;
    parsed.push({ role, content: text });
  }

  // Gemini expects a conversation that opens with the visitor's turn.
  while (parsed.length > 0 && parsed[0]!.role !== "user") parsed.shift();

  if (parsed.length === 0) return null;
  if (parsed[parsed.length - 1]!.role !== "user") return null;
  return parsed;
}

/** Collapses consecutive turns so the model always sees user/model alternation. */
function toContents(messages: ChatMessage[]) {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0]!.text += `\n\n${message.content}`;
      continue;
    }
    contents.push({ role, parts: [{ text: message.content }] });
  }

  return contents;
}

const encoder = new TextEncoder();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Send = (event: Record<string, unknown>) => void;

/** Types an answer out in small chunks so the fallback still feels conversational. */
async function streamFallback(send: Send, text: string, signal: AbortSignal) {
  const pieces = text.split(/(?<=\s)/);
  let buffer = "";

  for (const piece of pieces) {
    buffer += piece;
    if (buffer.length >= 16) {
      send({ type: "delta", text: buffer });
      buffer = "";
      if (signal.aborted) return;
      await sleep(14);
    }
  }

  if (buffer) send({ type: "delta", text: buffer });
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!allowRequest(ip)) {
    return new Response(
      JSON.stringify({
        error:
          "Jala menerima terlalu banyak pesan. Mohon tunggu beberapa menit lalu coba lagi.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)),
        },
      }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Format pesan tidak valid." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = readMessages(payload);
  if (!messages) {
    return new Response(
      JSON.stringify({ error: "Pesan tidak lengkap atau tidak valid." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const page =
    typeof (payload as { page?: unknown }).page === "string"
      ? ((payload as { page: string }).page)
      : undefined;

  const latestQuestion = messages[messages.length - 1]!.content;
  const systemInstruction = withPageContext(page);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      const send: Send = (event) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      try {
        if (!apiKey) {
          send({ type: "meta", mode: "faq" });
          await streamFallback(send, offlineReply(latestQuestion), request.signal);
          send({ type: "done" });
          return;
        }

        send({ type: "meta", mode: "ai" });

        const ai = new GoogleGenAI({ apiKey });
        let produced = false;
        let lastError: unknown = null;

        const candidates = modelCandidates();
        const models = stickyModel
          ? [stickyModel, ...candidates.filter((model) => model !== stickyModel)]
          : candidates;

        for (const model of models) {
          if (produced || request.signal.aborted) break;

          try {
            const result = await ai.models.generateContentStream({
              model,
              contents: toContents(messages),
              config: {
                systemInstruction,
                temperature: 0.6,
                topP: 0.95,
                maxOutputTokens: 900,
              },
            });

            for await (const chunk of result) {
              if (request.signal.aborted) break;
              const text = chunk.text;
              if (!text) continue;
              produced = true;
              stickyModel = model;
              send({ type: "delta", text });
            }
          } catch (error) {
            lastError = error;
            if (produced) break;
            console.error(`[jala] model ${model} failed, trying next:`, error);
          }
        }

        if (!produced) {
          if (lastError) {
            console.error("[jala] all models failed, using fallback:", lastError);
          }
          send({ type: "meta", mode: "faq" });
          await streamFallback(send, offlineReply(latestQuestion), request.signal);
        }

        send({ type: "done" });
      } catch (error) {
        console.error("[jala] stream error:", error);
        send({
          type: "error",
          message:
            "Maaf, Jala sedang tidak bisa menjawab. Silakan coba lagi sebentar.",
        });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
