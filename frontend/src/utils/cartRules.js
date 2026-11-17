// Cart rules on self checkout. Staff can switch them off in Admin > Settings > Camera.
const KEY = 'jasrain_cart_rules';

export function isCartRulesOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
}

export function setCartRulesOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
}
