# E-Dusun — Layanan Administrasi Dusun Digital

Platform web untuk mengajukan dokumen dan mendapatkan **tanda tangan Kepala Dusun secara digital** tanpa datang dan mengantre, didukung **asisten AI** untuk menjawab pertanyaan layanan.

> *Pelayanan Administrasi Dusun Cepat, Transparan, dan Cerdas Berbasis AI.*

**Submission:** AI Web Innovation Challenge — Bali DigiFest 2026 · Kategori Mahasiswa/Umum

## Problem & Target User

Di tingkat dusun, hampir semua urusan administrasi dimulai dari satu lembar rekomendasi Kepala Dusun. Warga harus mencetak formulir, datang ke rumah Kadus untuk meminta tanda tangan, lalu pergi lagi ke kantor desa. Untuk satu surat, warga bisa kehilangan satu hari kerja, sementara data pengajuan tersebar di kertas dan spreadsheet.

**Target user:**

- **Warga dusun** (utama) — ingin mengurus surat tanpa cuti kerja dan tanpa bolak-balik.
- **Kepala Dusun** — ingin menerima berkas yang sudah tersaring, terbaca ringkas, dan bisa ditandatangani kapan saja.
- **Pemerintah desa** — ingin arsip dan rekap pengajuan yang tertata otomatis.

## Key Features

| Fitur | Status |
| --- | --- |
| Pengajuan daring dengan unggah PDF/JPG/PNG (maks. 4 MB) | Berfungsi |
| Skrining kelengkapan otomatis: skor 0–100, label, dan ringkasan | Berfungsi |
| Kode pelacakan `UBK-XXXXXX` + posisi antrean | Berfungsi |
| Panel Kepala Dusun dengan PIN dan tinjauan berkas | Berfungsi |
| **Tanda tangan PDF di dalam aplikasi** — gambar/unggah tanda tangan, geser, ubah ukuran, multi-halaman | Berfungsi |
| **Zoom & geser dokumen** saat menandatangani (`−/+`, **Utuh**, **Lebar**, pintasan `+` `-` `0`, Ctrl+scroll) | Berfungsi |
| Unduh PDF ber-TTD + tanda tangan ulang | Berfungsi |
| Asisten AI **Jala** dengan streaming dan konteks halaman | Berfungsi |
| Tata letak responsif (ponsel, tablet, desktop) + identitas visual (logo, favicon, kartu tautan) | Berfungsi |
| Sampah (recycle bin): pindah, kembalikan, hapus permanen | Berfungsi |

## Tech Stack

- **Frontend/Backend:** Next.js 16.4.4 (App Router, React 19, TypeScript) — Route Handlers sebagai API.
- **Database:** PostgreSQL (Neon) — metadata pengajuan dan berkas PDF (`bytea`).
- **AI:** Google Gemini (`@google/genai`, `gemini-3.5-flash`) untuk asisten Jala, dengan fallback basis pengetahuan lokal.
- **Dokumen:** `pdf-lib` (menempelkan tanda tangan), `pdfjs-dist` (merender pratinjau PDF).
- **Hosting:** Vercel.

## AI Implementation

E-Dusun memisahkan dua lapisan kecerdasan agar jujur dan dapat diaudit:

1. **Jala — asisten layanan (LLM).** Google Gemini menerima pertanyaan bahasa natural + konteks halaman, lalu menjawab dengan streaming SSE. System prompt memuat batasan: tidak meminta NIK/nomor WhatsApp di chat, tidak membagikan PIN admin, dan tidak menjanjikan persetujuan. Bila API gagal atau `GEMINI_API_KEY` kosong, Jala menjawab dari basis pengetahuan lokal (`lib/jala-server.ts`) sehingga layanan tidak berhenti.
2. **Skrining kelengkapan (deterministik, bukan LLM).** Aturan eksplisit memeriksa NIK 16 digit, nomor WhatsApp, keperluan, dan keberadaan berkas, lalu menghasilkan skor 0–100, label (Layak / Perlu Ditinjau / Kurang Lengkap), dan ringkasan untuk Kepala Dusun.

**Batasan yang diakui:** ekstraksi isi dokumen (OCR/LLM document parsing) belum termasuk MVP — sistem memeriksa kelengkapan formulir, bukan isi PDF. Keputusan akhir selalu di tangan Kepala Dusun (human-in-the-loop).

## Architecture / Data Flow

```text
Warga ──► /ajukan (Next.js, React) ──► POST /api/ajukan
                                          │
                                          ├─► skrining deterministik (lib/ai.ts)
                                          │      skor + label + ringkasan
                                          └─► PostgreSQL (Neon)
                                                 metadata + berkas PDF

Kepala Dusun ──► /admin (cookie sesi) ──► GET /api/file/[id]  → pratinjau pdf.js
                                       ──► POST /api/sign/[id] → pdf-lib menempel tanda tangan
                                                              → PDF final disimpan
Warga ──► /lacak ──► status + unduh /api/signed/[id]

Jala ──► POST /api/jala ──► Gemini API (streaming) ──► fallback lokal bila gagal
```

## Installation / Run Instructions

```bash
npm install
```

Buat `.env.local`:

```bash
DATABASE_URL="postgresql://..."   # wajib
GEMINI_API_KEY="..."              # opsional — tanpa ini Jala memakai basis pengetahuan lokal
GEMINI_MODEL="gemini-3.5-flash"   # opsional
ADMIN_PIN="UBK2024"               # opsional — PIN panel admin
```

Jalankan server development:

```bash
npm run dev
```

Buka http://localhost:3000. Skema tabel dibuat otomatis saat pertama kali diakses (`lib/db.ts`).

## Deployment URL

- Produksi: **https://e-dusun.vercel.app/**
- Repository: **https://github.com/susilorenaldo1-a11y/edusun**
- Versi yang dinilai: tag **`v1.0-submission`** (lihat halaman *Releases/Tags* pada repository).

## Demo Account

- Panel admin: `/admin`
- PIN demo ditampilkan pada halaman login (untuk penjurian) dan dapat diganti lewat environment variable `ADMIN_PIN`.
- Tidak ada kredensial sensitif di repository; `DATABASE_URL` dan `GEMINI_API_KEY` hanya ada di environment Vercel.

## Alur Penggunaan

1. **Warga** mengisi formulir dan mengunggah dokumen di `/ajukan` → menerima kode pelacakan `UBK-XXXXXX`.
2. **Sistem** memberi skor kelengkapan dan ringkasan otomatis.
3. **Kepala Dusun** masuk `/admin`, memeriksa dokumen, lalu menandatangani PDF di dialog **Tanda tangani dokumen** — dengan **zoom dan geser** agar bagian tanda tangan terbaca, termasuk untuk form pindai berukuran penuh.
4. PDF ber-TTD tersimpan otomatis (status **Selesai TTD**).
5. **Warga** memantau status dan mengunduh dokumen di `/lacak`.

## Tanda Tangan di Panel Admin

Dialog penandatanganan berjalan di dalam E-Dusun, tanpa layanan pihak ketiga:

- **Pratinjau dokumen** dirender dengan pdf.js, lengkap dengan navigasi halaman.
- **Zoom & geser halaman** — mulai dari tampilan satu halaman penuh (100%), perbesar sampai 500% dengan tombol **−/+**, pilih **Utuh** atau **Lebar**, lalu geser halaman. Pintasan: `+`, `-`, `0`, dan Ctrl+scroll.
- **Dua cara membuat tanda tangan** — gambar langsung di kanvas (mouse atau layar sentuh) atau unggah foto tanda tangan PNG/JPG.
- **Atur posisi** dengan menggeser tanda tangan di halaman dan menarik sudut kanan bawah untuk mengubah ukuran.
- **Disimpan ke database** sebagai PDF baru; dokumen asli tetap utuh. Tanda tangan bisa diganti selama status masih antrean.
- Dokumen gambar (JPG/PNG) otomatis dikemas menjadi PDF satu halaman agar tetap bisa ditandatangani.
- Seluruh aksi admin memeriksa cookie sesi `admin_auth`; endpoint `/api/sign/[id]` menolak permintaan tanpa sesi.

Catatan penting: ini **tanda tangan visual** yang ditempelkan ke PDF, bukan tanda tangan elektronik tersertifikasi (PSrE/BSrE).

## Asisten AI — Jala

**Jala** (Jero Laksana) adalah maskot jalak Bali yang menemani warga lewat tombol mengambang di kanan bawah setiap halaman.

- **Streaming** — jawaban muncul bertahap dan bisa dihentikan di tengah jalan.
- **Konteks halaman** — Jala tahu pengunjung sedang di Beranda, Ajukan, Lacak, atau Admin.
- **Tetap hidup tanpa API key** — bila `GEMINI_API_KEY` kosong, Jala menjawab dari basis pengetahuan lokal.
- **Aman** — tidak meminta NIK/nomor WhatsApp di chat, tidak membagikan PIN admin, tidak menjanjikan persetujuan.
- **Riwayat** tersimpan di perangkat pengunjung (localStorage); server tidak menyimpan percakapan.
- Dibatasi 30 pesan per 10 menit per IP untuk menjaga biaya API.

## Identitas Visual

Logo E-Dusun menggambarkan atap meru (dusun/rumah warga), lembar surat, dan goresan tanda tangan — tiga hal yang menjadi inti layanan ini.

- `public/brand/edusun-mark.svg` — lambang utama (header, footer, favicon).
- `public/brand/edusun-logo.svg` / `.png` — logo horizontal dengan tagline *Administrasi Dusun Berbasis AI*.
- `public/brand/og-image.png` — kartu 1200×630 untuk pratinjau tautan (Open Graph/Twitter).
- `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico` — ikon tab dan layar utama.

Maskot **Jala** tetap dipakai sebagai wajah asisten AI di dalam aplikasi (`public/jala-avatar.webp`).

## Known Limitations

- **Ukuran unggahan maksimal 4 MB** — batas badan permintaan platform hosting. Dokumen hasil pindai yang lebih besar perlu dikompresi lebih dulu; kompresi otomatis di sisi klien belum tersedia.
- **Tanda tangan bersifat visual** (stempel pada PDF), belum setara sertifikat digital tersertifikasi.
- **Alur baru mencakup Kepala Dusun**; persetujuan Perbekel dan integrasi Dukcapil belum ada.
- **Ekstraksi isi dokumen (OCR) belum ada** — skrining memeriksa kelengkapan formulir, bukan isi PDF.
- **Validasi lapangan baru pada satu dusun** (Dusun Permata Anyar); pengujian lebih luas diperlukan.
- **Belum ada notifikasi otomatis** (WhatsApp/email); warga memantau lewat kode pelacakan.
- **Satu PIN admin** untuk seluruh petugas; belum ada multi-user dengan peran berbeda.

## Third-party Resources / Credits

- [Next.js](https://nextjs.org), [React](https://react.dev) — kerangka aplikasi (MIT).
- [pdf-lib](https://pdf-lib.js.org), [pdfjs-dist](https://mozilla.github.io/pdf.js/) — manipulasi dan render PDF (MIT / Apache-2.0).
- [pg](https://node-postgres.com) — klien PostgreSQL (MIT).
- [Google Gemini API](https://ai.google.dev) — model bahasa untuk Jala (`@google/genai`).
- [Neon](https://neon.tech) — PostgreSQL serverless; [Vercel](https://vercel.com) — hosting.
- Font [Geist](https://vercel.com/font) melalui `next/font`.
- Logo Bali DigiFest 2026 — milik panitia, dipakai pada materi submission.
- Ilustrasi desa (`bali-village.svg`) dan maskot Jala — aset tim.
- Foto Kepala Dusun — digunakan dengan izin narasumber.

## Team Members

- **Renaldo Fajar Nugraha Susilo** — Institut Desain dan Bisnis Bali — desain produk, pengembangan, dan pengujian (peserta individu).

## Struktur Folder

```text
app/
  ajukan/          Form pengajuan dokumen
  lacak/           Lacak status pengajuan
  admin/           Panel admin Kepala Dusun
  api/ajukan/      Terima pengajuan + unggah berkas
  api/file/        Ambil berkas asli
  api/sign/        Penempelan tanda tangan ke PDF
  api/signed/      Unduh PDF ber-TTD
  api/jala/        Endpoint streaming asisten Jala
components/        Komponen UI (SignPdfDialog, JalaChat, Header, Footer)
lib/               Database, AI, tanda tangan, aksi server
public/brand/      Logo, ikon, dan kartu pratinjau tautan
public/            Aset statis, termasuk worker pdf.js
```

## Catatan Pengembangan

- `npm run lint` — ESLint (0 error).
- `npm run build` — build produksi.
- Halaman `/admin` dan `/` bersifat dinamis (butuh `DATABASE_URL`); form `/ajukan` tetap dapat dibuka tanpa database.
