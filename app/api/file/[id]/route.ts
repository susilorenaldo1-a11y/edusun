import { NextRequest, NextResponse } from "next/server";
import { getFileData } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = await getFileData(id);

  if (!file) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="${file.name}"`,
    },
  });
}
