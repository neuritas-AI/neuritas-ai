// OneSignal Web SDK loader + helpers
const ONESIGNAL_APP_ID = "b88657e9-c937-4487-8cb2-2d833b434f21";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
    __oneSignalInit?: boolean;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return resolve();
    if (document.querySelector('script[data-onesignal-sdk]')) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.setAttribute("data-onesignal-sdk", "1");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("OneSignal SDK failed to load"));
    document.head.appendChild(s);
  });
}

export async function initOneSignal(userId: string | null) {
  if (typeof window === "undefined") return;
  // Skip in iframes (Lovable preview) to avoid SW conflicts
  try { if (window.self !== window.top) return; } catch { return; }
  try {
    await loadScript();
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      if (!window.__oneSignalInit) {
        window.__oneSignalInit = true;
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          allowLocalhostAsSecureOrigin: true,
        });
      }
      if (userId) {
        try { await OneSignal.login(userId); } catch (e) { console.warn("OneSignal.login failed", e); }
      } else {
        try { await OneSignal.logout(); } catch {}
      }
    });
  } catch (e) {
    console.warn("OneSignal init skipped:", e);
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !window.OneSignal) return false;
  try {
    await window.OneSignal.Notifications.requestPermission();
    return window.OneSignal.Notifications.permission === true;
  } catch {
    return false;
  }
}

export function isPushSubscribed(): boolean {
  try {
    return !!window.OneSignal?.User?.PushSubscription?.optedIn;
  } catch { return false; }
}
