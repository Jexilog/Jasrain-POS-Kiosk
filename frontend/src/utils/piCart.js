// Where the cart camera is.
//   'browser' = the camera plugs into this computer and the cart model runs in the browser (how it was).
//   'pi'      = the camera plugs into the Raspberry Pi and cart_pi.py does the looking.
// To try it without editing code, run this in the browser console, then refresh:
//   localStorage.setItem('jasrain_cart_source', 'pi')       (back: localStorage.removeItem('jasrain_cart_source'))
export const CART_SOURCE = 'pi';

export const isPiCart = () => {
  try {
    const v = localStorage.getItem('jasrain_cart_source');
    if (v === 'pi' || v === 'browser') return v === 'pi';
  } catch (e) { /* storage blocked */ }
  return CART_SOURCE === 'pi';
};

// cart_pi.py listens on port 8766 on the Pi. By default it uses the same Pi address as the cash reader
// (jasrain_pi_url, port 8765), or raspberrypi.local if that was never set.
// To use another address: localStorage.setItem('jasrain_cart_url', 'http://192.168.1.50:8766')
export const cartUrl = () => {
  try {
    const v = localStorage.getItem('jasrain_cart_url');
    if (v) return v.replace(/\/$/, '');
  } catch (e) { /* storage blocked */ }
  let base = 'http://localhost:8765';
  try { base = localStorage.getItem('jasrain_pi_url') || base; } catch (e) { /* storage blocked */ }
  return base.replace(/\/$/, '').replace(/:\d+$/, ':8766');
};
