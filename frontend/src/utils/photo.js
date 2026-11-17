// Turns a picture (a file or a frame from the camera) into a small square JPEG.
// The whole item stays in the picture: it is fitted inside a white square, not cropped.
export async function toSquareJpeg(source, size = 480) {
  const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement;
  const image = isVideo ? source : await createImageBitmap(source);
  const w = isVideo ? source.videoWidth : image.width;
  const h = isVideo ? source.videoHeight : image.height;
  const scale = Math.min(size / w, size / h);
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);
  if (!isVideo && image.close) image.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
