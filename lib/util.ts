import crypto from "node:crypto";

export function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return `UBK-${out}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}
