import { GRID_W, GRID_H, changedShare, averageGrids } from './emptyCheck';

// Tells if something is INSIDE the cart. Staff save a photo of the empty cart once; after that the
// inside of the cart (cut out using the box the cart model draws) is compared with that photo.
// It needs no training. It only knows that something is different, not what it is.

const PHOTO_KEY = 'jasrain_cart_empty';
const LIMIT_KEY = 'jasrain_item_limit';
const CHECK_KEY = 'jasrain_item_check';
export const DEFAULT_ITEM_LIMIT = 0.06; // more than 6% of the inside changed = an item is in there
export const ITEM_PIXEL_DIFF = 25;     // how different a spot must look (0 to 255) to count as changed
const INSIDE = 0.12;                   // cut this much off each side of the box, so the rim is ignored

let canvas = null;

// Cuts the inside of the cart out of the camera picture and shrinks it to a small grey grid.
export function grabCartGrid(video, box) {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = GRID_W;
    canvas.height = GRID_H;
  }
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.max(0, (box.x + box.w * INSIDE) * vw);
  const sy = Math.max(0, (box.y + box.h * INSIDE) * vh);
  const sw = Math.min(vw - sx, box.w * (1 - 2 * INSIDE) * vw);
  const sh = Math.min(vh - sy, box.h * (1 - 2 * INSIDE) * vh);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, GRID_W, GRID_H);
  const px = ctx.getImageData(0, 0, GRID_W, GRID_H).data;
  const grid = new Float32Array(GRID_W * GRID_H);
  for (let i = 0; i < grid.length; i += 1) {
    grid[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  return grid;
}

export const averageCartGrids = averageGrids;

// How much of the inside of the cart is different from the empty cart: 0 (same) to 1 (all different).
export function insideChanged(reference, grid) {
  return changedShare(reference, grid, { pixelLimit: ITEM_PIXEL_DIFF, margin: 0.05 });
}

export function saveEmptyCartPhoto(grid) {
  try {
    localStorage.setItem(PHOTO_KEY, JSON.stringify({ data: Array.from(grid, (v) => Math.round(v)), savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadEmptyCartPhoto() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHOTO_KEY));
    if (saved && saved.data && saved.data.length === GRID_W * GRID_H) {
      return { grid: Float32Array.from(saved.data), savedAt: saved.savedAt };
    }
  } catch (e) {
    /* nothing saved yet */
  }
  return null;
}

export function getItemLimit() {
  try {
    const n = Number(localStorage.getItem(LIMIT_KEY));
    return n >= 0.02 && n <= 0.6 ? n : DEFAULT_ITEM_LIMIT;
  } catch (e) {
    return DEFAULT_ITEM_LIMIT;
  }
}

export function setItemLimit(n) {
  try { localStorage.setItem(LIMIT_KEY, String(n)); } catch (e) { /* storage blocked */ }
}

// Staff can switch this check off in Admin > Settings > Camera.
export function isItemCheckOn() {
  try { return localStorage.getItem(CHECK_KEY) !== 'off'; } catch (e) { return true; }
}

export function setItemCheckOn(on) {
  try { localStorage.setItem(CHECK_KEY, on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
}
