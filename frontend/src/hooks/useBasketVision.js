import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHECK_EVERY_MS, EMPTY_PIXEL_DIFF, EMPTY_MAX_CHANGED,
} from '../utils/vision';
import { grabGrid, averageGrids, changedShare, saveReference, loadReference, makeVote } from '../utils/emptyCheck';

// Watches the basket and says what is in it.
//   status: 'starting' | 'empty' | 'items' | 'needsReference' | 'error'
//     items          = the basket differs from its saved empty reference
//     needsReference = staff must save a photo of the empty basket first
//   changed: how much of the picture differs from the empty basket (0 to 1), or null
//   ms:      how long one check takes, so you can tell if the computer is fast enough
export function useBasketVision(videoRef) {
  const [state, setState] = useState({
    status: 'starting', items: [], unknown: 0, boxes: [], error: '',
    changed: null, hasReference: false, modelReady: false, ms: null,
  });

  const referenceRef = useRef(loadReference());
  const voteRef = useRef(makeVote());

  useEffect(() => {
    let stopped = false;
    let timer;
    let stream;
    const times = [];
    voteRef.current.reset();

    const fail = (message) => !stopped && setState((s) => ({ ...s, status: 'error', error: message }));

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('Camera access is unavailable. Open Jasrain on localhost or through HTTPS, then allow camera access.');
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        } catch (first) {
          // Some webcams refuse a requested size, so retry with the browser default.
          if (first.name === 'NotAllowedError') throw first;
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (err) {
        fail(err.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow camera access for this site.' : `Camera problem: ${err.message}`);
        return;
      }
      const loop = async () => {
        if (stopped) return;
        const started = performance.now();
        try {
          // compare with the saved photo of the empty basket
          let changed = null;
          const reference = referenceRef.current;
          const video = videoRef.current;
          if (reference && video && video.videoWidth) {
            changed = changedShare(reference.grid, grabGrid(video), { pixelLimit: EMPTY_PIXEL_DIFF });
            voteRef.current.push(changed > EMPTY_MAX_CHANGED);
          }
          const somethingThere = voteRef.current.ready() ? voteRef.current.notEmpty() : false;

          let status;
          if (!reference) status = 'needsReference';
          else if (!voteRef.current.ready()) status = 'starting';
          else if (somethingThere) status = 'items';
          else status = 'empty';

          times.push(performance.now() - started);
          if (times.length > 5) times.shift();

          if (!stopped) {
            setState({
              status, items: [], unknown: 0, boxes: [], error: '', changed,
              hasReference: Boolean(reference), modelReady: false,
              ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
            });
          }
        } catch (err) {
          fail(`Detection stopped: ${err.message}`);
          return;
        }
        timer = setTimeout(loop, CHECK_EVERY_MS);
      };
      loop();
    };
    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  // Saves what the camera sees now as "the basket is empty". Staff do this once, with an empty basket in place.
  const saveEmptyPhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return { ok: false, error: 'The camera is not ready yet.' };
    const grids = [];
    for (let i = 0; i < 5; i += 1) {
      grids.push(grabGrid(video));
      await new Promise((r) => setTimeout(r, 150));
    }
    const grid = averageGrids(grids);
    if (!saveReference(grid)) return { ok: false, error: 'Could not save it (browser storage is blocked).' };
    referenceRef.current = { grid, savedAt: Date.now() };
    voteRef.current.reset();
    return { ok: true };
  }, [videoRef]);

  return { ...state, saveEmptyPhoto };
}
