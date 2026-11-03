import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { insertSubmission, getTotalCount } from "@/lib/db";
import { assessSubmission } from "@/lib/ai";
import {
  generateTrackingCode,
  generateId,
} from "@/lib/util";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];

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
  const ext = path.extname(fileObj.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
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
  const storedName = `${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await fileObj.arrayBuffer());
    await fs.writeFile(filePath, buffer);
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan dokumen. Silakan coba lagi." },
      { status: 500 }
    );
  }

  const antrian = getTotalCount() + 1;

  insertSubmission({
    id,
    code,
    nama,
    nik,
    whatsapp,
    email,
    jenis,
    keperluan,
    file_name: fileObj.name,
    file_path: storedName,
    ai_skor: assessment.skor,
    ai_ringkasan: assessment.ringkasan,
    antrian,
  });

  return NextResponse.json({
    ok: true,
    code,
    antrian,
    skor: assessment.skor,
    label: assessment.label,
  });
}
