export interface AssessmentInput {
  nama: string;
  nik: string;
  whatsapp: string;
  jenis: string;
  keperluan: string;
  hasFile: boolean;
}

export interface AssessmentResult {
  skor: number;
  label: string;
  ringkasan: string;
}

const JENIS_LABEL: Record<string, string> = {
  sku: "Surat Keterangan Usaha",
  sktm: "Surat Keterangan Tidak Mampu",
  skd: "Surat Keterangan Domisili",
  skkb: "Surat Keterangan Kelakuan Baik",
  rekom_nikah: "Rekomendasi Nikah",
  lainnya: "Surat Pengantar Lainnya",
};

export function assessSubmission(input: AssessmentInput): AssessmentResult {
  let skor = 100;
  const issues: string[] = [];

  if (!input.nama || input.nama.trim().length < 3) {
    skor -= 20;
    issues.push("Nama lengkap tidak valid");
  }

  const nikClean = input.nik.replace(/\D/g, "");
  if (nikClean.length !== 16) {
    skor -= 20;
    issues.push("NIK harus 16 digit");
  }

  const waClean = input.whatsapp.replace(/\D/g, "");
  if (waClean.length < 9) {
    skor -= 10;
    issues.push("Nomor WhatsApp tidak valid");
  }

  if (!input.jenis) {
    skor -= 15;
    issues.push("Jenis pengajuan belum dipilih");
  }

  if (!input.keperluan || input.keperluan.trim().length < 10) {
    skor -= 10;
    issues.push("Keperluan terlalu singkat");
  }

  if (!input.hasFile) {
    skor -= 25;
    issues.push("Dokumen pendukung belum diunggah");
  }

  skor = Math.max(0, Math.min(100, skor));

  const label = skor >= 85 ? "Layak" : skor >= 60 ? "Perlu Ditinjau" : "Kurang Lengkap";
  const jenisLabel = JENIS_LABEL[input.jenis] ?? input.jenis;

  const ringkasan =
    issues.length === 0
      ? `Dokumen ${jenisLabel} a.n. ${input.nama.trim()} lengkap dan valid. Siap untuk ditandatangani Kepala Dusun.`
      : `${issues.join("; ")}.` + (issues.length > 0 ? " Mohon periksa kembali sebelum TTD." : "");

  return { skor, label, ringkasan };
}

export function jenisLabel(jenis: string): string {
  return JENIS_LABEL[jenis] ?? jenis;
}

export const JENIS_PILIHAN = [
  { value: "sku", label: "Surat Keterangan Usaha (SKU)" },
  { value: "sktm", label: "Surat Keterangan Tidak Mampu (SKTM)" },
  { value: "skd", label: "Surat Keterangan Domisili (SKD)" },
  { value: "skkb", label: "Surat Keterangan Kelakuan Baik (SKKB)" },
  { value: "rekom_nikah", label: "Rekomendasi Nikah" },
  { value: "lainnya", label: "Surat Pengantar Lainnya" },
];
