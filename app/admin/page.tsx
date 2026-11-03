import { cookies } from "next/headers";
import Link from "next/link";
import { listSubmissions, getStats } from "@/lib/db";
import { jenisLabel } from "@/lib/ai";
import { logoutAction, rejectAction } from "@/lib/actions";
import LoginForm from "@/components/LoginForm";
import UploadSignedForm from "@/components/UploadSignedForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authed = cookieStore.get("admin_auth")?.value === "1";

  if (!authed) {
    return (
      <section className="section">
        <div className="container">
          <LoginForm />
        </div>
      </section>
    );
  }

  const stats = await getStats();
  const submissions = await listSubmissions();

  return (
    <section className="section">
      <div className="container">
        <div className="flex-between mb-24">
          <div>
            <h1 className="page-title">Panel Admin Kepala Dusun</h1>
            <p className="page-sub">
              Periksa dokumen, tandatangani di platform lain, lalu unggah kembali
              PDF yang sudah ditandatangani.
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline btn-sm">
              Keluar
            </button>
          </form>
        </div>

        <div className="grid grid-2 mb-24" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="card text-center">
            <div className="muted" style={{ fontSize: 13 }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</div>
          </div>
          <div className="card text-center">
            <div className="muted" style={{ fontSize: 13 }}>Antrean</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#9a6b00" }}>{stats.antrean}</div>
          </div>
          <div className="card text-center">
            <div className="muted" style={{ fontSize: 13 }}>Selesai TTD</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>{stats.ttd}</div>
          </div>
          <div className="card text-center">
            <div className="muted" style={{ fontSize: 13 }}>Ditolak</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--danger)" }}>{stats.ditolak}</div>
          </div>
        </div>

        {submissions.length === 0 && (
          <div className="card text-center muted">
            Belum ada pengajuan. Tunggu masyarakat mengajukan dokumen.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {submissions.map((s) => (
            <div key={s.id} className="card">
              <div className="flex-between mb-8">
                <div className="flex gap-12" style={{ alignItems: "center" }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>
                    {s.code}
                  </span>
                  <span className={`badge badge-${s.status}`}>
                    {s.status === "antrean"
                      ? "Antrean"
                      : s.status === "ttd"
                      ? "Selesai TTD"
                      : "Ditolak"}
                  </span>
                </div>
                <span className="badge badge-neutral">AI {s.ai_skor}%</span>
              </div>

              <div className="grid grid-2" style={{ gap: 8 }}>
                <div>
                  <span className="muted" style={{ fontSize: 12.5 }}>Nama</span>
                  <div style={{ fontWeight: 600 }}>{s.nama}</div>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 12.5 }}>NIK</span>
                  <div className="mono">{s.nik}</div>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 12.5 }}>Jenis</span>
                  <div>{jenisLabel(s.jenis)}</div>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 12.5 }}>WhatsApp</span>
                  <div>{s.whatsapp}</div>
                </div>
              </div>

              <div className="mt-16" style={{ background: "var(--primary-light)", borderRadius: 10, padding: "12px 14px" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Ringkasan AI: </span>
                <span style={{ fontSize: 13.5 }}>{s.ai_ringkasan}</span>
              </div>

              <p className="mt-8 muted" style={{ fontSize: 13.5 }}>
                Keperluan: {s.keperluan}
              </p>

              <div className="flex gap-12 mt-16" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href={`/api/file/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  Periksa Dokumen
                </a>

                {s.status === "antrean" && (
                  <>
                    <UploadSignedForm id={s.id} />
                    <form action={rejectAction} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        className="input"
                        name="catatan"
                        placeholder="Alasan penolakan…"
                        style={{ padding: "7px 12px", fontSize: 13.5 }}
                      />
                      <button type="submit" className="btn btn-danger btn-sm">
                        Tolak
                      </button>
                    </form>
                  </>
                )}

                {s.status === "ttd" && (
                  <>
                    <Link href={`/lacak?code=${s.code}`} className="btn btn-outline btn-sm">
                      Lihat Detail
                    </Link>
                    {s.has_signed && (
                      <a
                        href={`/api/signed/${s.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        Unduh PDF Ber-TTD
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
