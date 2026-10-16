// Registers the service worker (production only) and captures the browser's install prompt.
export default defineNuxtPlugin(() => {
  const { promptEvent, installed, isIos } = usePwa();

  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  installed.value = standalone;
  isIos.value = !standalone && /iphone|ipad|ipod/i.test(navigator.userAgent);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own Install button instead of the browser's mini bar
    promptEvent.value = e as never;
  });
  window.addEventListener("appinstalled", () => {
    installed.value = true;
    promptEvent.value = null;
  });

  if ("serviceWorker" in navigator && !import.meta.dev) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
});
