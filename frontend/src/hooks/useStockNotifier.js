import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const PREF_KEY = 'jasrain_desktop_notify';

export const desktopNotify = {
  supported: () => typeof window !== 'undefined' && 'Notification' in window,
  permission: () => (desktopNotify.supported() ? Notification.permission : 'denied'),
  enabled: () => {
    try {
      return localStorage.getItem(PREF_KEY) === '1' && desktopNotify.permission() === 'granted';
    } catch (e) {
      return false;
    }
  },
  set: (on) => {
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch (e) {
      /* storage blocked */
    }
  },
  // ask for notification permission (needs a click)
  async turnOn() {
    if (!desktopNotify.supported()) return 'unsupported';
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    desktopNotify.set(result === 'granted');
    return result;
  },
};

// Tells the admin when an item newly runs low or out.
// The first run only remembers what is already low, so it isn't noisy.
export function useStockNotifier(alerts) {
  const seen = useRef(null);

  useEffect(() => {
    const stock = alerts.items.filter((i) => i.kind === 'stock');
    const ids = new Set(stock.map((i) => i.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const fresh = stock.filter((i) => !seen.current.has(i.id));
    seen.current = ids;

    fresh.forEach((a) => {
      const show = a.level === 'critical' ? toast.error : toast.warning;
      show(a.title, { toastId: a.id, autoClose: 6000 });
      if (desktopNotify.enabled()) {
        try {
          new Notification(a.level === 'critical' ? 'Out of stock' : 'Low stock', { body: a.title });
        } catch (e) {
          /* some browsers block constructing notifications */
        }
      }
    });
  }, [alerts]);
}
