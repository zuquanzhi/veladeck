import { api, base } from './api';
export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window))
    throw Error('当前浏览器不支持 Web Push，请使用 Android Chrome。');
  if ((await Notification.requestPermission()) !== 'granted') throw Error('通知权限未开启。');
  const registration = await navigator.serviceWorker.ready;
  const key = await api<{ publicKey: string }>('/api/push/key');
  const text = atob(key.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: bytes,
  });
  await api('/api/push/subscribe', 'POST', subscription.toJSON());
}
export function registerPWA() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator)
    void navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).catch(() => {});
}
