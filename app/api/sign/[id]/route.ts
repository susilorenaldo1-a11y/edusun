import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { getFileData, getSubmissionById, signSubmission } from "@/lib/db";
import { stampSignature } from "@/lib/sign";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIGNATURE_BYTES = 3 * 1024 * 1024;
const MAX_LABEL_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 15 * 1024 * 1024;

function readNumber(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Sesi admin berakhir. Silakan masuk kembali." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json(
      { error: "Pengajuan tidak ditemukan." },
      { status: 404 }
    );
  }

  const file = await getFileData(id);
  if (!file) {
    return NextResponse.json(
      { error: "Dokumen asli tidak tersedia untuk ditandatangani." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Data tanda tangan tidak valid." },
      { status: 400 }
    );
  }

  const signature = form.get("signature");
  if (!signature || typeof signature === "string") {
    return NextResponse.json(
      { error: "Gambar tanda tangan belum dikirim." },
      { status: 400 }
    );
  }

  const signatureFile = signature as File;
  if (signatureFile.size === 0) {
    return NextResponse.json(
      { error: "Gambar tanda tangan kosong." },
      { status: 400 }
    );
  }
  if (signatureFile.size > MAX_SIGNATURE_BYTES) {
    return NextResponse.json(
      { error: "Gambar tanda tangan maksimal 3 MB." },
      { status: 400 }
    );
  }

  const placement = {
    page: Math.trunc(readNumber(form.get("page"), 0)),
    x: readNumber(form.get("x"), 0.62),
    y: readNumber(form.get("y"), 0.78),
    width: readNumber(form.get("width"), 0.3),
    height: readNumber(form.get("height"), 0.12),
  };

  // Optional printed name/role, placed independently from the signature.
  let label: { data: Uint8Array; placement: typeof placement } | undefined;
  const labelEntry = form.get("label");
  if (labelEntry && typeof labelEntry !== "string") {
    const labelFile = labelEntry as File;
    if (labelFile.size > MAX_LABEL_BYTES) {
      return NextResponse.json(
        { error: "Gambar nama/jabatan maksimal 1 MB." },
        { status: 400 }
      );
    }
    if (labelFile.size > 0) {
      label = {
        data: new Uint8Array(await labelFile.arrayBuffer()),
        placement: {
          page: Math.trunc(readNumber(form.get("label_page"), placement.page)),
          x: readNumber(form.get("label_x"), placement.x),
          y: readNumber(form.get("label_y"), placement.y),
          width: readNumber(form.get("label_width"), 0.3),
          height: readNumber(form.get("label_height"), 0.05),
        },
      };
    }
  }

  try {
    const signed = await stampSignature({
      file,
      signature: new Uint8Array(await signatureFile.arrayBuffer()),
      placement,
      label,
      signer: "Kepala Dusun",
    });

    if (signed.byteLength > MAX_OUTPUT_BYTES) {
      return NextResponse.json(
        { error: "Hasil PDF melebihi 15 MB. Coba tanda tangan dengan ukuran lebih kecil." },
        { status: 400 }
      );
    }

    await signSubmission(id, Buffer.from(signed));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menandatangani dokumen.",
      },
      { status: 400 }
    );
  }

  revalidatePath("/admin");
  revalidatePath("/lacak");

  return NextResponse.json({ ok: true, signedAt: new Date().toISOString() });
}
