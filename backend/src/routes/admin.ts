import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db.ts";
import { body, fail } from "../http.ts";
import { requireAdmin } from "../auth.ts";

/**
 * Content management. Every request needs `Authorization: Bearer <ADMIN_TOKEN>`.
 * Changes show up on the site immediately (content responses are cached for at most 60s).
 */
export const admin = new Hono();
admin.use("*", requireAdmin);

const code = z.string().regex(/^[a-z]{2,3}$/, "use a 2-3 letter language code");
const slug = z.string().regex(/^[a-z0-9-]{2,60}$/, "use lowercase letters, digits and dashes");

async function assertLang(lang: string) {
  const [row] = await sql`SELECT 1 FROM languages WHERE code = ${lang}`;
  if (!row) fail(404, `Language "${lang}" doesn't exist. Create it first.`);
}

/* Languages ------------------------------------------------------------------- */

const LanguageIn = z.object({
  nativeName: z.string().min(1).max(60),
  englishName: z.string().min(1).max(60),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

admin.put("/languages/:code", async (c) => {
  const lang = code.parse(c.req.param("code"));
  const l = await body(c, LanguageIn);
  await sql`
    INSERT INTO languages (code, native_name, english_name, sort_order, enabled)
    VALUES (${lang}, ${l.nativeName}, ${l.englishName}, ${l.sortOrder}, ${l.enabled})
    ON CONFLICT (code) DO UPDATE SET native_name = EXCLUDED.native_name, english_name = EXCLUDED.english_name,
      sort_order = EXCLUDED.sort_order, enabled = EXCLUDED.enabled`;
  return c.json({ ok: true });
});

/* Interface text ---------------------------------------------------------------- */

admin.get("/ui/:lang", async (c) => {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM ui_strings WHERE lang_code = ${c.req.param("lang")} ORDER BY key`;
  return c.json({ strings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

/** Upserts the given keys only; other keys stay as they are. */
admin.put("/ui/:lang", async (c) => {
  const lang = c.req.param("lang");
  await assertLang(lang);
  const { strings } = await body(c, z.object({ strings: z.record(z.string().max(2000)) }));
  await sql.begin(async (tx) => {
    for (const [key, value] of Object.entries(strings)) {
      await tx`
        INSERT INTO ui_strings (lang_code, key, value) VALUES (${lang}, ${key}, ${value})
        ON CONFLICT (lang_code, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    }
  });
  return c.json({ ok: true, updated: Object.keys(strings).length });
});

admin.delete("/ui/:lang/:key", async (c) => {
  await sql`DELETE FROM ui_strings WHERE lang_code = ${c.req.param("lang")} AND key = ${c.req.param("key")}`;
  return c.json({ ok: true });
});

/* Categories --------------------------------------------------------------------- */

admin.put("/categories/:id", async (c) => {
  const id = slug.parse(c.req.param("id"));
  const { sortOrder } = await body(c, z.object({ sortOrder: z.number().int().default(0) }));
  await sql`INSERT INTO categories (id, sort_order) VALUES (${id}, ${sortOrder})
            ON CONFLICT (id) DO UPDATE SET sort_order = EXCLUDED.sort_order`;
  return c.json({ ok: true, note: `Add its label as the UI string "cat_${id}".` });
});

/* Documents ---------------------------------------------------------------------- */

admin.get("/documents/:id", async (c) => {
  const id = c.req.param("id");
  const [doc] = await sql`SELECT * FROM documents WHERE id = ${id}`;
  if (!doc) fail(404, "No document with that id.");
  const translations = await sql`
    SELECT lang_code, name, issuer, fee, time_text, mode, eligibility, required_docs, steps, tips
    FROM document_translations WHERE document_id = ${id} ORDER BY lang_code`;
  return c.json({ document: doc, translations });
});

const DocumentIn = z.object({
  category: slug,
  icon: z.string().max(30).default("doc"),
  portalUrl: z.string().url().startsWith("https://"),
  helpline: z.string().max(40).nullable().default(null),
  aliases: z.array(z.string().toLowerCase().max(60)).max(40).default([]),
  youtubeQueries: z.array(z.string().max(200)).max(10).default([]),
  // One per step: null (no link), "portal", or a bare domain like "uidai.gov.in".
  stepLinks: z.array(z.union([z.null(), z.literal("portal"), z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i)]))
    .min(1).max(30),
  popular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  published: z.boolean().default(true),
});

admin.put("/documents/:id", async (c) => {
  const id = slug.parse(c.req.param("id"));
  const d = await body(c, DocumentIn);
  const [cat] = await sql`SELECT 1 FROM categories WHERE id = ${d.category}`;
  if (!cat) fail(422, `category: "${d.category}" doesn't exist.`);
  await sql`
    INSERT INTO documents (id, category_id, icon, portal_url, helpline, aliases, youtube_queries, step_links,
                           popular, sort_order, published)
    VALUES (${id}, ${d.category}, ${d.icon}, ${d.portalUrl}, ${d.helpline}, ${d.aliases}, ${d.youtubeQueries},
            ${d.stepLinks}, ${d.popular}, ${d.sortOrder}, ${d.published})
    ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, icon = EXCLUDED.icon,
      portal_url = EXCLUDED.portal_url, helpline = EXCLUDED.helpline, aliases = EXCLUDED.aliases,
      youtube_queries = EXCLUDED.youtube_queries, step_links = EXCLUDED.step_links, popular = EXCLUDED.popular,
      sort_order = EXCLUDED.sort_order, published = EXCLUDED.published, updated_at = now()`;
  return c.json({ ok: true });
});

const TranslationIn = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().min(1).max(200),
  fee: z.string().min(1).max(80),
  time: z.string().min(1).max(80),
  mode: z.string().min(1).max(80),
  eligibility: z.string().min(1).max(1000),
  requiredDocs: z.array(z.string().max(500)).max(20),
  steps: z.array(z.object({ t: z.string().min(1).max(200), d: z.string().min(1).max(2000), w: z.string().max(120).optional() })),
  tips: z.array(z.string().max(500)).max(10).default([]),
});

admin.put("/documents/:id/translations/:lang", async (c) => {
  const id = c.req.param("id");
  const lang = c.req.param("lang");
  await assertLang(lang);
  const [doc] = await sql<{ steps: number }[]>`SELECT cardinality(step_links) AS steps FROM documents WHERE id = ${id}`;
  if (!doc) fail(404, "Create the document first (PUT /api/admin/documents/:id).");
  const t = await body(c, TranslationIn);
  if (t.steps.length !== doc.steps) {
    fail(422, `steps: this document has ${doc.steps} steps, but you sent ${t.steps.length}.`);
  }
  await sql`
    INSERT INTO document_translations (document_id, lang_code, name, issuer, fee, time_text, mode, eligibility,
                                       required_docs, steps, tips)
    VALUES (${id}, ${lang}, ${t.name}, ${t.issuer}, ${t.fee}, ${t.time}, ${t.mode}, ${t.eligibility},
            ${sql.json(t.requiredDocs)}, ${sql.json(t.steps)}, ${sql.json(t.tips)})
    ON CONFLICT (document_id, lang_code) DO UPDATE SET name = EXCLUDED.name, issuer = EXCLUDED.issuer,
      fee = EXCLUDED.fee, time_text = EXCLUDED.time_text, mode = EXCLUDED.mode, eligibility = EXCLUDED.eligibility,
      required_docs = EXCLUDED.required_docs, steps = EXCLUDED.steps, tips = EXCLUDED.tips, updated_at = now()`;
  return c.json({ ok: true });
});

admin.delete("/documents/:id", async (c) => {
  const result = await sql`DELETE FROM documents WHERE id = ${c.req.param("id")}`;
  if (!result.count) fail(404, "No document with that id.");
  return c.json({ ok: true });
});
