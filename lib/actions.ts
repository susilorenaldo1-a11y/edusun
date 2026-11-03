"use server";

import path from "node:path";
import fs from "node:fs/promises";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getSubmissionById,
  signSubmission,
  rejectSubmission,
} from "@/lib/db";

const SIGNED_DIR = path.join(process.cwd(), "uploads", "signed");
const MAX_SIGNED_SIZE = 15 * 1024 * 1024;

function checkPin(pin: string): boolean {
  const expected = process.env.ADMIN_PIN ?? "UBK2024";
  return pin === expected;
}

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const pin = String(formData.get("pin") ?? "");
  if (!checkPin(pin)) {
    return { error: "PIN salah. Silakan coba lagi." };
  }
  const cookieStore = await cookies();
  cookieStore.set("admin_auth", "1", {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 8,
    sameSite: "lax",
  });
  revalidatePath("/admin");
  return {};
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth");
  revalidatePath("/admin");
}

export async function uploadSignedPdfAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const submission = getSubmissionById(id);
  if (!submission) {
    return { error: "Pengajuan tidak ditemukan." };
  }

  const file = formData.get("signed_pdf");
  if (!file || typeof file === "string") {
    return { error: "Pilih file PDF yang sudah ditandatangani." };
  }

  const fileObj = file as File;
  if (path.extname(fileObj.name).toLowerCase() !== ".pdf") {
    return { error: "File harus berformat PDF." };
  }
  if (fileObj.size > MAX_SIGNED_SIZE) {
    return { error: "Ukuran file maksimal 15 MB." };
  }

  const fileName = `${id}.pdf`;

  try {
    await fs.mkdir(SIGNED_DIR, { recursive: true });
    const buffer = Buffer.from(await fileObj.arrayBuffer());
    await fs.writeFile(path.join(SIGNED_DIR, fileName), buffer);
  } catch {
    return { error: "Gagal menyimpan file. Silakan coba lagi." };
  }

  signSubmission(id, fileName);
  revalidatePath("/admin");
  revalidatePath("/lacak");
  return {};
}

export async function rejectAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const catatan = String(formData.get("catatan") ?? "");
  if (!id) return;
  rejectSubmission(id, catatan || "Dokumen perlu dilengkapi.");
  revalidatePath("/admin");
  revalidatePath("/lacak");
}
