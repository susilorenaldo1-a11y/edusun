import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export type SubmissionStatus = "antrean" | "ttd" | "ditolak";

export interface Submission {
  id: string;
  code: string;
  nama: string;
  nik: string;
  whatsapp: string;
  email: string | null;
  jenis: string;
  keperluan: string;
  file_name: string;
  file_path: string;
  status: SubmissionStatus;
  ai_skor: number;
  ai_ringkasan: string | null;
  antrian: number | null;
  catatan: string | null;
  signed_at: string | null;
  signed_path: string | null;
  created_at: string;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "edusun.db");

function createDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA busy_timeout = 15000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      nik TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT,
      jenis TEXT NOT NULL,
      keperluan TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'antrean',
      ai_skor INTEGER NOT NULL DEFAULT 0,
      ai_ringkasan TEXT,
      antrian INTEGER,
      catatan TEXT,
      signed_at TEXT,
      signed_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const cols = db
    .prepare("PRAGMA table_info(submissions)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "signed_path")) {
    db.exec("ALTER TABLE submissions ADD COLUMN signed_path TEXT");
  }
  return db;
}

const globalForDb = globalThis as unknown as {
  __edusunDb?: DatabaseSync;
};

export const db: DatabaseSync = globalForDb.__edusunDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__edusunDb = db;
}

function mapRow(row: Record<string, unknown>): Submission {
  return {
    id: String(row.id),
    code: String(row.code),
    nama: String(row.nama),
    nik: String(row.nik),
    whatsapp: String(row.whatsapp),
    email: row.email ? String(row.email) : null,
    jenis: String(row.jenis),
    keperluan: String(row.keperluan),
    file_name: String(row.file_name),
    file_path: String(row.file_path),
    status: String(row.status) as SubmissionStatus,
    ai_skor: Number(row.ai_skor),
    ai_ringkasan: row.ai_ringkasan ? String(row.ai_ringkasan) : null,
    antrian: row.antrian == null ? null : Number(row.antrian),
    catatan: row.catatan ? String(row.catatan) : null,
    signed_at: row.signed_at ? String(row.signed_at) : null,
    signed_path: row.signed_path ? String(row.signed_path) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function getTotalCount(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM submissions").get() as {
    c: number;
  };
  return row.c;
}

export function listSubmissions(
  status?: SubmissionStatus
): Submission[] {
  const sql = status
    ? "SELECT * FROM submissions WHERE status = ? ORDER BY antrian ASC, created_at ASC"
    : "SELECT * FROM submissions ORDER BY created_at DESC";
  const stmt = db.prepare(sql);
  const rows = status ? stmt.all(status) : stmt.all();
  return (rows as Record<string, unknown>[]).map(mapRow);
}

export function getSubmissionByCode(code: string): Submission | null {
  const row = db
    .prepare("SELECT * FROM submissions WHERE code = ?")
    .get(code) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function getSubmissionById(id: string): Submission | null {
  const row = db
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export interface NewSubmission {
  id: string;
  code: string;
  nama: string;
  nik: string;
  whatsapp: string;
  email: string;
  jenis: string;
  keperluan: string;
  file_name: string;
  file_path: string;
  ai_skor: number;
  ai_ringkasan: string;
  antrian: number;
}

export function insertSubmission(s: NewSubmission): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO submissions (
      id, code, nama, nik, whatsapp, email, jenis, keperluan,
      file_name, file_path, status, ai_skor, ai_ringkasan, antrian,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'antrean', ?, ?, ?, ?, ?)`
  ).run(
    s.id,
    s.code,
    s.nama,
    s.nik,
    s.whatsapp,
    s.email,
    s.jenis,
    s.keperluan,
    s.file_name,
    s.file_path,
    s.ai_skor,
    s.ai_ringkasan,
    s.antrian,
    now,
    now
  );
}

export function signSubmission(id: string, signedPath: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE submissions
     SET status = 'ttd', signed_at = ?, signed_path = ?, updated_at = ?
     WHERE id = ?`
  ).run(now, signedPath, now, id);
}

export function rejectSubmission(id: string, catatan: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE submissions
     SET status = 'ditolak', catatan = ?, updated_at = ?
     WHERE id = ?`
  ).run(catatan, now, id);
}

export function getQueuePosition(submission: Submission): number {
  if (submission.status !== "antrean") return 0;
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM submissions WHERE status = 'antrean' AND antrian <= ?"
    )
    .get(submission.antrian) as { c: number };
  return row.c;
}

export function getAntreanCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM submissions WHERE status = 'antrean'")
    .get() as { c: number };
  return row.c;
}

export function getStats(): {
  total: number;
  antrean: number;
  ttd: number;
  ditolak: number;
} {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS c FROM submissions GROUP BY status")
    .all() as { status: string; c: number }[];
  const stats = { total: 0, antrean: 0, ttd: 0, ditolak: 0 };
  for (const r of rows) {
    stats.total += r.c;
    if (r.status === "antrean") stats.antrean = r.c;
    if (r.status === "ttd") stats.ttd = r.c;
    if (r.status === "ditolak") stats.ditolak = r.c;
  }
  return stats;
}
