// barcode lookup built from products.js
import { products } from './products';

export const productCatalog = Object.fromEntries(
  products.map((p) => [p.barcode, { name: p.name, price: p.price }])
);

// returns { barcode, name, price } or null
export function findProduct(barcode) {
  const found = productCatalog[barcode];
  return found ? { barcode, ...found } : null;
}
