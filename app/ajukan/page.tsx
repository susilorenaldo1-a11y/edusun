"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { JENIS_PILIHAN } from "@/lib/ai";

interface SuccessState {
  code: string;
  antrian: number;
  skor: number;
  label: string;
}

/** Vercel menolak badan permintaan di atas ±4,5 MB, jadi kita batasi sebelum dikirim. */
const MAX_UPLOAD = 4 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "4 MB";

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function AjukanPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function acceptFile(f: File | null) {
    if (!f) {
      setFileName(null);
      setFileSize(0);
      setFileError(null);
      return;
    }
    if (f.size > MAX_UPLOAD) {
      setFileError(
        `"${f.name}" berukuran ${formatSize(f.size)}, melebihi batas ${MAX_UPLOAD_LABEL}. Kompres atau kecilkan dokumen dulu, lalu unggah lagi.`
      );
      setFileName(null);
      setFileSize(0);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFileError(null);
    setError(null);
    setFileName(f.name);
    setFileSize(f.size);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    const file = data.get("file");
    if (!file || (file as File).size === 0) {
      setError("Dokumen pendukung wajib diunggah.");
      return;
    }

    if ((file as File).size > MAX_UPLOAD) {
      setError(
        `Ukuran dokumen melebihi batas ${MAX_UPLOAD_LABEL}. Kompres atau kecilkan dokumen dulu, lalu unggah lagi.`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ajukan", {
        method: "POST",
        body: data,
      });

      // Server bisa membalas HTML (mis. 413 dari platform), jadi jangan langsung res.json().
      const raw = await res.text();
      let json: (Partial<SuccessState> & { error?: string }) | null = null;
      try {
        json = JSON.parse(raw) as Partial<SuccessState> & { error?: string };
      } catch {
        json = null;
      }

      if (!res.ok) {
        if (res.status === 413) {
          setError(
            `Dokumen terlalu besar untuk dikirim ke server (batas ${MAX_UPLOAD_LABEL}). Kompres PDF atau kecilkan fotonya, lalu coba lagi.`
          );
        } else {
          setError(
            json?.error ??
              `Pengajuan gagal dikirim (kode ${res.status}). Silakan coba lagi.`
          );
        }
        return;
      }

      if (!json?.code) {
        setError("Server tidak mengembalikan kode pengajuan. Silakan coba lagi.");
        return;
      }

      setSuccess(json as SuccessState);
    } catch {
      setError("Gagal terhubung ke server. Periksa koneksi Anda lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0] ?? null);
  }

  if (success) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 620 }}>
          <div className="card text-center">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--primary-light)",
                color: "var(--primary-dark)",
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                margin: "0 auto 16px",
              }}
            >
              ✓
            </div>
            <h1 className="page-title">Pengajuan Berhasil!</h1>
            <p className="page-sub" style={{ margin: "0 auto 24px" }}>
              Dokumen Anda telah masuk antrean. Simpan kode pelacakan berikut
              untuk memantau status.
            </p>
            <div
              className="mono"
              style={{
                fontSize: 26,
                letterSpacing: 2,
                background: "var(--primary-light)",
                color: "var(--primary-dark)",
                borderRadius: 10,
                padding: "16px",
                fontWeight: 700,
              }}
            >
              {success.code}
            </div>
            <div className="flex flex-between mt-24" style={{ justifyContent: "center", gap: 24 }}>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>Nomor Antrean</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>#{success.antrian}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>Skor Kelayakan AI</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {success.skor}% <span className="muted" style={{ fontSize: 13 }}>({success.label})</span>
                </div>
              </div>
            </div>
            <div className="flex gap-12 mt-32" style={{ justifyContent: "center" }}>
              <Link href={`/lacak?code=${success.code}`} className="btn btn-primary">
                Lacak Status
              </Link>
              <Link href="/ajukan" className="btn btn-outline">
                Ajukan Lagi
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="section-head">
          <h1 className="page-title">Ajukan Dokumen</h1>
          <p className="page-sub">
            Isi data diri, pilih jenis pengajuan, dan unggah dokumen pendukung
            (PDF). Sistem AI akan memverifikasi sebelum masuk antrean Kepala Dusun.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="label">Nama Lengkap</label>
            <input
              className="input"
              name="nama"
              placeholder="Sesuai KTP"
              required
            />
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label className="label">NIK (16 digit)</label>
              <input
                className="input"
                name="nik"
                inputMode="numeric"
                maxLength={16}
                placeholder="510xxxxxxxxxxxxx"
                required
              />
            </div>
            <div className="field">
              <label className="label">No. WhatsApp</label>
              <input
                className="input"
                name="whatsapp"
                inputMode="tel"
                placeholder="08xxxxxxxxxx"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Email (opsional)</label>
            <input
              className="input"
              name="email"
              type="email"
              placeholder="nama@email.com"
            />
          </div>

          <div className="field">
            <label className="label">Jenis Pengajuan</label>
            <select className="select" name="jenis" required defaultValue="">
              <option value="" disabled>
                Pilih jenis surat…
              </option>
              {JENIS_PILIHAN.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Keperluan / Keterangan</label>
            <textarea
              className="textarea"
              name="keperluan"
              placeholder="Jelaskan keperluan pengajuan surat ini…"
              required
            />
          </div>

          <div className="field">
            <label className="label">Dokumen Pendukung (PDF/JPG/PNG)</label>
            <div
              className={`file-drop ${fileName ? "has-file" : ""} ${dragging ? "has-file" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (!f) return;
                if (fileRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  fileRef.current.files = dt.files;
                }
                acceptFile(f);
              }}
            >
              {fileName ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--primary-dark)" }}>
                    {fileName}
                  </div>
                  <div className="hint mt-8">
                    {formatSize(fileSize)} · klik untuk mengganti file
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 18 }}>Seret &amp; letakkan berkas di sini</div>
                  <div className="hint mt-8">
                    atau klik untuk memilih file · PDF/JPG/PNG · maks {MAX_UPLOAD_LABEL}
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {fileError && (
              <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
                {fileError}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? "Mengirim…" : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </section>
  );
}
