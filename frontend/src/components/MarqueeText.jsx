import React, { useEffect, useRef, useState } from 'react';


export default function MarqueeText({ text, className = '' }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!boxRef.current || !innerRef.current) return;
      const extra = innerRef.current.scrollWidth - boxRef.current.clientWidth;
      setDist(extra > 2 ? Math.ceil(extra) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  return (
    <span ref={boxRef} className={`marquee ${className}`} title={text}>
      <span
        ref={innerRef}
        className={`marqueeInner ${dist ? 'run' : ''}`}
        style={{
          '--dist': `-${dist}px`,
          '--dur': `${Math.min(30, Math.max(6, dist / 25 + 4))}s`,
        }}
      >
        {text}
      </span>
    </span>
  );
}
