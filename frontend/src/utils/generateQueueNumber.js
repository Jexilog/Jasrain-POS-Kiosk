// generateQueueNumber(1) -> "P001"
export function generateQueueNumber(counter) {
  return `P${String(counter).padStart(3, '0')}`;
}
