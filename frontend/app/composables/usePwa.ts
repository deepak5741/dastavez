// Install-as-app support. The browser's install prompt is captured by plugins/pwa.client.ts.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwa() {
  const promptEvent = useState<InstallPromptEvent | null>("pwaPrompt", () => null);
  const installed = useState<boolean>("pwaInstalled", () => false);
  const isIos = useState<boolean>("pwaIos", () => false);

  /** Show the Install button when the browser offers it, or on iPhone/iPad (manual "Add to Home Screen"). */
  const canInstall = computed(() => !installed.value && (!!promptEvent.value || isIos.value));

  /** Opens the browser's install dialog. Returns false when the visitor must add it by hand (iPhone). */
  async function install(): Promise<boolean> {
    const e = promptEvent.value;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    promptEvent.value = null;
    if (outcome === "accepted") installed.value = true;
    return true;
  }

  return { promptEvent, installed, isIos, canInstall, install };
}
