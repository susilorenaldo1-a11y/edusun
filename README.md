# E-Dusun — Layanan Administrasi Dusun Digital

Platform web untuk mengajukan dokumen dan mendapatkan **tanda tangan digital Kepala Dusun** secara online, didukung **verifikasi AI**. Dibangun untuk menyelesaikan masalah antrean fisik pengurusan tanda tangan di **Dusun Permata Anyar, Desa Ubung Kaja, Denpasar**.

> *Pelayanan Administrasi Dusun Cepat, Transparan, dan Cerdas Berbasis AI.*

## Fitur Utama

- **Pengajuan dokumen online** — masyarakat mengunggah berkas PDF dan masuk antrean.
- **Verifikasi AI** — sistem otomatis memeriksa kelengkapan data (NIK, nama, kontak) dan memberi **skor kelayakan** serta ringkasan untuk memudahkan Kepala Dusun.
- **Panel Admin Kepala Dusun** — tinjau ringkasan AI, periksa dokumen, unggah PDF yang sudah ditandatangani, **ganti PDF** bila salah input.
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
3. **Kepala Dusun** masuk `/admin`, memeriksa dokumen, lalu menandatangani PDF di platform lain (mis. iLovePDF).
4. Kepala Dusun **mengunggah PDF yang sudah ditandatangani**.
5. **Masyarakat** mengunduh dokumen ber-TTD di `/lacak`.

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

## Struktur Folder

```
app/
  ajukan/          Form pengajuan dokumen
  lacak/           Lacak status pengajuan
  admin/           Panel admin Kepala Dusun
  api/jala/        Endpoint streaming asisten Jala
  api/             Route handler lain (ajukan, file, signed)
components/        Komponen UI (termasuk JalaChat.tsx)
lib/               Logika database, AI, aksi server (jala.ts, jala-server.ts)
```

## Deployment

Terhubung ke Vercel (auto-deploy dari branch `main`) dan database Neon. Environment variable yang dibutuhkan:

- `DATABASE_URL` — koneksi PostgreSQL (Neon)
- `GEMINI_API_KEY` — API key Google Gemini untuk asisten Jala (opsional, tanpa ini Jala memakai basis pengetahuan lokal)
- `GEMINI_MODEL` — model Gemini (opsional, default `gemini-3.5-flash`, dengan fallback otomatis bila model sedang sibuk)
- `ADMIN_PIN` — PIN panel admin (opsional, default `UBK2024`)
