// Cash acceptor mode.
// 'simulator' = on-screen buttons for testing.
// 'hardware' = real bill/coin acceptor. Its driver calls accept(amount, kind), see hooks/useCashSession.js.
export const CASH_MODE = 'simulator';

export const COINS = [1, 5, 10, 20];
export const BILLS = [20, 50, 100, 200, 500, 1000];

// Same for the barcode scanner. 'simulator' shows a mock scan panel.
export const SCAN_MODE = 'simulator';
