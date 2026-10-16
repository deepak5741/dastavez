import { sql } from "./db.ts";
import { format } from "./http.ts";

export const FALLBACK_LANG = "en";

export interface Language {
  code: string;
  nativeName: string;
  englishName: string;
}

interface StepText {
  t: string;
  d: string;
  w?: string;
}

export async function listLanguages(): Promise<Language[]> {
  return await sql<Language[]>`
    SELECT code, native_name, english_name FROM languages WHERE enabled ORDER BY sort_order, code`;
}

/** Returns a supported language code, falling back to English for anything unknown. */
export async function resolveLang(requested: string | undefined): Promise<string> {
  if (!requested || requested === FALLBACK_LANG) return FALLBACK_LANG;
  const [row] = await sql`SELECT code FROM languages WHERE code = ${requested} AND enabled`;
  return row ? requested : FALLBACK_LANG;
}

/** All interface text for a language, with English filling any missing keys. */
export async function getUi(lang: string): Promise<Record<string, string>> {
  const rows = await sql<{ langCode: string; key: string; value: string }[]>`
    SELECT lang_code, key, value FROM ui_strings WHERE lang_code IN (${FALLBACK_LANG}, ${lang})`;
  const out: Record<string, string> = {};
  for (const r of rows) if (r.langCode === FALLBACK_LANG) out[r.key] = r.value;
  for (const r of rows) if (r.langCode === lang) out[r.key] = r.value;
  return out;
}

export async function listCategories(lang: string) {
  const ui = await getUi(lang);
  const rows = await sql<{ id: string }[]>`SELECT id FROM categories ORDER BY sort_order, id`;
  return rows.map((r) => ({ id: r.id, label: ui[`cat_${r.id}`] ?? r.id }));
}

/* ---------- Documents ---------- */

// The English row is always joined (fallback); the requested language and Hindi (English subtitle) are optional.
const docRows = (lang: string, id?: string) => sql`
  SELECT d.id, d.category_id, d.icon, d.portal_url, d.helpline, d.aliases, d.youtube_queries,
         d.step_links, d.popular, d.sort_order,
         e.name AS en_name, h.name AS hi_name,
         to_jsonb(e) AS en, to_jsonb(t) AS loc
  FROM documents d
  JOIN document_translations e ON e.document_id = d.id AND e.lang_code = ${FALLBACK_LANG}
  LEFT JOIN document_translations t ON t.document_id = d.id AND t.lang_code = ${lang}
  LEFT JOIN document_translations h ON h.document_id = d.id AND h.lang_code = 'hi'
  WHERE d.published ${id ? sql`AND d.id = ${id}` : sql``}
  ORDER BY d.sort_order, d.id`;

// Keys arrive camelCased: the postgres client's camel transform also converts JSON keys.
type TranslationJson = {
  name: string;
  issuer: string;
  fee: string;
  timeText: string;
  mode: string;
  eligibility: string;
  requiredDocs: string[];
  steps: StepText[];
  tips: string[];
};

type DocRow = {
  id: string;
  categoryId: string;
  icon: string;
  portalUrl: string;
  helpline: string | null;
  aliases: string[];
  youtubeQueries: string[];
  stepLinks: (string | null)[];
  popular: boolean;
  enName: string;
  hiName: string | null;
  en: TranslationJson;
  loc: TranslationJson | null;
};

function pick<K extends keyof TranslationJson>(row: DocRow, key: K): TranslationJson[K] {
  const v = row.loc?.[key];
  const empty = v == null || (Array.isArray(v) && v.length === 0) || v === "";
  return empty ? row.en[key] : v as TranslationJson[K];
}

function summary(row: DocRow, lang: string, ui: Record<string, string>) {
  return {
    id: row.id,
    name: pick(row, "name"),
    // Readers of English see the Hindi name underneath; everyone else sees the English name.
    subtitle: lang === FALLBACK_LANG ? row.hiName ?? "" : row.enName,
    category: row.categoryId,
    categoryLabel: ui[`cat_${row.categoryId}`] ?? row.categoryId,
    icon: row.icon,
    fee: pick(row, "fee"),
    time: pick(row, "timeText"),
    popular: row.popular,
    stepCount: row.stepLinks.length,
  };
}

const isDomain = (s: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s);
const youtube = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/* Search: every word must match somewhere; better matches rank higher. */
function score(row: DocRow, localName: string, categoryLabel: string, words: string[]): number {
  const hay = [row.enName, localName, row.hiName ?? "", row.categoryId, categoryLabel, ...row.aliases]
    .join(" ")
    .toLowerCase();
  const names = [row.enName.toLowerCase(), localName.toLowerCase()];
  let s = 0;
  for (const w of words) {
    if (names.some((n) => n.startsWith(w))) s += 5;
    if (row.aliases.includes(w)) s += 4;
    if (row.aliases.some((a) => a.startsWith(w))) s += 3;
    if (hay.includes(w)) s += 2;
    else if (w.length > 3 && hay.includes(w.slice(0, -1))) s += 1; // tolerate one trailing typo
    else return 0;
  }
  return s;
}

export async function listDocuments(
  lang: string,
  opts: { q?: string; category?: string; popular?: boolean; ids?: string[] } = {},
) {
  const ui = await getUi(lang);
  let rows = (await docRows(lang)) as unknown as DocRow[];
  if (opts.category) rows = rows.filter((r) => r.categoryId === opts.category);
  if (opts.popular) rows = rows.filter((r) => r.popular);
  if (opts.ids) rows = rows.filter((r) => opts.ids!.includes(r.id));

  const words = (opts.q ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return rows.map((r) => summary(r, lang, ui));

  return rows
    .map((r) => {
      const s = summary(r, lang, ui);
      return { s, score: score(r, s.name, s.categoryLabel, words) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

export async function getDocument(id: string, lang: string, languages: Language[]) {
  const [row] = (await docRows(lang, id)) as unknown as DocRow[];
  if (!row) return null;
  const ui = await getUi(lang);
  const base = summary(row, lang, ui);

  const enSteps = row.en.steps;
  const locSteps = row.loc?.steps ?? [];
  const steps = row.stepLinks.map((link, i) => {
    const text = { ...enSteps[i], ...(locSteps[i] ?? {}) } as StepText;
    let linkLabel: string | null = null;
    let linkUrl: string | null = null;
    if (link === "portal") {
      linkLabel = text.w ?? enSteps[i]?.w ?? null;
      linkUrl = row.portalUrl;
    } else if (link && isDomain(link)) {
      linkLabel = link;
      linkUrl = `https://${link}`;
    }
    return { title: text.t, body: text.d, linkLabel, linkUrl };
  });

  const langInfo = languages.find((l) => l.code === lang);
  const videoLang = lang === FALLBACK_LANG ? "Hindi" : langInfo?.englishName ?? "Hindi";
  const videoLangLabel = lang === FALLBACK_LANG ? "Hindi" : langInfo?.nativeName ?? videoLang;
  const videos = [
    {
      title: format(ui.ytLang ?? "{name}: {lang}", { name: base.name, lang: videoLangLabel }),
      url: youtube(`${row.enName} apply process in ${videoLang}`),
    },
    ...row.youtubeQueries.map((q) => ({ title: q.charAt(0).toUpperCase() + q.slice(1), url: youtube(q) })),
  ];

  return {
    ...base,
    issuer: pick(row, "issuer"),
    mode: pick(row, "mode"),
    eligibility: pick(row, "eligibility"),
    requiredDocs: pick(row, "requiredDocs"),
    tips: pick(row, "tips"),
    steps,
    videos,
    portalUrl: row.portalUrl,
    portalLabel: row.portalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
    helpline: row.helpline,
  };
}
