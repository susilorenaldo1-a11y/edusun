import { NextRequest, NextResponse } from "next/server";
import { getSubmissionById, getSignedData } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  const data = await getSignedData(id);
  if (!data) {
    return NextResponse.json(
      { error: "Dokumen ber-TTD belum tersedia." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Surat-${submission.code}-TTD.pdf"`,
    },
  });
}
