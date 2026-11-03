import Link from "next/link";
import { getSubmissionByCode, getQueuePosition } from "@/lib/db";
import { jenisLabel } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function LacakPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const submission = code ? getSubmissionByCode(code.trim().toUpperCase()) : null;

  const steps = [
    { key: "verifikasi", label: "Verifikasi AI" },
    { key: "antrean", label: "Antrean TTD" },
    { key: "selesai", label: "Selesai" },
  ];

  function stepState(key: string): "done" | "active" | "pending" {
    if (!submission) return "pending";
    if (submission.status === "ditolak") {
      if (key === "verifikasi") return "done";
      if (key === "antrean") return "active";
      return "pending";
    }
    if (key === "verifikasi") return "done";
    if (key === "antrean") {
      return submission.status === "antrean" ? "active" : "done";
    }
    return submission.status === "ttd" ? "done" : "pending";
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="section-head">
          <h1 className="page-title">Lacak Status Pengajuan</h1>
          <p className="page-sub">
            Masukkan kode pelacakan yang Anda terima saat mengajukan dokumen.
          </p>
        </div>

        <form action="/lacak" method="GET" className="card">
          <div className="flex gap-8" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="label">Kode Pelacakan</label>
              <input
                className="input mono"
                name="code"
                placeholder="UBK-XXXXXX"
                defaultValue={code ?? ""}
                style={{ textTransform: "uppercase" }}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Cek Status
            </button>
          </div>
        </form>

        {code && !submission && (
          <div className="alert alert-error mt-24">
            Kode <strong>{code}</strong> tidak ditemukan. Pastikan kode benar.
          </div>
        )}

        {submission && (
          <div className="card mt-24">
            <div className="flex-between">
              <div>
                <h2 className="mono" style={{ fontSize: 22, letterSpacing: 1 }}>
                  {submission.code}
                </h2>
                <div className="muted" style={{ fontSize: 14 }}>
                  {jenisLabel(submission.jenis)} · a.n. {submission.nama}
                </div>
              </div>
              <span className={`badge badge-${submission.status}`}>
                {submission.status === "antrean"
                  ? "Dalam Antrean"
                  : submission.status === "ttd"
                  ? "Selesai TTD"
                  : "Ditolak"}
              </span>
            </div>

            <ul className="timeline">
              {steps.map((s) => {
                const st = stepState(s.key);
                return (
                  <li key={s.key} className={`timeline-step ${st}`}>
                    <span className="dot">
                      {st === "done" ? "✓" : s.key === "verifikasi" ? "1" : s.key === "antrean" ? "2" : "3"}
                    </span>
                    <span className="tl-label">{s.label}</span>
                  </li>
                );
              })}
            </ul>

            {submission.status === "antrean" && (
              <div className="alert alert-success">
                Posisi antrean Anda saat ini: <strong>#{getQueuePosition(submission)}</strong>{" "}
                (nomor antrean #{submission.antrian}).
              </div>
            )}

            {submission.status === "ditolak" && (
              <div className="alert alert-error">
                Pengajuan ditolak: {submission.catatan}
              </div>
            )}

            <hr className="divider" />

            <div className="grid grid-2">
              <div>
                <div className="muted" style={{ fontSize: 13 }}>Nama</div>
                <div style={{ fontWeight: 600 }}>{submission.nama}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>NIK</div>
                <div className="mono">{submission.nik}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>No. WhatsApp</div>
                <div>{submission.whatsapp}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>Tanggal Pengajuan</div>
                <div>
                  {new Date(submission.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            <div className="mt-24">
              <div className="muted" style={{ fontSize: 13 }}>Keperluan</div>
              <p style={{ marginTop: 4 }}>{submission.keperluan}</p>
            </div>

            <div className="card mt-24" style={{ background: "var(--primary-light)", border: "none" }}>
              <div className="flex-between">
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Ringkasan &amp; Skor Kelayakan AI
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>
                    Skor {submission.ai_skor}% — {submission.ai_ringkasan}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-12 mt-24" style={{ flexWrap: "wrap" }}>
              <a
                href={`/api/file/${submission.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
              >
                Lihat Dokumen Asli
              </a>
              {submission.status === "ttd" && submission.signed_path && (
                <a
                  href={`/api/signed/${submission.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Unduh Dokumen Ber-TTD (PDF)
                </a>
              )}
            </div>

            {submission.status === "ttd" && submission.signed_at && (
              <div className="alert alert-success mt-24">
                Dokumen telah ditandatangani pada{" "}
                {new Date(submission.signed_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . Silakan unduh dokumen ber-TTD di atas.
              </div>
            )}
          </div>
        )}

        {!code && (
          <p className="muted mt-24 text-center">
            Belum punya kode?{" "}
            <Link href="/ajukan" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Ajukan dokumen sekarang
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
