// Receipt printer over USB, using ESC/POS commands.
//
// The first time, staff press "Connect printer" in Admin > Settings and pick the printer.
// The browser remembers that permission, so after this file finds the printer by itself every
// time the kiosk opens, and again whenever the printer is unplugged and plugged back in.
// (App.jsx imports the checkout page, which imports this file, so it starts with the app.)
//
// Only one page can hold a USB device at a time. So no page keeps the printer: it is taken for
// the moment of printing and let go straight after. That way the admin window and the kiosk
// window (for example on two monitors) can both print.

const VENDOR_ID = 0x28e9; // the MRBOSS / "YC Printer demo" printer
const LINE = 32;          // characters across on 58 mm paper
const SHOP = 'JASRAIN';
const SHOP_SUB = 'Store & Computer Shop';

const usbOk = typeof navigator !== 'undefined' && Boolean(navigator.usb);

let device = null; // the printer this browser is allowed to use (if it is plugged in)
const whyNot = () => (typeof window !== 'undefined' && window.isSecureContext === false
  ? `This page is not secure (${window.location.origin}). USB printing only works on https:// or localhost.`
  : 'This browser cannot talk to USB printers. Use Edge or Chrome, in a normal window.');
let state = { status: usbOk ? 'off' : 'unsupported', name: '', error: usbOk ? '' : whyNot() };
const listeners = new Set();

const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
};
export const getPrinterState = () => state;
export const onPrinterChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const friendly = (e) => {
  const msg = `${e.name || ''} ${e.message || ''}`;
  if (/denied|SecurityError|claimInterface|busy|in use/i.test(msg)) {
    return 'Windows is holding the printer. Switch it to the WinUSB driver with Zadig, and close any page that is using the printer.';
  }
  if (/NotFound|disconnected/i.test(msg)) return 'The printer was not found. Check that it is on and plugged in.';
  return e.message || 'Could not reach the printer.';
};

// Opens the printer, runs `job`, and always lets go afterwards.
// The lock makes two windows take turns instead of fighting over it.
async function useDevice(dev, job) {
  const run = async () => {
    await dev.open();
    try {
      if (!dev.configuration) await dev.selectConfiguration(1);
      let found = null;
      for (const face of dev.configuration.interfaces) {
        for (const alt of face.alternates) {
          const out = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
          if (!found && out) found = { number: face.interfaceNumber, ep: out.endpointNumber };
        }
      }
      if (!found) throw new Error('This device has no place to send data.');
      await dev.claimInterface(found.number);
      try {
        return await job(found.ep);
      } finally {
        try { await dev.releaseInterface(found.number); } catch (e) { /* already free */ }
      }
    } finally {
      try { await dev.close(); } catch (e) { /* already closed */ }
    }
  };
  return navigator.locks ? navigator.locks.request('jasrain-printer', run) : run();
}

// Looks for a printer this browser has already been allowed to use. No pop-up.
export async function autoConnect() {
  if (!usbOk) return;
  try {
    const known = await navigator.usb.getDevices();
    device = known.find((d) => d.vendorId === VENDOR_ID) || null;
    if (device) setState({ status: 'ready', name: device.productName || 'Receipt printer', error: '' });
    else if (state.status !== 'error') setState({ status: 'off', name: '' });
  } catch (e) {
    /* nothing to find yet */
  }
}

// Shows the browser's picker. Needs a tap or click, so it is wired to a button.
export async function connectPrinter() {
  if (!usbOk) return { ok: false, error: whyNot() };
  let picked;
  try {
    picked = await navigator.usb.requestDevice({ filters: [{ vendorId: VENDOR_ID }] });
  } catch (e) {
    if (e.name === 'NotFoundError') return { ok: false, error: 'No printer was picked.' };
    return { ok: false, error: friendly(e) };
  }
  try {
    await useDevice(picked, async () => {}); // a quick check that Windows lets us in
  } catch (e) {
    setState({ status: 'error', error: friendly(e) });
    return { ok: false, error: friendly(e) };
  }
  device = picked;
  setState({ status: 'ready', name: picked.productName || 'Receipt printer', error: '' });
  return { ok: true };
}

if (usbOk) {
  navigator.usb.addEventListener('connect', () => autoConnect());
  navigator.usb.addEventListener('disconnect', (e) => {
    if (e.device === device) {
      device = null;
      setState({ status: 'off' });
    }
  });
  autoConnect();
}

async function send(bytes) {
  if (!device) await autoConnect();
  if (!device) return { ok: false, error: 'The receipt printer is not connected.' };
  try {
    await useDevice(device, async (endpoint) => {
      // small pieces, because these printers have a tiny memory
      for (let i = 0; i < bytes.length; i += 512) {
        await device.transferOut(endpoint, bytes.slice(i, i + 512));
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ---------- what gets printed ----------

const ESC = 0x1b;
const GS = 0x1d;
const ascii = (s) => String(s).replace(/₱/g, 'PHP ').replace(/[^\x20-\x7e]/g, '?');
const money = (n) => `PHP ${Number(n).toFixed(2)}`;
const twoCols = (left, right) => {
  const room = LINE - right.length - 1;
  const l = left.length > room ? left.slice(0, room) : left;
  return l.padEnd(LINE - right.length) + right;
};

function writer() {
  const out = [];
  const encoder = new TextEncoder();
  return {
    raw: (...bytes) => out.push(...bytes),
    line: (s = '') => out.push(...encoder.encode(`${ascii(s)}\n`)),
    done: () => Uint8Array.from(out),
  };
}

export function buildReceipt(order) {
  const w = writer();
  const when = new Date(order.createdAt).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  w.raw(ESC, 0x40);                 // reset the printer
  w.raw(ESC, 0x61, 1);              // centre
  w.raw(GS, 0x21, 0x11);            // double size
  w.line(SHOP);
  w.raw(GS, 0x21, 0x00);            // normal size
  w.line(SHOP_SUB);
  w.line(when);
  w.raw(ESC, 0x61, 0);              // left
  w.line('-'.repeat(LINE));
  w.raw(ESC, 0x61, 1);
  w.line('Order number');
  w.raw(GS, 0x21, 0x11);
  w.line(order.orderNumber);
  w.raw(GS, 0x21, 0x00);
  w.raw(ESC, 0x61, 0);
  w.line('-'.repeat(LINE));
  order.items.forEach((it) => {
    w.line(twoCols(`${it.quantity} x ${it.name}`, money(it.price * it.quantity)));
  });
  w.line('-'.repeat(LINE));
  w.raw(ESC, 0x45, 1);              // bold on
  w.line(twoCols('TOTAL', money(order.total)));
  w.raw(ESC, 0x45, 0);              // bold off
  if (order.cashReceived != null) w.line(twoCols('Cash', money(order.cashReceived)));
  if (order.change > 0) {
    w.line(twoCols('Change due', money(order.change)));
    w.line('');
    w.line('The machine gives no change.');
    w.line('Show this slip to the cashier.');
  }
  w.line('');
  w.raw(ESC, 0x61, 1);
  w.line('Thank you!');
  w.raw(ESC, 0x64, 4);              // feed 4 lines so the slip can be torn off
  return w.done();
}

function buildTestSlip() {
  const w = writer();
  w.raw(ESC, 0x40, ESC, 0x61, 1);
  w.line(SHOP);
  w.line('Printer test');
  w.line('If you can read this,');
  w.line('the printer is working.');
  w.raw(ESC, 0x64, 4);
  return w.done();
}

const printed = new Set(); // so React running an effect twice cannot print a receipt twice

export async function printReceipt(order) {
  if (printed.has(order.orderNumber)) return { ok: true, skipped: true };
  printed.add(order.orderNumber);
  const result = await send(buildReceipt(order));
  if (!result.ok) printed.delete(order.orderNumber);
  return result;
}

// for the "Print again" button
export const reprintReceipt = (order) => send(buildReceipt(order));
export const printTestSlip = () => send(buildTestSlip());
