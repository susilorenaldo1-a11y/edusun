import Link from "next/link";
import { getStats } from "@/lib/db";
import { JENIS_PILIHAN } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = await getStats();

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <h1>
              Urus Tanda Tangan Kepala Dusun Tanpa Antre.
            </h1>
            <p>
              Ajukan dokumen dalam bentuk PDF dari rumah, pantau antrean secara
              transparan, dan terima dokumen ber-TTD digital. Didukung verifikasi
              AI untuk mempercepat proses.
            </p>
            <div className="hero-actions">
              <Link href="/ajukan" className="btn btn-light btn-lg">
                Ajukan Dokumen Sekarang
              </Link>
              <Link href="/lacak" className="btn btn-ghost-light btn-lg">
                Lacak Status
              </Link>
            </div>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total Pengajuan</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.antrean}</span>
                <span className="stat-label">Dalam Antrean</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.ttd}</span>
                <span className="stat-label">Selesai TTD</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <h3 style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>
              Alur Pelayanan
            </h3>
            <ol style={{ paddingLeft: 18, marginTop: 14, color: "#fff" }}>
              <li style={{ marginBottom: 12 }}>
                Unggah berkas PDF &amp; isi data
              </li>
              <li style={{ marginBottom: 12 }}>
                AI memverifikasi kelengkapan
              </li>
              <li style={{ marginBottom: 12 }}>
                Masuk antrean TTD Kepala Dusun
              </li>
              <li>Dokumen ditandatangani &amp; selesai</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="page-title">Keunggulan Berbasis AI</h2>
            <p className="page-sub">
              Bukan sekadar upload-download, sistem ini memangkas beban kerja
              Kepala Dusun dan mempercepat verifikasi.
            </p>
          </div>
          <div className="grid grid-3">
            <div className="card feature">
              <div className="feature-icon">OCR</div>
              <h3>Validasi Dokumen Otomatis</h3>
              <p>
                AI memeriksa kelengkapan data (NIK, nama, kontak) dan berkas
                pendukung sebelum masuk antrean Kepala Dusun.
              </p>
            </div>
            <div className="card feature">
              <div className="feature-icon">AI</div>
              <h3>Ringkasan &amp; Skor Kelayakan</h3>
              <p>
                Kepala Dusun cukup membaca ringkasan AI dan skor kelayakan, tanpa
                perlu memeriksa berlembar-lembar dokumen.
              </p>
            </div>
            <div className="card feature">
              <div className="feature-icon">TTD</div>
              <h3>Dokumen Ber-TTD Resmi</h3>
              <p>
                Kepala Dusun menandatangani dokumen secara digital, lalu PDF yang
                sudah ditandatangani diunggah kembali dan bisa diunduh masyarakat.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <h2 className="page-title">Jenis Layanan</h2>
            <p className="page-sub">
              Pilih jenis surat yang ingin diajukan.
            </p>
          </div>
          <div className="grid grid-3">
            {JENIS_PILIHAN.map((j) => (
              <div key={j.value} className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 16 }}>{j.label}</h3>
                <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
                  Unggah berkas pendukung dan dapatkan TTD Kepala Dusun secara
                  digital.
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-32">
            <Link href="/ajukan" className="btn btn-primary btn-lg">
              Mulai Pengajuan
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
