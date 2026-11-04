/**
 * Jala — Jero Laksana
 * Penjaga Layanan Administrasi Dusun
 *
 * Client-safe identity and UI copy for the assistant. Server-only knowledge
 * (system prompt, offline answers, model config) lives in `lib/jala-server.ts`
 * so it never ships to the browser bundle.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export const JALA_PROFILE = {
  name: "Jala",
  fullName: "Jero Laksana",
  role: "Penjaga Layanan Administrasi Dusun",
  avatar: "/jala-avatar.webp",
  avatarSmall: "/jala-avatar-sm.webp",
} as const;

export const WELCOME_MESSAGE = `Halo! Saya **Jala** (Jero Laksana), penjaga layanan administrasi Dusun Permata Anyar.

Saya bisa membantu soal **pengajuan surat**, syarat berkas, dan **lacak status** dokumen Anda. Mau mulai dari mana?`;

export const QUICK_REPLIES = [
  {
    label: "Cara ajukan surat",
    prompt: "Bagaimana cara mengajukan surat di E-Dusun?",
  },
  {
    label: "Syarat & berkas",
    prompt: "Dokumen apa saja yang perlu saya siapkan untuk mengajukan surat?",
  },
  {
    label: "Lacak status",
    prompt: "Bagaimana cara melacak status pengajuan saya?",
  },
  {
    label: "Berkas gagal diunggah",
    prompt: "Berkas saya gagal diunggah, apa yang harus saya lakukan?",
  },
] as const;
