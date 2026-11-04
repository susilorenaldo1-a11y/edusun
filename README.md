# E-Dusun — Layanan Administrasi Dusun Digital

Platform web untuk mengajukan dokumen dan mendapatkan **tanda tangan digital Kepala Dusun** secara online, didukung **verifikasi AI**. Dibangun untuk menyelesaikan masalah antrean fisik pengurusan tanda tangan di **Dusun Permata Anyar, Desa Ubung Kaja, Denpasar**.

> *Pelayanan Administrasi Dusun Cepat, Transparan, dan Cerdas Berbasis AI.*

## Fitur Utama

- **Pengajuan dokumen online** — masyarakat mengunggah berkas PDF dan masuk antrean.
- **Verifikasi AI** — sistem otomatis memeriksa kelengkapan data (NIK, nama, kontak) dan memberi **skor kelayakan** serta ringkasan untuk memudahkan Kepala Dusun.
- **Panel Admin Kepala Dusun** — tinjau ringkasan AI, periksa dokumen, dan **tanda tangani PDF langsung di dalam aplikasi** (tanpa platform lain).
- **Sampah (Recycle Bin)** — dokumen bisa dipindah ke sampah, dikembalikan, atau dihapus permanen.
- **Lacak status** — masyarakat memantau status pengajuan dan mengunduh dokumen ber-TTD.
- **Asisten AI "Jala"** — chatbot mengambang di setiap halaman untuk menjawab pertanyaan seputar layanan, syarat berkas, dan lacak status.

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- PostgreSQL ([Neon](https://neon.tech))
- Google Gemini (`@google/genai`) untuk asisten Jala
- Deployed on [Vercel](https://vercel.com)

## Menjalankan Secara Lokal

```bash
npm install
```

Buat file `.env.local` dan isi koneksi database:

```bash
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."   # opsional — untuk asisten Jala
```

Lalu jalankan server development:

```bash
npm run dev
```

Buka http://localhost:3000.

## Akun Admin

- URL: `/admin`
- PIN default: `UBK2024`

Ubah PIN lewat environment variable `ADMIN_PIN`.

## Alur Penggunaan

1. **Masyarakat** mengunggah dokumen di `/ajukan` → mendapat kode pelacakan `UBK-XXXXXX`.
2. **AI** memverifikasi kelengkapan dan memberi skor kelayakan.
3. **Kepala Dusun** masuk `/admin`, memeriksa dokumen, lalu menempel tanda tangan langsung pada PDF di dialog **Tanda tangani PDF**.
4. PDF ber-TTD tersimpan otomatis (status menjadi **Selesai TTD**); opsional, PDF yang sudah ditandatangani di luar juga bisa diunggah manual.
5. **Masyarakat** mengunduh dokumen ber-TTD di `/lacak`.

## Tanda Tangan di Panel Admin

Dialog penandatanganan meniru alur aplikasi tanda tangan PDF, tetapi berjalan di dalam E-Dusun:

- **Pratinjau dokumen** dirender dengan pdf.js, lengkap dengan navigasi halaman.
- **Zoom & geser halaman** — mulai dari tampilan satu halaman penuh (100%), perbesar sampai 500% dengan tombol **−/+**, pilih **Utuh** atau **Lebar**, lalu geser halaman untuk membaca bagian yang kecil. Pintasan papan tunas: `+`, `-`, `0`, dan Ctrl+scroll.
- **Dua cara membuat tanda tangan** — gambar langsung di kanvas (mouse atau layar sentuh) atau unggah foto tanda tangan PNG/JPG.
- **Atur posisi** dengan menggeser tanda tangan di halaman dan menarik sudut kanan bawah untuk mengubah ukuran.
- **Disimpan ke database** sebagai PDF baru; dokumen asli tetap utuh. Kepala Dusun bisa mengganti tanda tangan selama status masih antrean.
- Dokumen gambar (JPG/PNG) otomatis dikemas menjadi PDF satu halaman agar tetap bisa ditandatangani.

Catatan penting: ini **tanda tangan visual** yang ditempelkan ke PDF, bukan tanda tangan elektronik tersertifikasi (PSrE/BSrE). Untuk dokumen yang menuntut kekuatan hukum sertifikat digital, alur unggah PDF bertanda tangan resmi tetap tersedia.

Keamanan: seluruh aksi admin (tanda tangan, tolak, sampah, hapus) memeriksa cookie sesi `admin_auth`, dan endpoint `/api/sign/[id]` menolak permintaan tanpa sesi admin.

## Asisten AI — Jala

**Jala** (Jero Laksana) adalah maskot jalak Bali yang menemani masyarakat lewat tombol mengambang di kanan bawah setiap halaman. Ia menjawab pertanyaan soal jenis surat, syarat berkas, alur pengajuan, dan lacak status dengan bahasa Indonesia yang ringkas.

- **Streaming** — jawaban muncul bertahap dan bisa dihentikan di tengah jalan.
- **Konteks halaman** — Jala tahu pengunjung sedang di Beranda, Ajukan, Lacak, atau Admin.
- **Tetap hidup tanpa API key** — bila `GEMINI_API_KEY` kosong, Jala menjawab dari basis pengetahuan lokal di `lib/jala-server.ts`, bukan berhenti bekerja.
- **Aman** — Jala tidak meminta NIK/nomor WhatsApp di dalam chat, tidak membagikan PIN admin, dan tidak menjanjikan persetujuan. Prompt sistem hanya dimuat di server.
- **Riwayat** tersimpan di perangkat pengunjung (localStorage); server tidak menyimpan percakapan.
- Dibatasi 30 pesan per 10 menit per IP untuk menjaga biaya API.

Untuk mengaktifkan mode AI penuh, tambahkan API key Google Gemini (dibuat di [Google AI Studio](https://aistudio.google.com/apikey)):

```bash
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3.5-flash"   # opsional
```

Di Vercel, tambahkan `GEMINI_API_KEY` pada environment Production. Tanpa key, tombol Jala tetap berfungsi dengan jawaban kurasi lokal.

## Identitas Visual

Logo E-Dusun menggambarkan atap meru (dusun/rumah warga), lembar surat, dan goresan tanda tangan — tiga hal yang menjadi inti layanan ini.

- `public/brand/edusun-mark.svg` — lambang utama (dipakai di header, footer, dan favicon).
- `public/brand/edusun-logo.svg` / `edusun-logo.png` — logo horizontal dengan tagline *Administrasi Dusun Berbasis AI*.
- `public/brand/og-image.png` — kartu 1200×630 untuk pratinjau tautan (Open Graph/Twitter).
- `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico` — ikon tab peramban dan layar utama perangkat.

## Struktur Folder

```
app/
  ajukan/          Form pengajuan dokumen
  lacak/           Lacak status pengajuan
  admin/           Panel admin Kepala Dusun
  api/jala/        Endpoint streaming asisten Jala
  api/sign/        Penempelan tanda tangan ke PDF
  api/             Route handler lain (ajukan, file, signed)
components/        Komponen UI (JalaChat.tsx, SignPdfDialog.tsx)
lib/               Logika database, AI, tanda tangan, aksi server
public/brand/      Logo, ikon, dan kartu pratinjau tautan
public/            Aset statis, termasuk worker pdf.js
```

## Deployment

Terhubung ke Vercel (auto-deploy dari branch `main`) dan database Neon. Environment variable yang dibutuhkan:

- `DATABASE_URL` — koneksi PostgreSQL (Neon)
- `GEMINI_API_KEY` — API key Google Gemini untuk asisten Jala (opsional, tanpa ini Jala memakai basis pengetahuan lokal)
- `GEMINI_MODEL` — model Gemini (opsional, default `gemini-3.5-flash`, dengan fallback otomatis bila model sedang sibuk)
- `ADMIN_PIN` — PIN panel admin (opsional, default `UBK2024`)
