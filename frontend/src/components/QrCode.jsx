import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode'; // npm install qrcode

// Draws a QR code for `value`. It is always black on white so phone cameras can read it.
export default function QrCode({ value, size = 280, label = 'QR code' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let live = true;
    setSrc('');
    if (!value) return undefined;
    QRCode.toDataURL(value, { width: size * 2, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => live && setSrc(url))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value, size]);

  const box = { width: size, height: size };
  return src ? (
    <img className="qrImg" src={src} style={box} alt={label} />
  ) : (
    <div className="qrImg qrBlank" style={box} aria-hidden="true" />
  );
}
