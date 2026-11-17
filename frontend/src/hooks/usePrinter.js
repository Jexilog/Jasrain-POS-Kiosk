import { useEffect, useState } from 'react';
import { getPrinterState, onPrinterChange } from '../utils/printer';

// { status: 'off' | 'connecting' | 'ready' | 'error' | 'unsupported', name, error }
export function usePrinter() {
  const [state, setState] = useState(getPrinterState());
  useEffect(() => {
    setState(getPrinterState());
    return onPrinterChange(setState);
  }, []);
  return state;
}
