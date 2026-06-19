/**
 * PWA service-worker registration + auto-update.
 *
 * Mirrors the legacy erp/includes/footer.php behaviour:
 *  - register on window load
 *  - check for updates every 15 minutes
 *  - reload when a new SW takes control
 *  - expose `?sw=clear` escape hatch to nuke caches
 */
import { registerSW } from "virtual:pwa-register";

export function registerCrestlySW() {
  // Escape hatch: ?sw=clear forces unregister + cache wipe.
  const url = new URL(window.location.href);
  if (url.searchParams.has("sw")) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    url.searchParams.delete("sw");
    window.location.replace(url.toString());
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is waiting. Activate immediately and reload.
      updateSW(true);
    },
    onOfflineReady() {
      // First install done; offline page now available.
      // eslint-disable-next-line no-console
      console.log("[Crestly] SW ready · offline page cached");
    },
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return;
      // Poll for updates every 15 min while the app is open.
      setInterval(() => reg.update(), 15 * 60 * 1000);
    },
  });
}
