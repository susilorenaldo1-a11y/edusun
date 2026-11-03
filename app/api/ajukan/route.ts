import { NextRequest, NextResponse } from "next/server";
import { insertSubmission, getTotalCount } from "@/lib/db";
import { assessSubmission } from "@/lib/ai";
import { generateTrackingCode, generateId } from "@/lib/util";

const MAX_SIZE = 10 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Format data tidak valid." },
      { status: 400 }
    );
  }

  const nama = String(formData.get("nama") ?? "").trim();
  const nik = String(formData.get("nik") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const jenis = String(formData.get("jenis") ?? "").trim();
  const keperluan = String(formData.get("keperluan") ?? "").trim();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Dokumen pendukung wajib diunggah." },
      { status: 400 }
    );
  }

  const fileObj = file as File;
  const ext = (fileObj.name.split(".").pop() ?? "").toLowerCase();
  const fileType = CONTENT_TYPES[`.${ext}`];

  if (!fileType) {
    return NextResponse.json(
      { error: "Format file harus PDF, JPG, atau PNG." },
      { status: 400 }
    );
  }

  if (fileObj.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 10 MB." },
      { status: 400 }
    );
  }

  if (!nama || !nik || !whatsapp || !jenis || !keperluan) {
    return NextResponse.json(
      { error: "Mohon lengkapi seluruh data yang wajib diisi." },
      { status: 400 }
    );
  }

  const assessment = assessSubmission({
    nama,
    nik,
    whatsapp,
    jenis,
    keperluan,
    hasFile: true,
  });

  const id = generateId();
  const code = generateTrackingCode();
  const buffer = Buffer.from(await fileObj.arrayBuffer());
  const antrian = (await getTotalCount()) + 1;

  try {
    await insertSubmission({
      id,
      code,
      nama,
      nik,
      whatsapp,
      email,
      jenis,
      keperluan,
      file_name: fileObj.name,
      file_type: fileType,
      file_data: buffer,
      ai_skor: assessment.skor,
      ai_ringkasan: assessment.ringkasan,
      antrian,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan dokumen. Silakan coba lagi." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    code,
    antrian,
    skor: assessment.skor,
    label: assessment.label,
  });
}
