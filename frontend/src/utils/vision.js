// Basket camera settings.
// This build uses the live webcam plus an empty-basket reference image.
// No object-detection model is needed for EMPTY / NOT EMPTY mode.
export const VISION_MODE = 'camera';
export const CHECK_EVERY_MS = 500;               // how often the camera is checked

// Empty-basket check (works without a trained model)
export const EMPTY_PIXEL_DIFF = 25;  // how different a spot must look (0 to 255) to count as changed
export const EMPTY_MAX_CHANGED = 0.04; // more than 4% of the picture changed = something is in the basket

// ---------------------------------------------------------------- pretend camera
// Same job as the real detector: detect() says what it sees. Here "what it sees" is
// whatever you put in the pretend basket with the buttons.
export function createSimulatorDetector() {
  const basket = {}; // barcode -> how many
  const spots = {};  // barcode -> where it sits in the picture

  const spotFor = (code, i) => {
    const key = `${code}-${i}`;
    if (!spots[key]) spots[key] = { x: 0.08 + Math.random() * 0.62, y: 0.12 + Math.random() * 0.55 };
    return spots[key];
  };

  return {
    kind: 'simulator',
    put(code) { basket[code] = (basket[code] || 0) + 1; },
    take(code) {
      if (!basket[code]) return;
      basket[code] -= 1;
      if (basket[code] === 0) delete basket[code];
    },
    clear() { Object.keys(basket).forEach((c) => delete basket[c]); },
    contents() { return { ...basket }; },
    async detect() {
      const found = [];
      Object.entries(basket).forEach(([code, qty]) => {
        for (let i = 0; i < qty; i += 1) {
          // a real camera misses things now and then, so the simulator does too
          if (Math.random() < 0.06) continue;
          const spot = spotFor(code, i);
          found.push({ barcode: code, score: 0.82 + Math.random() * 0.16, x: spot.x, y: spot.y, w: 0.2, h: 0.28 });
        }
      });
      return found;
    },
  };
}
