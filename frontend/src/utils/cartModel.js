import { letterbox, decodeYolo } from './yolo';

// Your trained "cart" model (YOLO11n, one class, 320 x 320 pictures).
export const CART_MODEL_URL = '/models/cart.onnx';
export const CART_SIZE = 320;
const SCORE_KEY = 'jasrain_cart_score';
export const DEFAULT_MIN_SCORE = 0.6; // ignore guesses below 60% sure

// Staff change this in Admin > Settings > Camera. It is read on every check, so it applies right away.
export function getMinScore() {
  try {
    const n = Number(localStorage.getItem(SCORE_KEY));
    return n >= 0.1 && n <= 0.99 ? n : DEFAULT_MIN_SCORE;
  } catch (e) {
    return DEFAULT_MIN_SCORE;
  }
}

export function setMinScore(n) {
  try { localStorage.setItem(SCORE_KEY, String(n)); } catch (e) { /* storage blocked */ }
}

// Loads the model once. detect(video) returns the carts it sees: [{ score, x, y, w, h }] (x, y, w, h are 0 to 1).
export async function createCartDetector() {
  const ort = await import('onnxruntime-web');
  // the engine's .wasm files load from the web the first time, then the browser keeps them
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

  let session;
  try {
    session = await ort.InferenceSession.create(CART_MODEL_URL);
  } catch (err) {
    const missing = new Error('cart.onnx was not found in public/models');
    missing.name = 'ModelMissing';
    throw missing;
  }

  const canvas = document.createElement('canvas');
  canvas.width = CART_SIZE;
  canvas.height = CART_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return {
    // minScore: how sure the model must be. best: the model's top guess, even when it is below minScore.
    async detect(video, minScore = getMinScore()) {
      if (!video || !video.videoWidth) return [];
      const frame = letterbox(video.videoWidth, video.videoHeight, CART_SIZE);

      ctx.fillStyle = '#727272'; // grey padding, the same the model was trained with
      ctx.fillRect(0, 0, CART_SIZE, CART_SIZE);
      ctx.drawImage(video, frame.padX, frame.padY, frame.w, frame.h);
      const pixels = ctx.getImageData(0, 0, CART_SIZE, CART_SIZE).data;

      // RGBA pixels -> three flat colour layers, scaled 0..1
      const size = CART_SIZE * CART_SIZE;
      const input = new Float32Array(3 * size);
      for (let i = 0; i < size; i += 1) {
        input[i] = pixels[i * 4] / 255;
        input[size + i] = pixels[i * 4 + 1] / 255;
        input[2 * size + i] = pixels[i * 4 + 2] / 255;
      }

      const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, CART_SIZE, CART_SIZE]) });
      const result = output[session.outputNames[0]];
      const boxCount = result.dims[2];
      let best = 0;
      for (let i = 0; i < boxCount; i += 1) best = Math.max(best, result.data[4 * boxCount + i]);
      const found = decodeYolo(result.data, 1, boxCount, frame, { minScore });
      found.best = best;
      return found;
    },
  };
}
