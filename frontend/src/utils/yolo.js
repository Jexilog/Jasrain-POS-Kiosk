// Turns the raw numbers from a YOLOv8 ONNX model into a list of boxes.
// Kept separate from the camera code so it can be tested on its own.

export const INPUT_SIZE = 640;

// Fits the video frame inside a 640 x 640 square without stretching it.
// Returns what is needed to map boxes back to the original picture.
export function letterbox(width, height, size = INPUT_SIZE) {
  const scale = Math.min(size / width, size / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { scale, w, h, padX: Math.floor((size - w) / 2), padY: Math.floor((size - h) / 2) };
}

const overlap = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

// data: Float32Array shaped [4 + classCount, boxCount] (YOLOv8 output without the batch dimension)
// frame: the letterbox() result, so boxes come back as 0..1 of the original picture
export function decodeYolo(data, classCount, boxCount, frame, { minScore = 0.4, maxOverlap = 0.5 } = {}) {
  const found = [];

  for (let i = 0; i < boxCount; i += 1) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < classCount; c += 1) {
      const s = data[(4 + c) * boxCount + i];
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (bestScore < minScore) continue;

    const cx = data[i];
    const cy = data[boxCount + i];
    const w = data[2 * boxCount + i];
    const h = data[3 * boxCount + i];
    found.push({
      classId: best,
      score: bestScore,
      // undo the padding and the resize, then scale to 0..1
      x: (cx - w / 2 - frame.padX) / frame.w,
      y: (cy - h / 2 - frame.padY) / frame.h,
      w: w / frame.w,
      h: h / frame.h,
    });
  }

  // when boxes sit on top of each other, keep the most confident one
  found.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const box of found) {
    if (!kept.some((k) => k.classId === box.classId && overlap(k, box) > maxOverlap)) kept.push(box);
  }
  return kept;
}