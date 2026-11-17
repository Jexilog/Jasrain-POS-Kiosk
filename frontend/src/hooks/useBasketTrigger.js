import { useEffect, useRef, useState } from 'react';
import { CHECK_EVERY_MS } from '../utils/vision';
import { openCamera, isCameraOn } from '../utils/camera';
import { createCartDetector, getMinScore } from '../utils/cartModel';
import { makePresence } from '../utils/cartPresence';

// Watches the basket spot from the start screen with the cart model.
// When a cart is seen there, it calls onBasket().
//
// It waits until it has seen the spot EMPTY first. So a customer who comes back from checkout
// still holding the basket does not start a new checkout by accident.
//
// status: 'off' | 'starting' | 'ready' | 'found' | 'noModel' | 'error'
export function useBasketTrigger(onBasket, enabled = true) {
  const [status, setStatus] = useState('off');
  const callback = useRef(onBasket);
  callback.current = onBasket;

  useEffect(() => {
    if (!enabled || !isCameraOn()) {
      setStatus('off');
      return undefined;
    }

    let stopped = false;
    let timer;
    let stream;
    let armed = false;
    let fired = false;
    const presence = makePresence();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    setStatus('starting');

    (async () => {
      let detector;
      try {
        stream = await openCamera();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        if (!stopped) setStatus('error');
        return;
      }
      try {
        detector = await createCartDetector();
      } catch (err) {
        if (!stopped) setStatus('noModel');
        return;
      }

      const loop = async () => {
        if (stopped) return;
        try {
          const bar = presence.present() ? getMinScore() * 0.7 : getMinScore();
          const boxes = await detector.detect(video, bar);
          presence.push(boxes.length > 0);
          if (presence.ready()) {
            if (!presence.present()) {
              armed = true;
              if (!stopped) setStatus('ready');
            } else if (armed && !fired) {
              fired = true;
              setStatus('found');
              callback.current();
              return;
            }
          }
        } catch (err) {
          if (!stopped) setStatus('error');
          return;
        }
        timer = setTimeout(loop, CHECK_EVERY_MS);
      };
      loop();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [enabled]);

  return status;
}
