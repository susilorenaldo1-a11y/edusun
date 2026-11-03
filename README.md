# E-Dusun — Layanan Administrasi Dusun Digital

Platform web untuk mengajukan dokumen dan mendapatkan **tanda tangan digital Kepala Dusun** secara online, didukung **verifikasi AI**. Dibangun untuk menyelesaikan masalah antrean fisik pengurusan tanda tangan di **Dusun Permata Anyar, Desa Ubung Kaja, Denpasar**.

> *Pelayanan Administrasi Dusun Cepat, Transparan, dan Cerdas Berbasis AI.*

## Fitur Utama

- **Pengajuan dokumen online** — masyarakat mengunggah berkas PDF dan masuk antrean.
- **Verifikasi AI** — sistem otomatis memeriksa kelengkapan data (NIK, nama, kontak) dan memberi **skor kelayakan** serta ringkasan untuk memudahkan Kepala Dusun.
- **Panel Admin Kepala Dusun** — tinjau ringkasan AI, periksa dokumen, unggah PDF yang sudah ditandatangani, **ganti PDF** bila salah input.
- **Sampah (Recycle Bin)** — dokumen bisa dipindah ke sampah, dikembalikan, atau dihapus permanen.
- **Lacak status** — masyarakat memantau status pengajuan dan mengunduh dokumen ber-TTD.

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- PostgreSQL ([Neon](https://neon.tech))
- Deployed on [Vercel](https://vercel.com)

## Menjalankan Secara Lokal

```bash
npm install
```

Buat file `.env.local` dan isi koneksi database:

```bash
DATABASE_URL="postgresql://..."
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
3. **Kepala Dusun** masuk `/admin`, memeriksa dokumen, lalu menandatangani PDF di platform lain (mis. iLovePDF).
4. Kepala Dusun **mengunggah PDF yang sudah ditandatangani**.
5. **Masyarakat** mengunduh dokumen ber-TTD di `/lacak`.

## Struktur Folder

```
app/
  ajukan/          Form pengajuan dokumen
  lacak/           Lacak status pengajuan
  admin/           Panel admin Kepala Dusun
  api/             Route handler (ajukan, file, signed)
components/        Komponen UI
lib/               Logika database, AI, dan aksi server
```

## Deployment

Terhubung ke Vercel (auto-deploy dari branch `main`) dan database Neon. Environment variable yang dibutuhkan:

- `DATABASE_URL` — koneksi PostgreSQL (Neon)
- `ADMIN_PIN` — PIN panel admin (opsional, default `UBK2024`)
