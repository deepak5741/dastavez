import type { User, UserState } from "~/utils/types";

const GUEST_KEY = "dz_guest_progress";

function readGuest(): Record<string, number[]> {
  if (!import.meta.client) return {};
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeGuest(progress: Record<string, number[]>) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(progress));
  } catch { /* private mode: progress just isn't remembered */ }
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
 * Signed-in user, saved documents and step progress.
 * Guests keep progress in this browser; it moves into the account when they sign up or log in.
 */
export function useAuth() {
  const user = useState<User | null>("user", () => null);
  const saved = useState<string[]>("saved", () => []);
  const progress = useState<Record<string, number[]>>("progress", () => ({}));

  async function loadState() {
    const state = await $fetch<UserState>("/api/me/state");
    saved.value = state.saved;
    progress.value = state.progress;
  }

  /** Called once on the client for guests, after the server-rendered page has loaded. */
  function loadGuest() {
    if (!user.value) progress.value = readGuest();
  }

  async function afterSignIn(u: User) {
    user.value = u;
    const guest = readGuest();
    if (Object.keys(guest).length) {
      await $fetch("/api/me/import", { method: "POST", body: { progress: guest } }).catch(() => {});
      writeGuest({});
    }
    await loadState();
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: User }>("/api/auth/login", { method: "POST", body: { email, password } });
    await afterSignIn(res.user);
  }

  async function signup(name: string, email: string, password: string) {
    const res = await $fetch<{ user: User }>("/api/auth/signup", { method: "POST", body: { name, email, password } });
    await afterSignIn(res.user);
  }

  async function logout() {
    await $fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    user.value = null;
    saved.value = [];
    progress.value = readGuest();
  }

  function stepsDone(docId: string): number[] {
    return progress.value[docId] ?? [];
  }

  /** Marks a step done or not done. Saves to the account, or to this browser for guests. */
  async function toggleStep(docId: string, index: number): Promise<boolean> {
    const current = stepsDone(docId);
    const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index].sort((a, b) => a - b);
    progress.value = { ...progress.value, [docId]: next };
    if (user.value) {
      await $fetch(`/api/me/progress/${docId}`, { method: "PUT", body: { completed: next } }).catch(() => {
        progress.value = { ...progress.value, [docId]: current };
      });
    } else {
      writeGuest(progress.value);
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

  return { user, saved, progress, loadState, loadGuest, login, signup, logout, stepsDone, toggleStep, toggleSaved };
}
