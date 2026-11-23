// Cài app (PWA): giữ sự kiện beforeinstallprompt để hiện nút "Cài app" đúng lúc.

let deferred = null;

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    window.dispatchEvent(new Event('install:changed'));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.dispatchEvent(new Event('install:changed'));
  });
}

export const canInstall = () => !!deferred;
export const isStandalone = () => globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  window.dispatchEvent(new Event('install:changed'));
  return outcome;
}
