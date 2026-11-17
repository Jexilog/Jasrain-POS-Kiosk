// fetch() for the Raspberry Pi programs (cash reader and cart camera).
// Chrome's "Local Network Access" rule wants requests to the kiosk's own network marked as local:
//   'local'   = this computer (localhost / 127.x)
//   'private' = another device on the network (192.168.x.x, raspberrypi.local, ...)
export const piFetch = (url, options = {}) => {
  let space = 'local';
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host.startsWith('127.') || host === '[::1]') space = 'loopback';
  } catch (e) { /* keep 'local' */ }
  return fetch(url, { ...options, targetAddressSpace: space });
};