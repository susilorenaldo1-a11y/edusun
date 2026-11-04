"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import { JalaMarkdown } from "@/components/JalaMarkdown";
import { JALA_PROFILE, QUICK_REPLIES, WELCOME_MESSAGE } from "@/lib/jala";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  error?: boolean;
}

const STORAGE_KEY = "edusun:jala:v1";
const MAX_STORED = 40;

let seq = 0;
const uid = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

const makeWelcome = (): Msg => ({
  id: "welcome",
  role: "assistant",
  content: WELCOME_MESSAGE,
  at: Date.now(),
});

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Reads the saved conversation during the first client render. The panel is
 * closed on load, so restored messages never affect the hydrated markup.
 */
function loadSavedMessages(): Msg[] {
  if (typeof window === "undefined") return [makeWelcome()];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [makeWelcome()];
    const saved = JSON.parse(raw) as { messages?: Msg[] };
    if (Array.isArray(saved.messages) && saved.messages.length > 0) {
      return saved.messages.slice(-MAX_STORED);
    }
  } catch {
    /* storage unavailable — start fresh */
  }
  return [makeWelcome()];
}

export default function JalaChat() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Msg[]>(loadSavedMessages);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const [hint, setHint] = useState(false);

  const messagesRef = useRef(messages);
  const openRef = useRef(open);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  /* ---------- first-visit hint + persist ---------- */

  useEffect(() => {
    let timer: number | undefined;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        timer = window.setTimeout(() => setHint(true), 1600);
      }
    } catch {
      /* storage unavailable — no hint */
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages: messages.slice(-MAX_STORED) })
      );
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /* ---------- behaviour ---------- */

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 140);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia("(max-width: 560px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const updateMessage = useCallback(
    (id: string, content: string, error = false) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, content, error } : message
        )
      );
    },
    []
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sendingRef.current) return;

      sendingRef.current = true;
      setBusy(true);
      setHint(false);
      setInput("");
      setUnread(false);
      if (inputRef.current) inputRef.current.style.height = "auto";

      const userMessage: Msg = {
        id: uid(),
        role: "user",
        content: text,
        at: Date.now(),
      };
      const botId = uid();
      const history = [...messagesRef.current, userMessage];

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: botId, role: "assistant", content: "", at: Date.now() },
      ]);
      stickRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/jala", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pathname,
            messages: history
              .filter((message) => !message.error)
              .slice(-20)
              .map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            detail?.error ?? "Jala belum bisa merespons saat ini. Coba lagi, ya."
          );
        }

        if (!response.body) throw new Error("Koneksi ke Jala gagal.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        const consumeFrame = (frame: string) => {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            let event: { type?: string; text?: string; message?: string } | null =
              null;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (!event) continue;

            if (event.type === "delta" && typeof event.text === "string") {
              answer += event.text;
              updateMessage(botId, answer);
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Jala terputus. Coba lagi, ya.");
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let split = buffer.indexOf("\n\n");
          while (split !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            split = buffer.indexOf("\n\n");
            consumeFrame(frame);
          }
        }

        // Flush a trailing frame if the connection closed without the final blank line.
        if (buffer.trim()) consumeFrame(buffer);

        if (!answer.trim()) {
          throw new Error("Jala tidak mengirim jawaban. Silakan coba lagi.");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          const current = messagesRef.current.find((m) => m.id === botId);
          if (!current || !current.content.trim()) {
            setMessages((prev) => prev.filter((m) => m.id !== botId));
          }
        } else {
          const message =
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan. Silakan coba lagi.";
          updateMessage(botId, message, true);
        }
      } finally {
        sendingRef.current = false;
        abortRef.current = null;
        setBusy(false);
        if (!openRef.current) setUnread(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [pathname, updateMessage]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([makeWelcome()]);
    setInput("");
    setUnread(false);
    stickRef.current = true;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    setUnread(false);
    setHint(false);
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void send(input);
    },
    [input, send]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void send(input);
      }
    },
    [input, send]
  );

  const onChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const showChips = messages.length <= 1 && !busy;

  return (
    <div className="jala-root">
      {open && (
        <section
          id="jala-panel"
          className="jala-panel"
          role="dialog"
          aria-label="Asisten Jala — layanan administrasi dusun"
        >
          <header className="jala-header">
            <img
              className="jala-header-avatar"
              src={JALA_PROFILE.avatarSmall}
              alt=""
              width={44}
              height={44}
            />
            <div className="jala-header-text">
              <div className="jala-header-name">
                {JALA_PROFILE.name}
                <span className="jala-verified" title="Asisten resmi E-Dusun">
                  ✓
                </span>
              </div>
              <div className="jala-header-role">
                <span className="jala-online-dot" aria-hidden="true" />
                {JALA_PROFILE.role}
              </div>
            </div>
            <div className="jala-header-actions">
              <button
                type="button"
                className="jala-icon-btn"
                onClick={reset}
                aria-label="Mulai percakapan baru"
                title="Mulai percakapan baru"
              >
                <ResetIcon />
              </button>
              <button
                type="button"
                className="jala-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Tutup asisten Jala"
                title="Tutup"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div
            className="jala-messages"
            ref={listRef}
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`jala-msg ${message.role}${message.error ? " is-error" : ""}`}
              >
                {message.role === "assistant" && (
                  <img
                    className="jala-msg-avatar"
                    src={JALA_PROFILE.avatarSmall}
                    alt=""
                    width={28}
                    height={28}
                  />
                )}
                <div className="jala-bubble">
                  {message.role === "assistant" ? (
                    message.content ? (
                      <JalaMarkdown text={message.content} />
                    ) : (
                      <TypingDots />
                    )
                  ) : (
                    <p className="jala-user-text">{message.content}</p>
                  )}
                  <span className="jala-time">{timeLabel(message.at)}</span>
                </div>
              </div>
            ))}

            {showChips && (
              <div className="jala-chips">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply.label}
                    type="button"
                    className="jala-chip"
                    onClick={() => void send(reply.prompt)}
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form className="jala-composer" onSubmit={onSubmit}>
            <label className="jala-sr-only" htmlFor="jala-input">
              Tulis pesan untuk Jala
            </label>
            <textarea
              id="jala-input"
              ref={inputRef}
              className="jala-input"
              rows={1}
              value={input}
              onChange={onChange}
              onKeyDown={onKeyDown}
              placeholder="Tulis pertanyaan Anda…"
              autoComplete="off"
              enterKeyHint="send"
            />
            {busy ? (
              <button
                type="button"
                className="jala-send jala-stop"
                onClick={stop}
                aria-label="Hentikan jawaban Jala"
                title="Hentikan"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="submit"
                className="jala-send"
                disabled={!input.trim()}
                aria-label="Kirim pesan"
                title="Kirim"
              >
                <SendIcon />
              </button>
            )}
          </form>

          <p className="jala-footnote">
            Jala adalah asisten AI. Keputusan akhir tetap di Kepala Dusun.
          </p>
        </section>
      )}

      {!open && hint && (
        <div className="jala-hint" role="status">
          Butuh bantuan administrasi? Tanya Jala.
          <button
            type="button"
            className="jala-hint-close"
            onClick={() => setHint(false)}
            aria-label="Tutup pengumuman"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <button
        type="button"
        className={`jala-fab${open ? " is-open" : ""}`}
        onClick={toggle}
        aria-label={open ? "Tutup asisten Jala" : "Buka asisten Jala"}
        aria-expanded={open}
        aria-controls="jala-panel"
      >
        <span className="jala-fab-glow" aria-hidden="true" />
        <img
          src={JALA_PROFILE.avatarSmall}
          alt=""
          width={64}
          height={64}
          draggable={false}
        />
        <span className="jala-fab-dot" aria-hidden="true" />
        {unread && <span className="jala-fab-unread" aria-hidden="true" />}
        <span className="jala-fab-label" aria-hidden="true">
          Tanya Jala
        </span>
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="jala-typing" aria-label="Jala sedang mengetik">
      <span />
      <span />
      <span />
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4.2 11.3 19 4.6c.8-.3 1.6.5 1.3 1.3l-6.7 14.8c-.3.8-1.5.8-1.8 0l-2-5.2-5.2-2c-.8-.3-.8-1.5 0-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <path
        d="M4 5v5h5M4.6 14a8 8 0 1 0 .6-6.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
