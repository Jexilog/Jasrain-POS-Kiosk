// generateOrderNumber(1) -> "A001"
export function generateOrderNumber(counter) {
  return `A${String(counter).padStart(3, '0')}`;
}
