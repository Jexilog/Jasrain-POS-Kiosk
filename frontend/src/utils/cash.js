// Cash acceptor mode.
// 'simulator' = on-screen buttons for testing.
// 'hardware' = real bill/coin acceptors read by the Raspberry Pi (see the pi folder).
//   The kiosk asks the Pi for new cash a few times a second. Handled in hooks/useCashSession.js.
export const CASH_MODE = 'simulator';

// Where the Pi program is running. Change the address to your Pi's (find it with: hostname -I on the Pi).
// Or set it from the browser console without editing code:  localStorage.setItem('jasrain_pi_url', 'http://192.168.1.50:8765')
const DEFAULT_PI_URL = 'http://raspberrypi.local:8765';
export const piUrl = () => {
  try {
    return localStorage.getItem('jasrain_pi_url') || DEFAULT_PI_URL;
  } catch (e) {
    return DEFAULT_PI_URL;
  }
};

export const COINS = [1, 5, 10, 20];
export const BILLS = [20, 50, 100, 200, 500, 1000];

// Same for the barcode scanner. 'simulator' shows a mock scan panel.
export const SCAN_MODE = 'simulator';
