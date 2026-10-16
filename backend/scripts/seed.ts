// Loads (or refreshes) all languages, interface text and document guides from seed/.
// Existing rows with the same keys are overwritten; user accounts are never touched.
import { sql } from "../src/db.ts";

const read = async <T>(path: string): Promise<T> =>
  JSON.parse(await Deno.readTextFile(new URL(`../seed/${path}`, import.meta.url)));

type Lang = { code: string; nativeName: string; englishName: string; sortOrder: number };
type Doc = {
  id: string;
  category: string;
  icon: string;
  portal: string;
  helpline: string | null;
  aliases: string[];
  youtubeQueries: string[];
  popular: boolean;
  sortOrder: number;
  stepLinks: (string | null)[];
};
type Locale = {
  ui: Record<string, string>;
  docs: Record<string, {
    name: string;
    issuer: string;
    fee: string;
    time: string;
    mode: string;
    eligibility: string;
    docs: string[];
    steps: { t: string; d: string; w?: string }[];
    tips: string[];
  }>;
};

// --if-empty: only seed a brand-new database (used on deploy so admin edits are never overwritten).
if (Deno.args.includes("--if-empty")) {
  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM documents`;
  if (count > 0) {
    console.log(`Database already has ${count} documents; skipping seed.`);
    await sql.end();
    Deno.exit(0);
  }
}

const languages = await read<Lang[]>("languages.json");
const categories = await read<{ id: string; sortOrder: number }[]>("categories.json");
const documents = await read<Doc[]>("documents.json");

await sql.begin(async (tx) => {
  for (const l of languages) {
    await tx`
      INSERT INTO languages (code, native_name, english_name, sort_order)
      VALUES (${l.code}, ${l.nativeName}, ${l.englishName}, ${l.sortOrder})
      ON CONFLICT (code) DO UPDATE SET native_name = EXCLUDED.native_name,
        english_name = EXCLUDED.english_name, sort_order = EXCLUDED.sort_order`;
  }
  for (const c of categories) {
    await tx`INSERT INTO categories (id, sort_order) VALUES (${c.id}, ${c.sortOrder})
             ON CONFLICT (id) DO UPDATE SET sort_order = EXCLUDED.sort_order`;
  }
  for (const d of documents) {
    await tx`
      INSERT INTO documents (id, category_id, icon, portal_url, helpline, aliases, youtube_queries, step_links,
                             popular, sort_order)
      VALUES (${d.id}, ${d.category}, ${d.icon}, ${d.portal}, ${d.helpline}, ${d.aliases}, ${d.youtubeQueries},
              ${d.stepLinks}, ${d.popular}, ${d.sortOrder})
      ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, icon = EXCLUDED.icon,
        portal_url = EXCLUDED.portal_url, helpline = EXCLUDED.helpline, aliases = EXCLUDED.aliases,
        youtube_queries = EXCLUDED.youtube_queries, step_links = EXCLUDED.step_links,
        popular = EXCLUDED.popular, sort_order = EXCLUDED.sort_order, updated_at = now()`;
  }

  for (const l of languages) {
    const locale = await read<Locale>(`locales/${l.code}.json`);
    for (const [key, value] of Object.entries(locale.ui)) {
      await tx`
        INSERT INTO ui_strings (lang_code, key, value) VALUES (${l.code}, ${key}, ${value})
        ON CONFLICT (lang_code, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    }
    for (const [id, t] of Object.entries(locale.docs)) {
      const doc = documents.find((d) => d.id === id);
      if (!doc) throw new Error(`locales/${l.code}.json has "${id}", which is not in documents.json`);
      if (t.steps.length !== doc.stepLinks.length) {
        throw new Error(`locales/${l.code}.json: "${id}" has ${t.steps.length} steps, expected ${doc.stepLinks.length}`);
      }
      await tx`
        INSERT INTO document_translations (document_id, lang_code, name, issuer, fee, time_text, mode,
                                           eligibility, required_docs, steps, tips)
        VALUES (${id}, ${l.code}, ${t.name}, ${t.issuer}, ${t.fee}, ${t.time}, ${t.mode}, ${t.eligibility},
                ${tx.json(t.docs)}, ${tx.json(t.steps)}, ${tx.json(t.tips)})
        ON CONFLICT (document_id, lang_code) DO UPDATE SET name = EXCLUDED.name, issuer = EXCLUDED.issuer,
          fee = EXCLUDED.fee, time_text = EXCLUDED.time_text, mode = EXCLUDED.mode,
          eligibility = EXCLUDED.eligibility, required_docs = EXCLUDED.required_docs,
          steps = EXCLUDED.steps, tips = EXCLUDED.tips, updated_at = now()`;
    }
    console.log(`  ${l.code}: ${Object.keys(locale.ui).length} UI strings, ${Object.keys(locale.docs).length} documents`);
  }
});

console.log(`Seeded ${languages.length} languages, ${categories.length} categories, ${documents.length} documents.`);
await sql.end();
