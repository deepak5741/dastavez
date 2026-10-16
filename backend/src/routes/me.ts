import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db.ts";
import { body, fail } from "../http.ts";
import { type AuthEnv, requireUser } from "../auth.ts";

/** Everything here belongs to the signed-in user. */
export const me = new Hono<AuthEnv>();
me.use("*", requireUser);

async function assertDocument(id: string): Promise<number> {
  const [doc] = await sql<{ steps: number }[]>`
    SELECT cardinality(step_links) AS steps FROM documents WHERE id = ${id} AND published`;
  if (!doc) fail(404, "That document doesn't exist.");
  return doc.steps;
}

me.get("/", (c) => c.json({ user: c.var.user }));

/** Saved document ids and step progress in one call. */
me.get("/state", async (c) => {
  const uid = c.var.user.id;
  const [saved, progress] = await Promise.all([
    sql<{ documentId: string }[]>`SELECT document_id FROM saved_documents WHERE user_id = ${uid} ORDER BY created_at`,
    sql<{ documentId: string; completed: number[] }[]>`
      SELECT document_id, completed FROM step_progress WHERE user_id = ${uid}`,
  ]);
  return c.json({
    saved: saved.map((r) => r.documentId),
    progress: Object.fromEntries(progress.map((r) => [r.documentId, r.completed])),
  });
});

me.put("/saved/:id", async (c) => {
  const id = c.req.param("id");
  await assertDocument(id);
  await sql`INSERT INTO saved_documents (user_id, document_id) VALUES (${c.var.user.id}, ${id}) ON CONFLICT DO NOTHING`;
  return c.json({ ok: true });
});

me.delete("/saved/:id", async (c) => {
  await sql`DELETE FROM saved_documents WHERE user_id = ${c.var.user.id} AND document_id = ${c.req.param("id")}`;
  return c.json({ ok: true });
});

const Progress = z.object({ completed: z.array(z.number().int().min(0)).max(50) });

me.put("/progress/:id", async (c) => {
  const id = c.req.param("id");
  const steps = await assertDocument(id);
  const { completed } = await body(c, Progress);
  const clean = [...new Set(completed.filter((i) => i < steps))].sort((a, b) => a - b);
  await sql`
    INSERT INTO step_progress (user_id, document_id, completed) VALUES (${c.var.user.id}, ${id}, ${clean})
    ON CONFLICT (user_id, document_id) DO UPDATE SET completed = EXCLUDED.completed, updated_at = now()`;
  return c.json({ completed: clean });
});

/** Merges what a guest did on this device into the account (used right after sign-up or login). */
const Import = z.object({
  saved: z.array(z.string().max(100)).max(100).default([]),
  progress: z.record(z.array(z.number().int().min(0)).max(50)).default({}),
});

me.post("/import", async (c) => {
  const uid = c.var.user.id;
  const input = await body(c, Import);
  const known = new Set(
    (await sql<{ id: string }[]>`SELECT id FROM documents`).map((r) => r.id),
  );
  for (const id of input.saved.filter((i) => known.has(i))) {
    await sql`INSERT INTO saved_documents (user_id, document_id) VALUES (${uid}, ${id}) ON CONFLICT DO NOTHING`;
  }
  for (const [id, steps] of Object.entries(input.progress)) {
    if (!known.has(id) || !steps.length) continue;
    await sql`
      INSERT INTO step_progress (user_id, document_id, completed) VALUES (${uid}, ${id}, ${steps})
      ON CONFLICT (user_id, document_id) DO UPDATE
      SET completed = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(step_progress.completed || EXCLUDED.completed) x),
          updated_at = now()`;
  }
  return c.json({ ok: true });
});
