import type { Preferences, User, UserState } from "~/utils/types";

const GUEST_PROGRESS = "dz_guest_progress";
const GUEST_LAST = "dz_last_doc";

function readLocal<T>(key: string, fallback: T): T {
  if (!import.meta.client) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode: just not remembered */ }
}

/** Turns an API error into a UI string key the reader understands. */
export function errorKey(err: unknown): string {
  const e = err as { statusCode?: number; data?: { error?: string; data?: { error?: string } } };
  const msg = (e.data?.error ?? e.data?.data?.error ?? "").toLowerCase();
  if (e.statusCode === 409) return "errExists";
  if (e.statusCode === 401) return "errLogin";
  if (e.statusCode === 429) return "errTooMany";
  if (e.statusCode === 422 && msg.includes("password")) return "errPassword";
  if (e.statusCode === 422 && msg.includes("email")) return "errEmail";
  if (e.statusCode === 422 && msg.includes("name")) return "errName";
  return "errGeneric";
}

/**
 * Signed-in user and everything that follows them between devices: saved guides, step progress,
 * the guide they opened last, and their language and theme.
 * Guests keep progress and last guide in this browser; it moves into the account on sign-up or login.
 */
export function useAuth() {
  const user = useState<User | null>("user", () => null);
  const saved = useState<string[]>("saved", () => []);
  const progress = useState<Record<string, number[]>>("progress", () => ({}));
  const lastDocument = useState<string | null>("lastDocument", () => null);
  // Captured now, while the Nuxt context is available; used later inside async handlers.
  const site = useSite();
  const theme = useTheme();

  function applyState(state: UserState) {
    saved.value = state.saved;
    progress.value = state.progress;
    lastDocument.value = state.lastDocument;
  }

  async function loadState() {
    applyState(await $fetch<UserState>("/api/me/state"));
  }

  /** Called once on the client for guests, after the server-rendered page has loaded. */
  function loadGuest() {
    if (user.value) return;
    progress.value = readLocal(GUEST_PROGRESS, {});
    lastDocument.value = readLocal<string | null>(GUEST_LAST, null);
  }

  /** The account's language and theme win; an account without any takes this device's choices. */
  async function syncPreferences(prefs: Preferences) {
    if (prefs.lang && prefs.lang !== site.lang.value) await site.setLang(prefs.lang, { save: false }).catch(() => {});
    if (prefs.theme) theme.theme.value = prefs.theme;
    if (!prefs.lang || !prefs.theme) {
      await $fetch("/api/me/preferences", {
        method: "PUT",
        body: { lang: prefs.lang ?? site.lang.value, theme: prefs.theme ?? theme.theme.value },
      }).catch(() => {});
    }
  }

  async function afterSignIn(u: User, prefs: Preferences) {
    user.value = u;
    const guestProgress = readLocal<Record<string, number[]>>(GUEST_PROGRESS, {});
    const guestLast = readLocal<string | null>(GUEST_LAST, null);
    if (Object.keys(guestProgress).length || guestLast) {
      await $fetch("/api/me/import", { method: "POST", body: { progress: guestProgress, lastDocument: guestLast } })
        .catch(() => {});
      writeLocal(GUEST_PROGRESS, null);
      writeLocal(GUEST_LAST, null);
    }
    await Promise.all([syncPreferences(prefs), loadState()]);
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: User; preferences: Preferences }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await afterSignIn(res.user, res.preferences);
  }

  async function signup(name: string, email: string, password: string) {
    const res = await $fetch<{ user: User; preferences: Preferences }>("/api/auth/signup", {
      method: "POST",
      body: { name, email, password, preferredLang: site.lang.value, theme: theme.theme.value },
    });
    await afterSignIn(res.user, res.preferences);
  }

  async function logout() {
    await $fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Offline copies of pages can show the signed-in user's name; drop them.
    navigator.serviceWorker?.controller?.postMessage("clear-pages");
    user.value = null;
    saved.value = [];
    progress.value = readLocal(GUEST_PROGRESS, {});
    lastDocument.value = readLocal<string | null>(GUEST_LAST, null);
  }

  function stepsDone(docId: string): number[] {
    return progress.value[docId] ?? [];
  }

  /** Remembers the guide being read, for "Continue where you left off". */
  function visitDocument(docId: string) {
    lastDocument.value = docId;
    if (user.value) $fetch(`/api/me/last-document/${docId}`, { method: "PUT" }).catch(() => {});
    else writeLocal(GUEST_LAST, docId);
  }

  /** Marks a step done or not done. Saves to the account, or to this browser for guests. */
  async function toggleStep(docId: string, index: number): Promise<boolean> {
    const current = stepsDone(docId);
    const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index].sort((a, b) => a - b);
    progress.value = { ...progress.value, [docId]: next };
    lastDocument.value = docId;
    if (user.value) {
      await $fetch(`/api/me/progress/${docId}`, { method: "PUT", body: { completed: next } }).catch(() => {
        progress.value = { ...progress.value, [docId]: current };
      });
    } else {
      writeLocal(GUEST_PROGRESS, progress.value);
      writeLocal(GUEST_LAST, docId);
    }
    return next.includes(index);
  }

  /** Saves or un-saves a document. Signed-in users only. Returns the new saved state. */
  async function toggleSaved(docId: string): Promise<boolean> {
    const isSaved = saved.value.includes(docId);
    saved.value = isSaved ? saved.value.filter((id) => id !== docId) : [...saved.value, docId];
    try {
      await $fetch(`/api/me/saved/${docId}`, { method: isSaved ? "DELETE" : "PUT" });
    } catch (err) {
      saved.value = isSaved ? [...saved.value, docId] : saved.value.filter((id) => id !== docId);
      throw err;
    }
    return !isSaved;
  }

  return {
    user, saved, progress, lastDocument,
    applyState, loadState, loadGuest, login, signup, logout,
    stepsDone, visitDocument, toggleStep, toggleSaved,
  };
}
