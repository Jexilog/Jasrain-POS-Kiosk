// Makes an in-store EAN-13 barcode (starts with 2) for items without one.
export function generateBarcode(existing = []) {
  const taken = new Set(existing);
  for (let tries = 0; tries < 50; tries += 1) {
    let digits = '2';
    for (let i = 0; i < 11; i += 1) digits += Math.floor(Math.random() * 10);
    let sum = 0;
    for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
    const code = digits + ((10 - (sum % 10)) % 10);
    if (!taken.has(code)) return code;
  }
  return String(Date.now()).slice(-13).padStart(13, '2');
}
