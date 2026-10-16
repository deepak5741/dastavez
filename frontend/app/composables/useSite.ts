import type { Bootstrap } from "~/utils/types";

const YEAR = 60 * 60 * 24 * 365;

/** Current language, languages list, categories and the t() helper for interface text from the API. */
export function useSite() {
  const cookie = useCookie<string>("dz_lang", { default: () => "en", maxAge: YEAR, sameSite: "lax", path: "/" });
  const lang = useState<string>("lang", () => cookie.value || "en");
  const data = useState<Bootstrap | null>("bootstrap", () => null);

  const languages = computed(() => data.value?.languages ?? []);
  const categories = computed(() => data.value?.categories ?? []);
  const current = computed(() => languages.value.find((l) => l.code === lang.value) ?? languages.value[0]);

  /** Interface text by key, with {placeholders} filled in. Falls back to the key if the API has none. */
  function t(key: string, vars: Record<string, string | number> = {}): string {
    const template = data.value?.ui[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  }

  const signedIn = useState<unknown>("user", () => null);

  /**
   * Loads all interface text for a language and switches to it once it has arrived.
   * When signed in, the choice is also saved on the account (unless `save: false`).
   */
  async function setLang(code: string, opts: { save?: boolean } = {}) {
    const next = await $fetch<Bootstrap>("/api/bootstrap", { query: { lang: code } });
    data.value = next;
    lang.value = next.lang;
    cookie.value = next.lang;
    if (signedIn.value && opts.save !== false) {
      $fetch("/api/me/preferences", { method: "PUT", body: { lang: next.lang } }).catch(() => {});
    }
  }

  return { lang, data, languages, categories, current, t, setLang };
}
