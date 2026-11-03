import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getSubmissionById } from "@/lib/db";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const submission = getSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  const ext = path.extname(submission.file_path).toLowerCase();
  const filePath = path.join(process.cwd(), "uploads", submission.file_path);

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${submission.file_name}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Berkas tidak tersedia." },
      { status: 404 }
    );
  }
}
