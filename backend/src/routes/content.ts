import { Hono } from "hono";
import { getDocument, getUi, listCategories, listDocuments, listLanguages, resolveLang } from "../content.ts";
import { fail } from "../http.ts";

export const content = new Hono();

// Content changes rarely; let browsers and CDNs reuse it briefly.
const CACHE = "public, max-age=60, stale-while-revalidate=300";

/** Everything the app shell needs in one request: languages, UI text and categories. */
content.get("/bootstrap", async (c) => {
  const lang = await resolveLang(c.req.query("lang"));
  const [languages, ui, categories] = await Promise.all([listLanguages(), getUi(lang), listCategories(lang)]);
  c.header("Cache-Control", CACHE);
  return c.json({ lang, languages, ui, categories });
});

content.get("/languages", async (c) => {
  c.header("Cache-Control", CACHE);
  return c.json({ languages: await listLanguages() });
});

content.get("/ui/:lang", async (c) => {
  const lang = await resolveLang(c.req.param("lang"));
  c.header("Cache-Control", CACHE);
  return c.json({ lang, strings: await getUi(lang) });
});

content.get("/categories", async (c) => {
  const lang = await resolveLang(c.req.query("lang"));
  c.header("Cache-Control", CACHE);
  return c.json({ lang, categories: await listCategories(lang) });
});

/** ?lang=hi&q=adhaar&category=identity&popular=1&ids=a,b */
content.get("/documents", async (c) => {
  const lang = await resolveLang(c.req.query("lang"));
  const q = c.req.query("q")?.slice(0, 100);
  const ids = c.req.query("ids")?.split(",").filter(Boolean).slice(0, 100);
  const items = await listDocuments(lang, {
    q,
    category: c.req.query("category") || undefined,
    popular: c.req.query("popular") === "1",
    ids,
  });
  if (!q) c.header("Cache-Control", CACHE);
  return c.json({ lang, items });
});

content.get("/documents/:id", async (c) => {
  const lang = await resolveLang(c.req.query("lang"));
  const doc = await getDocument(c.req.param("id"), lang, await listLanguages());
  if (!doc) fail(404, "We don't have a guide for that document yet.");
  c.header("Cache-Control", CACHE);
  return c.json({ lang, document: doc });
});
