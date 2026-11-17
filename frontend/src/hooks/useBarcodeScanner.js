import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const currentTime = Date.now();
      
      // scanners type very fast (under 30ms between keys)
      if (currentTime - lastKeyTimeRef.current > 100) {
        bufferRef.current = ''; // slow typing means a person, not a scanner
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          // don't let the scanner's Enter click the focused button
          e.preventDefault();
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}