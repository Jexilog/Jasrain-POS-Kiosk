// Starter products, only used the first time the app runs.
// Add or edit products in the admin panel instead.
//
//  cost     = what you pay your supplier (used for profit reports)
//  stock    = how many you have right now
//  critical = alert level. At or below this number the item shows as "low" in the admin panel
export const products = [
  { barcode: '4800016021001', name: 'Coke Zero 330ml',        price: 35, cost: 28, category: 'Drinks', image: '', stock: 24, critical: 6 },
  { barcode: '4800016029009', name: 'Bottled Water 500ml',    price: 20, cost: 12, category: 'Drinks', image: '', stock: 40, critical: 10 },
  { barcode: '4800016025005', name: 'Bear Brand 33g',         price: 14, cost: 11, category: 'Drinks', image: '', stock: 30, critical: 8 },
  { barcode: '4800016027007', name: 'Kopiko Brown Coffee',    price: 8,  cost: 6,  category: 'Drinks', image: '', stock: 60, critical: 15 },
  { barcode: '4800016022002', name: 'Boy Bawang Garlic',      price: 30, cost: 23, category: 'Snacks', image: '', stock: 18, critical: 5 },
  { barcode: '4800016023003', name: 'Bracks Snack',           price: 35, cost: 28, category: 'Snacks', image: '', stock: 12, critical: 4 },
  { barcode: '4800016028008', name: 'Piattos Cheese',         price: 20, cost: 15, category: 'Snacks', image: '', stock: 4,  critical: 6 },
  { barcode: '4800016026006', name: 'Skyflakes',              price: 8,  cost: 6,  category: 'Snacks', image: '', stock: 45, critical: 12 },
  { barcode: '4800016024004', name: 'Lucky Me Pancit Canton', price: 16, cost: 12, category: 'Food',   image: '', stock: 36, critical: 10 },
  { barcode: '4800016030010', name: 'Safeguard Soap',         price: 38, cost: 30, category: 'Home',   image: '', stock: 15, critical: 5 },
];

export const categories = ['All', 'Drinks', 'Snacks', 'Food', 'Home'];
