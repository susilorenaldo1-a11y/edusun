import { cookies } from "next/headers";
import Link from "next/link";
import {
  listSubmissions,
  listTrash,
  getStats,
} from "@/lib/db";
import { jenisLabel } from "@/lib/ai";
import {
  logoutAction,
  rejectAction,
  moveToTrashAction,
  restoreAction,
} from "@/lib/actions";
import LoginForm from "@/components/LoginForm";
import UploadSignedForm from "@/components/UploadSignedForm";
import DeletePermanentlyButton from "@/components/DeletePermanentlyButton";
import SignPdfDialog from "@/components/SignPdfDialog";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ trash?: string }>;
}) {
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

  const { trash } = await searchParams;
  const isTrash = trash === "1";

  const stats = await getStats();
  const trashItems = await listTrash();
  const submissions = isTrash ? trashItems : await listSubmissions();

  return (
    <section className="section">
      <div className="container">
        <div className="flex-between mb-24">
          <div>
            <h1 className="page-title">Panel Admin Kepala Dusun</h1>
            <p className="page-sub">
              Periksa dokumen, lalu tandatangani langsung di sini — PDF ber-TTD
              tersimpan otomatis dan bisa diunduh masyarakat.
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline btn-sm">
              Keluar
            </button>
          </form>
        </div>

        <div className="flex gap-8 mb-24">
          <Link
            href="/admin"
            className={`btn ${!isTrash ? "btn-primary" : "btn-outline"} btn-sm`}
          >
            Pengajuan
          </Link>
          <Link
            href="/admin?trash=1"
            className={`btn ${isTrash ? "btn-primary" : "btn-outline"} btn-sm`}
          >
            Sampah ({trashItems.length})
          </Link>
        </div>

        {!isTrash && (
          <div
            className="grid grid-2 mb-24"
            style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
          >
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
        )}

        {submissions.length === 0 && (
          <div className="card text-center muted">
            {isTrash
              ? "Sampah kosong. Tidak ada dokumen yang dihapus."
              : "Belum ada pengajuan. Tunggu masyarakat mengajukan dokumen."}
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
                  {s.deleted_at && (
                    <span className="badge badge-neutral">
                      Dibuang {formatDate(s.deleted_at)}
                    </span>
                  )}
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

              {!isTrash && (
                <>
                  <div className="mt-16" style={{ background: "var(--primary-light)", borderRadius: 10, padding: "12px 14px" }}>
                    <span className="muted" style={{ fontSize: 12.5 }}>Ringkasan AI: </span>
                    <span style={{ fontSize: 13.5 }}>{s.ai_ringkasan}</span>
                  </div>
                  <p className="mt-8 muted" style={{ fontSize: 13.5 }}>
                    Keperluan: {s.keperluan}
                  </p>
                </>
              )}

              <div className="flex gap-12 mt-16" style={{ alignItems: "center", flexWrap: "wrap" }}>
                {s.has_file && (
                  <a
                    href={`/api/file/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    Periksa Dokumen
                  </a>
                )}

                {isTrash ? (
                  <>
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn btn-outline btn-sm">
                        Kembalikan
                      </button>
                    </form>
                    <DeletePermanentlyButton id={s.id} />
                  </>
                ) : (
                  <>
                    {s.status === "antrean" && (
                      <>
                        <SignPdfDialog id={s.id} code={s.code} />
                        <UploadSignedForm
                          id={s.id}
                          label="Unggah PDF ber-TTD (manual)"
                        />
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
                        <SignPdfDialog
                          id={s.id}
                          code={s.code}
                          label="Tanda tangani ulang"
                        />
                        <UploadSignedForm id={s.id} label="Ganti PDF TTD" />
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

                    <form action={moveToTrashAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn btn-outline btn-sm" style={{ color: "var(--muted)" }}>
                        Pindah ke Sampah
                      </button>
                    </form>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
