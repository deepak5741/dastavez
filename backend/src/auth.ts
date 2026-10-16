import type { Context, Next } from "hono";
import { sql } from "./db.ts";
import { fail } from "./http.ts";

const ITERATIONS = 210_000;
const SESSION_DAYS = 30;
const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Stored as "pbkdf2$<iterations>$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  return timingSafeEqual(await pbkdf2(password, unb64(salt), Number(iter)), unb64(hash));
}

async function sha256(text: string): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
}

/** Creates a session and returns the raw token (only its hash is stored). */
export async function createSession(userId: string): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${await sha256(token)}, ${userId}, now() + ${`${SESSION_DAYS} days`}::interval)`;
  return token;
}

export async function deleteSession(token: string) {
  await sql`DELETE FROM sessions WHERE token_hash = ${await sha256(token)}`;
}

export interface Preferences {
  lang: string | null;
  theme: "light" | "dark" | null;
}

/** Language and theme saved on the account (null = not chosen yet). */
export async function getPreferences(userId: string): Promise<Preferences> {
  const [row] = await sql<{ preferredLang: string | null; theme: "light" | "dark" | null }[]>`
    SELECT preferred_lang, theme FROM users WHERE id = ${userId}`;
  return { lang: row?.preferredLang ?? null, theme: row?.theme ?? null };
}

export interface User {
  id: string;
  name: string;
  email: string;
}

function bearer(c: Context): string | null {
  const h = c.req.header("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

export async function userFromRequest(c: Context): Promise<User | null> {
  const token = bearer(c);
  if (!token) return null;
  const [user] = await sql<User[]>`
    SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${await sha256(token)} AND s.expires_at > now()`;
  return user ?? null;
}

export type AuthEnv = { Variables: { user: User; token: string } };

/** Requires a signed-in user; sets c.var.user. */
export async function requireUser(c: Context<AuthEnv>, next: Next) {
  const user = await userFromRequest(c);
  if (!user) fail(401, "Sign in to do this.");
  c.set("user", user);
  c.set("token", bearer(c)!);
  await next();
}

/** Requires the ADMIN_TOKEN from the environment. Admin API is off when it is unset. */
export async function requireAdmin(c: Context, next: Next) {
  const expected = Deno.env.get("ADMIN_TOKEN");
  if (!expected || expected.length < 16) fail(403, "The admin API is turned off. Set ADMIN_TOKEN (16+ characters) to use it.");
  const given = bearer(c) ?? "";
  if (!timingSafeEqual(enc.encode(given), enc.encode(expected))) fail(401, "Wrong admin token.");
  await next();
}
