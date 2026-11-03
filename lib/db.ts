import { Pool } from "pg";

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
  file_type: string | null;
  status: SubmissionStatus;
  ai_skor: number;
  ai_ringkasan: string | null;
  antrian: number | null;
  catatan: string | null;
  signed_at: string | null;
  deleted_at: string | null;
  has_file: boolean;
  has_signed: boolean;
  created_at: string;
  updated_at: string;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const globalForDb = globalThis as unknown as { __edusunPool?: Pool };

export const db: Pool = globalForDb.__edusunPool ?? pool;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__edusunPool = db;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .query(
        `CREATE TABLE IF NOT EXISTS submissions (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          nama TEXT NOT NULL,
          nik TEXT NOT NULL,
          whatsapp TEXT NOT NULL,
          email TEXT,
          jenis TEXT NOT NULL,
          keperluan TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT,
          file_data BYTEA,
          status TEXT NOT NULL DEFAULT 'antrean',
          ai_skor INTEGER NOT NULL DEFAULT 0,
          ai_ringkasan TEXT,
          antrian INTEGER,
          catatan TEXT,
          signed_at TEXT,
          signed_data BYTEA,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`
      )
      .then(() =>
        db.query(
          "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at TEXT"
        )
      )
      .then(() => {});
  }
  return schemaReady;
}

const METADATA_COLS = `id, code, nama, nik, whatsapp, email, jenis, keperluan,
  file_name, file_type, status, ai_skor, ai_ringkasan, antrian, catatan,
  signed_at, deleted_at, created_at, updated_at,
  (file_data IS NOT NULL) AS has_file,
  (signed_data IS NOT NULL) AS has_signed`;

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
    file_type: row.file_type ? String(row.file_type) : null,
    status: String(row.status) as SubmissionStatus,
    ai_skor: Number(row.ai_skor),
    ai_ringkasan: row.ai_ringkasan ? String(row.ai_ringkasan) : null,
    antrian: row.antrian == null ? null : Number(row.antrian),
    catatan: row.catatan ? String(row.catatan) : null,
    signed_at: row.signed_at ? String(row.signed_at) : null,
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
    has_file: Boolean(row.has_file),
    has_signed: Boolean(row.has_signed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getTotalCount(): Promise<number> {
  await ensureSchema();
  const r = await db.query(
    "SELECT COUNT(*) AS c FROM submissions WHERE deleted_at IS NULL"
  );
  return Number(r.rows[0].c);
}

export async function listSubmissions(
  status?: SubmissionStatus
): Promise<Submission[]> {
  await ensureSchema();
  const sql = status
    ? `SELECT ${METADATA_COLS} FROM submissions WHERE deleted_at IS NULL AND status = $1 ORDER BY antrian ASC, created_at ASC`
    : `SELECT ${METADATA_COLS} FROM submissions WHERE deleted_at IS NULL ORDER BY created_at DESC`;
  const r = status ? await db.query(sql, [status]) : await db.query(sql);
  return (r.rows as Record<string, unknown>[]).map(mapRow);
}

export async function listTrash(): Promise<Submission[]> {
  await ensureSchema();
  const r = await db.query(
    `SELECT ${METADATA_COLS} FROM submissions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  return (r.rows as Record<string, unknown>[]).map(mapRow);
}

export async function getSubmissionByCode(
  code: string
): Promise<Submission | null> {
  await ensureSchema();
  const r = await db.query(
    `SELECT ${METADATA_COLS} FROM submissions WHERE deleted_at IS NULL AND code = $1`,
    [code]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  await ensureSchema();
  const r = await db.query(
    `SELECT ${METADATA_COLS} FROM submissions WHERE id = $1`,
    [id]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export interface FileData {
  data: Buffer;
  type: string;
  name: string;
}

export async function getFileData(id: string): Promise<FileData | null> {
  await ensureSchema();
  const r = await db.query(
    "SELECT file_data, file_type, file_name FROM submissions WHERE id = $1",
    [id]
  );
  const row = r.rows[0] as
    | { file_data: Buffer | null; file_type: string | null; file_name: string }
    | undefined;
  if (!row || !row.file_data) return null;
  return {
    data: row.file_data,
    type: row.file_type ?? "application/pdf",
    name: row.file_name,
  };
}

export async function getSignedData(id: string): Promise<Buffer | null> {
  await ensureSchema();
  const r = await db.query(
    "SELECT signed_data FROM submissions WHERE id = $1",
    [id]
  );
  const row = r.rows[0] as { signed_data: Buffer | null } | undefined;
  return row && row.signed_data ? row.signed_data : null;
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
  file_type: string;
  file_data: Buffer;
  ai_skor: number;
  ai_ringkasan: string;
  antrian: number;
}

export async function insertSubmission(s: NewSubmission): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO submissions (
      id, code, nama, nik, whatsapp, email, jenis, keperluan,
      file_name, file_type, file_data, status, ai_skor, ai_ringkasan, antrian,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'antrean', $12, $13, $14, $15, $16)`,
    [
      s.id,
      s.code,
      s.nama,
      s.nik,
      s.whatsapp,
      s.email,
      s.jenis,
      s.keperluan,
      s.file_name,
      s.file_type,
      s.file_data,
      s.ai_skor,
      s.ai_ringkasan,
      s.antrian,
      now,
      now,
    ]
  );
}

export async function signSubmission(
  id: string,
  signedData: Buffer
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.query(
    `UPDATE submissions
     SET status = 'ttd', signed_at = $1, signed_data = $2, updated_at = $3
     WHERE id = $4`,
    [now, signedData, now, id]
  );
}

export async function rejectSubmission(
  id: string,
  catatan: string
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.query(
    `UPDATE submissions
     SET status = 'ditolak', catatan = $1, updated_at = $2
     WHERE id = $3`,
    [catatan, now, id]
  );
}

export async function moveToTrash(id: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.query(
    "UPDATE submissions SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [now, id]
  );
}

export async function restoreSubmission(id: string): Promise<void> {
  await ensureSchema();
  await db.query("UPDATE submissions SET deleted_at = NULL WHERE id = $1", [id]);
}

export async function deletePermanently(id: string): Promise<void> {
  await ensureSchema();
  await db.query("DELETE FROM submissions WHERE id = $1", [id]);
}

export async function getQueuePosition(
  submission: Submission
): Promise<number> {
  if (submission.status !== "antrean") return 0;
  await ensureSchema();
  const r = await db.query(
    "SELECT COUNT(*) AS c FROM submissions WHERE deleted_at IS NULL AND status = 'antrean' AND antrian <= $1",
    [submission.antrian]
  );
  return Number(r.rows[0].c);
}

export async function getStats(): Promise<{
  total: number;
  antrean: number;
  ttd: number;
  ditolak: number;
}> {
  await ensureSchema();
  const r = await db.query(
    `SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'antrean') AS antrean,
       COUNT(*) FILTER (WHERE status = 'ttd') AS ttd,
       COUNT(*) FILTER (WHERE status = 'ditolak') AS ditolak
     FROM submissions
     WHERE deleted_at IS NULL`
  );
  const row = r.rows[0] as Record<string, unknown>;
  return {
    total: Number(row.total),
    antrean: Number(row.antrean),
    ttd: Number(row.ttd),
    ditolak: Number(row.ditolak),
  };
}
