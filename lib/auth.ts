import { cookies } from "next/headers";

/** Every mutating admin action and route must call this first. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_auth")?.value === "1";
}
