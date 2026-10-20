import React, { createContext, useContext, useState } from 'react';
import { calculateTotal } from '../utils/calculateTotal';
import { findProduct } from '../utils/productCatalog';

const CartContext = createContext();

// Cart item shape: { barcode, name, price (unit), quantity }
export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (product, qty = 1) => {
    setCart((current) => {
      const exists = current.some((item) => item.barcode === product.barcode);
      if (exists) {
        return current.map((item) =>
          item.barcode === product.barcode
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...current, { ...product, quantity: qty }];
    });
  };

  // Use this with the barcode scanner
  // Returns true if the item was added, false if the barcode is unknown
  const addItemByBarcode = (barcode) => {
    const product = findProduct(barcode);
    if (!product) return false;
    addToCart(product);
    return true;
  };

  const removeFromCart = (barcode) =>
    setCart((current) => current.filter((item) => item.barcode !== barcode));

  const removeLastItem = () =>
    setCart((current) => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      if (last.quantity > 1) {
        return current.map((item, i) =>
          i === current.length - 1 ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return current.slice(0, -1);
    });

  const updateQuantity = (barcode, quantity) =>
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.barcode !== barcode)
        : current.map((item) =>
            item.barcode === barcode ? { ...item, quantity } : item
          )
    );

  const clearCart = () => setCart([]);

  const total = calculateTotal(cart);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addItemByBarcode,
        removeFromCart,
        updateQuantity,
        removeLastItem,
        clearCart,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}