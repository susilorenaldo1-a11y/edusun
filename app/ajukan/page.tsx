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

export default function AjukanPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

    setLoading(true);
    try {
      const res = await fetch("/api/ajukan", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Terjadi kesalahan. Silakan coba lagi.");
        return;
      }
      setSuccess(json);
    } catch {
      setError("Gagal terhubung ke server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileName(f ? f.name : null);
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
          {error && <div className="alert alert-error">{error}</div>}

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
                if (f && fileRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  fileRef.current.files = dt.files;
                  setFileName(f.name);
                }
              }}
            >
              {fileName ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--primary-dark)" }}>
                    {fileName}
                  </div>
                  <div className="hint mt-8">Klik untuk mengganti file</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 18 }}>Seret &amp; letakkan berkas di sini</div>
                  <div className="hint mt-8">atau klik untuk memilih file · maks 10 MB</div>
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
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? "Mengirim…" : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </section>
  );
}
