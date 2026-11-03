import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getSubmissionById } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const submission = getSubmissionById(id);
  if (!submission || !submission.signed_path) {
    return NextResponse.json(
      { error: "Dokumen ber-TTD belum tersedia." },
      { status: 404 }
    );
  }

  const filePath = path.join(
    process.cwd(),
    "uploads",
    "signed",
    submission.signed_path
  );

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Surat-${submission.code}-TTD.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Dokumen tidak tersedia." },
      { status: 404 }
    );
  }
}
