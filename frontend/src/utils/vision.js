import { INPUT_SIZE, letterbox, decodeYolo } from './yolo';

// Basket camera settings.
// 'simulator' = a pretend camera with buttons, so you can test without the hardware.
// 'camera'    = the real webcam + your trained model (see training/README.md).
export const VISION_MODE = 'camera';

export const MODEL_URL = '/models/basket.onnx'; // put your trained model in frontend/public/models/
export const LABELS_URL = '/models/labels.json'; // list of barcodes, in the order the model was trained
export const MIN_SCORE = 0.5;                    // ignore guesses below 50% sure
export const CHECK_EVERY_MS = 500;               // how often the camera is checked
export const WINDOW = 5;                         // an item must be seen across the last 5 checks

// Empty-basket check (works without a trained model)
export const EMPTY_PIXEL_DIFF = 25;  // how different a spot must look (0 to 255) to count as changed
export const EMPTY_MAX_CHANGED = 0.04; // more than 4% of the picture changed = something is in the basket

// ---------------------------------------------------------------- steady results
// One camera frame can be wrong (a hand in the way, a blurry item). So we look at the last
// few frames and only trust what shows up in most of them.
export function makeSmoother(size = WINDOW) {
  const frames = [];

  return {
    push(detections) {
      const counts = {};
      detections.forEach((d) => {
        counts[d.barcode] = counts[d.barcode] || { n: 0, score: 0 };
        counts[d.barcode].n += 1;
        counts[d.barcode].score = Math.max(counts[d.barcode].score, d.score);
      });
      frames.push(counts);
      if (frames.length > size) frames.shift();
    },
    reset() {
      frames.length = 0;
    },
    // { ready, items: [{ barcode, quantity, score }] }
    result() {
      const need = Math.ceil(size * 0.6);
      const codes = new Set();
      frames.forEach((f) => Object.keys(f).forEach((c) => codes.add(c)));

      const items = [];
      codes.forEach((code) => {
        const seen = frames.filter((f) => f[code]);
        if (seen.length < need) return;
        const counts = seen.map((f) => f[code].n).sort((a, b) => a - b);
        items.push({
          barcode: code,
          quantity: counts[Math.floor(counts.length / 2)], // the middle value
          score: Math.max(...seen.map((f) => f[code].score)),
        });
      });
      return { ready: frames.length >= size, items };
    },
  };
}

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

// ---------------------------------------------------------------- real camera + model
// Loads the ONNX model once, then each detect(video) call returns the boxes it finds.
export async function createModelDetector() {
  const [ort, labels] = await Promise.all([
    import('onnxruntime-web'),
    fetch(LABELS_URL).then((r) => {
      if (!r.ok) throw new Error('labels.json was not found in public/models');
      return r.json();
    }),
  ]);
  // the engine's .wasm files load from the web the first time, then the browser keeps them
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
  const session = await ort.InferenceSession.create(MODEL_URL);

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return {
    kind: 'camera',
    // source: the <video>, or a photo (<img>) when testing with a picture
    async detect(source) {
      const width = source && (source.videoWidth || source.naturalWidth);
      const height = source && (source.videoHeight || source.naturalHeight);
      if (!width) return [];
      const video = source;
      const frame = letterbox(width, height);

      ctx.fillStyle = '#727272'; // grey padding, the same the model was trained with
      ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
      ctx.drawImage(video, frame.padX, frame.padY, frame.w, frame.h);
      const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

      // RGBA pixels -> three flat colour layers, scaled 0..1
      const size = INPUT_SIZE * INPUT_SIZE;
      const input = new Float32Array(3 * size);
      for (let i = 0; i < size; i += 1) {
        input[i] = pixels[i * 4] / 255;
        input[size + i] = pixels[i * 4 + 1] / 255;
        input[2 * size + i] = pixels[i * 4 + 2] / 255;
      }

      const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
      const result = output[session.outputNames[0]];
      const boxCount = result.dims[2];

      return decodeYolo(result.data, labels.length, boxCount, frame, { minScore: MIN_SCORE })
        .map((b) => ({ barcode: labels[b.classId], score: b.score, x: b.x, y: b.y, w: b.w, h: b.h }));
    },
  };
}
