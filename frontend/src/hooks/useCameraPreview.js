import { useCallback, useEffect, useRef, useState } from 'react';
import { CHECK_EVERY_MS } from '../utils/vision';
import { openCamera, isCameraOn } from '../utils/camera';
import { createCartDetector } from '../utils/cartModel';
import { makeVote } from '../utils/emptyCheck';
import { makePresence } from '../utils/cartPresence';
import { getMinScore } from '../utils/cartModel';
import { isPiCart, cartUrl } from '../utils/piCart';
import {
  grabCartGrid, averageCartGrids, insideChanged, saveEmptyCartPhoto, loadEmptyCartPhoto, getItemLimit,
} from '../utils/cartContents';

// Shows what the camera sees in a <video> and uses the cart model to tell if the cart (basket) is there.
// With the camera on the Raspberry Pi (see utils/piCart.js) the Pi does the looking: this asks it twice a second
// and shows its picture in the same <video>, so the rest of the kiosk works the same.
//   camera: 'off' | 'starting' | 'ready' | 'blocked' | 'missing' | 'error'
//   basket: 'unknown' | 'noModel' | 'empty' | 'present'   (is the cart there?)
//   items:  'unknown' | 'noPhoto' | 'none' | 'some'       (is something INSIDE the cart?)
//   inside: how much of the inside differs from the empty cart (0 to 1), or null
//   boxes:  the carts the model sees right now, to draw on the picture
//   score:  how sure the model is (0 to 1), or null
//   ms:     how long one check takes
//   saveEmptyCart(): staff press this with an EMPTY cart in view
export function useCameraPreview(videoRef) {
  const [state, setState] = useState({
    camera: isCameraOn() ? 'starting' : 'off', basket: 'unknown', items: 'unknown', inside: null,
    boxes: [], score: null, best: null, ms: null, message: '', hasPhoto: false, photoSavedAt: null,
  });
  const boxRef = useRef(null);
  const referenceRef = useRef(loadEmptyCartPhoto());
  const itemVote = useRef(makeVote());

  // Camera on the Pi: ask it for the answer, and show its picture.
  useEffect(() => {
    if (!isPiCart() || !isCameraOn()) return undefined;

    let stopped = false;
    let stateTimer;
    let pictureTimer;
    let attached = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const poll = async () => {
      try {
        const query = new URLSearchParams({ on: '1', score: String(getMinScore()), limit: String(getItemLimit()) });
        const res = await fetch(`${cartUrl()}/cart/state?${query}`, { cache: 'no-store' });
        const s = await res.json();
        if (!stopped) setState((prev) => ({ ...prev, ...s, camera: s.camera === 'off' ? 'starting' : s.camera }));
      } catch (e) {
        if (!stopped) {
          setState((prev) => ({
            ...prev, camera: 'error', basket: 'unknown', items: 'unknown', inside: null, boxes: [], score: null,
            message: `Cannot reach the Pi camera (${cartUrl()}).`,
          }));
        }
      }
      if (!stopped) stateTimer = setTimeout(poll, 500);
    };

    // The Pi's picture is drawn on a canvas that feeds the <video>, so the existing screens need no change.
    const picture = async () => {
      try {
        const res = await fetch(`${cartUrl()}/cart/preview.jpg?n=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && !stopped) {
          const bitmap = await createImageBitmap(await res.blob());
          if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
          }
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          if (!attached && videoRef.current) {
            videoRef.current.srcObject = canvas.captureStream(15);
            videoRef.current.play().catch(() => {});
            attached = true;
          }
        }
      } catch (e) { /* the state poll shows the problem */ }
      if (!stopped) pictureTimer = setTimeout(picture, 80);
    };

    poll();
    picture();
    return () => {
      stopped = true;
      clearTimeout(stateTimer);
      clearTimeout(pictureTimer);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [videoRef]);

  useEffect(() => {
    if (isPiCart() || !isCameraOn()) return undefined;

    let stopped = false;
    let timer;
    let stream;
    let detector = null;
    const presence = makePresence();
    const times = [];
    itemVote.current.reset();
    let lastBox = null;
    let wasSome = false;

    const loop = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (detector && video && video.videoWidth) {
        const started = performance.now();
        try {
          // once the cart is there, it keeps counting at a lower bar, so a dip in sureness does not lose it
          const bar = presence.present() ? getMinScore() * 0.7 : getMinScore();
          const boxes = await detector.detect(video, bar);
          presence.push(boxes.length > 0);
          // The cart may be missed for a single check. While it still counts as there, keep using
          // the last place it was seen, so the item answer does not flicker and let Pay through.
          const present = presence.present();
          if (boxes[0]) lastBox = boxes[0];
          const box = boxes[0] || (present ? lastBox : null);
          boxRef.current = box;

          // is something inside the cart?
          let items = 'unknown';
          let inside = null;
          if (box && present) {
            const reference = referenceRef.current;
            if (!reference) {
              items = 'noPhoto';
            } else {
              inside = insideChanged(reference.grid, grabCartGrid(video, box));
              // once an item is seen, it takes a clearly smaller change to say the cart is empty again
              const limit = getItemLimit() * (wasSome ? 0.7 : 1);
              itemVote.current.push(inside > limit);
              if (itemVote.current.ready()) {
                items = itemVote.current.notEmpty() ? 'some' : 'none';
                wasSome = items === 'some';
              }
            }
          } else {
            itemVote.current.reset();
            wasSome = false;
          }

          times.push(performance.now() - started);
          if (times.length > 5) times.shift();
          if (!stopped) {
            setState((s) => ({
              ...s,
              boxes,
              score: boxes.length ? Math.max(...boxes.map((b) => b.score)) : null,
              ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
              best: boxes.best,
              basket: presence.ready() ? (presence.present() ? 'present' : 'empty') : s.basket,
              items: present && items === 'unknown' && (s.items === 'some' || s.items === 'none') ? s.items : (present ? items : 'unknown'),
              inside,
            }));
          }
        } catch (err) {
          if (!stopped) setState((s) => ({ ...s, basket: 'noModel', message: err.message }));
          return;
        }
      }
      timer = setTimeout(loop, CHECK_EVERY_MS);
    };

    (async () => {
      try {
        stream = await openCamera();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState((s) => ({ ...s, camera: 'ready' }));
      } catch (err) {
        if (stopped) return;
        const camera = err.name === 'NotAllowedError' ? 'blocked' : err.name === 'NotFoundError' || err.name === 'OverconstrainedError' ? 'missing' : 'error';
        setState((s) => ({ ...s, camera, message: err.message || '' }));
        return;
      }
      try {
        detector = await createCartDetector();
      } catch (err) {
        if (!stopped) setState((s) => ({ ...s, basket: 'noModel', message: err.message }));
        return;
      }
      loop();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  // Saves what the inside of the cart looks like now as "the cart is empty".
  const saveEmptyCart = useCallback(async () => {
    if (isPiCart()) {
      try {
        const res = await fetch(`${cartUrl()}/cart/empty-photo`, { method: 'POST' });
        return await res.json();
      } catch (e) {
        return { ok: false, error: 'Cannot reach the Pi camera.' };
      }
    }
    const video = videoRef.current;
    if (!video || !video.videoWidth) return { ok: false, error: 'The camera is not ready yet.' };
    const grids = [];
    for (let i = 0; i < 5; i += 1) {
      if (!boxRef.current) return { ok: false, error: 'The cart is not in view. Put the empty cart under the camera first.' };
      grids.push(grabCartGrid(video, boxRef.current));
      await new Promise((r) => setTimeout(r, 150));
    }
    const grid = averageCartGrids(grids);
    if (!saveEmptyCartPhoto(grid)) return { ok: false, error: 'Could not save it (browser storage is blocked).' };
    referenceRef.current = { grid, savedAt: Date.now() };
    itemVote.current.reset();
    return { ok: true };
  }, [videoRef]);

  return { ...state, saveEmptyCart };
}
