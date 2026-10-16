import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db.ts";
import { body, clientIp, fail, rateLimiter } from "../http.ts";
import { type AuthEnv, createSession, deleteSession, getPreferences, hashPassword, requireUser, verifyPassword } from "../auth.ts";

export const auth = new Hono<AuthEnv>();

const limit = rateLimiter(20, 60_000); // 20 attempts per minute per IP

const email = z.string().trim().toLowerCase().email().max(200);
const Prefs = {
  preferredLang: z.string().regex(/^[a-z]{2,3}$/).optional(),
  theme: z.enum(["light", "dark"]).optional(),
};
const Signup = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  password: z.string().min(8, "use at least 8 characters").max(200),
  ...Prefs, // the language and theme the visitor already chose on this device
});
const Login = z.object({ email, password: z.string().min(1).max(200) });

auth.post("/signup", async (c) => {
  limit(clientIp(c));
  const input = await body(c, Signup);
  const [exists] = await sql`SELECT 1 FROM users WHERE email = ${input.email}`;
  if (exists) fail(409, "An account with this email already exists. Log in instead.");
  const lang = input.preferredLang ? (await sql`SELECT code FROM languages WHERE code = ${input.preferredLang}`)[0]?.code : null;
  const [user] = await sql<{ id: string; name: string; email: string }[]>`
    INSERT INTO users (name, email, password_hash, preferred_lang, theme)
    VALUES (${input.name}, ${input.email}, ${await hashPassword(input.password)}, ${lang ?? null}, ${input.theme ?? null})
    RETURNING id, name, email`;
  return c.json({ token: await createSession(user.id), user, preferences: await getPreferences(user.id) }, 201);
});

auth.post("/login", async (c) => {
  limit(clientIp(c));
  const input = await body(c, Login);
  const [row] = await sql<{ id: string; name: string; email: string; passwordHash: string }[]>`
    SELECT id, name, email, password_hash FROM users WHERE email = ${input.email}`;
  // Same message either way, so the form doesn't reveal which emails have accounts.
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    fail(401, "Email or password is wrong.");
  }
  const user = { id: row.id, name: row.name, email: row.email };
  return c.json({ token: await createSession(user.id), user, preferences: await getPreferences(user.id) });
});

auth.post("/logout", requireUser, async (c) => {
  await deleteSession(c.var.token);
  return c.json({ ok: true });
});
