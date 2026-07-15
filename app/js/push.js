export const PUBLIC_VAPID_KEY = "BMs5I6ibazvhjbLJzf122TCMuS-AHENdYH8nwDWiNyAVR9GvApZxfBDC8Fp8dSaFNPSbcAjmDE1eqv_0NSFitoo"

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerPush() {
  if (!("serviceWorker" in navigator)) {
    return { error: "Service workers not supported" };
  }
  if (!("PushManager" in window)) {
    return { error: "Push API not supported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notification permission denied" };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
  });

  return subscription.toJSON();
}
