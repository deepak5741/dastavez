/** Theme, the open pop-up window, and the toast message. */

export function useTheme() {
  const theme = useCookie<"light" | "dark">("dz_theme", {
    default: () => "light",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
  const dark = computed(() => theme.value === "dark");
  const signedIn = useState<unknown>("user", () => null);
  /** Switches theme; when signed in, the choice is saved on the account too. */
  function toggle() {
    theme.value = dark.value ? "light" : "dark";
    if (signedIn.value) $fetch("/api/me/preferences", { method: "PUT", body: { theme: theme.value } }).catch(() => {});
  }
  return { theme, dark, toggle };
}

export type ModalState =
  | { name: "lang" }
  | { name: "auth"; mode: "login" | "signup"; reason?: string }
  | { name: "account" }
  | null;

export function useModal() {
  const modal = useState<ModalState>("modal", () => null);
  return {
    modal,
    open: (m: Exclude<ModalState, null>) => (modal.value = m),
    close: () => (modal.value = null),
  };
}

export function useToast() {
  const message = useState<string | null>("toast", () => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function show(text: string) {
    message.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => (message.value = null), 2600);
  }
  return { message, show };
}
