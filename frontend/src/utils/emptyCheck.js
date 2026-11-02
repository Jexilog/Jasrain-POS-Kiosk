// Tells if the basket still looks empty by comparing the camera picture with a saved photo of the
// empty basket. It needs no training. It only knows that something changed, not what it is.

export const GRID_W = 64;
export const GRID_H = 36;
const SAVE_KEY = 'jasrain_basket_empty';

let canvas = null;

// Shrinks the picture to a small grey grid. Shrinking also smooths away camera noise.
export function grabGrid(source) {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = GRID_W;
    canvas.height = GRID_H;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, GRID_W, GRID_H);
  const px = ctx.getImageData(0, 0, GRID_W, GRID_H).data;

  const grid = new Float32Array(GRID_W * GRID_H);
  for (let i = 0; i < grid.length; i += 1) {
    grid[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  return grid;
}

// Several frames averaged into one, so the saved photo is not a lucky or unlucky single frame.
export function averageGrids(grids) {
  const out = new Float32Array(GRID_W * GRID_H);
  grids.forEach((g) => g.forEach((v, i) => { out[i] += v / grids.length; }));
  return out;
}

// Takes away the overall brightness, so the room getting a bit lighter or darker is not "a change".
function evenOut(grid) {
  let sum = 0;
  grid.forEach((v) => { sum += v; });
  const mean = sum / grid.length;
  return grid.map((v) => v - mean);
}

// How much of the picture is different from the empty basket: 0 (same) to 1 (all different).
//   pixelLimit: how different a spot must be (0 to 255) to count
//   margin: the outer edge of the picture to ignore (shelf edges, a hand passing by)
export function changedShare(reference, current, { pixelLimit = 25, margin = 0.06 } = {}) {
  const a = evenOut(reference);
  const b = evenOut(current);
  const x0 = Math.floor(GRID_W * margin);
  const x1 = GRID_W - x0;
  const y0 = Math.floor(GRID_H * margin);
  const y1 = GRID_H - y0;

  let changed = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      if (Math.abs(a[y * GRID_W + x] - b[y * GRID_W + x]) > pixelLimit) changed += 1;
    }
  }
  return total ? changed / total : 0;
}

// The empty-basket photo is saved on this computer only, because it belongs to this camera.
export function saveReference(grid) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ data: Array.from(grid, (v) => Math.round(v)), savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadReference() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && saved.data && saved.data.length === GRID_W * GRID_H) {
      return { grid: Float32Array.from(saved.data), savedAt: saved.savedAt };
    }
  } catch (e) {
    /* nothing saved yet */
  }
  return null;
}

// Looks at the last few answers, so one odd frame does not flip the result.
export function makeVote(size = 5) {
  const last = [];
  return {
    push(notEmpty) {
      last.push(notEmpty);
      if (last.length > size) last.shift();
    },
    reset() { last.length = 0; },
    ready: () => last.length >= size,
    notEmpty: () => last.filter(Boolean).length > size / 2,
  };
}
