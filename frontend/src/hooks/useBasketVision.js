import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  VISION_MODE, CHECK_EVERY_MS, EMPTY_PIXEL_DIFF, EMPTY_MAX_CHANGED,
  makeSmoother, createSimulatorDetector, createModelDetector,
} from '../utils/vision';
import { grabGrid, averageGrids, changedShare, saveReference, loadReference, makeVote } from '../utils/emptyCheck';
import { useProducts } from '../context/ProductContext';

// Watches the basket and says what is in it.
//   status: 'starting' | 'empty' | 'items' | 'unnamed' | 'needsReference' | 'error'
//     items          = we recognise products in the basket
//     unnamed        = something is in the basket that is not one of our products
//     needsReference = no photo of the empty basket saved yet (camera without a model)
//   items:   [{ barcode, name, quantity, score }]
//   unknown: how many things are seen that are not our products
//   boxes:   what the model sees right now (to draw on the picture)
//   changed: how much of the picture differs from the empty basket (0 to 1), or null
//   ms:      how long one check takes, so you can tell if the computer is fast enough
export function useBasketVision(videoRef) {
  const { getProduct } = useProducts();
  const [state, setState] = useState({
    status: 'starting', items: [], unknown: 0, boxes: [], error: '',
    changed: null, hasReference: false, modelReady: false, ms: null,
  });
  const [photo, setPhoto] = useState(null); // { url, boxes } while testing with a picture

  const simulator = useMemo(() => (VISION_MODE === 'simulator' ? createSimulatorDetector() : null), []);
  const lookup = useRef(getProduct);
  lookup.current = getProduct;
  const detectorRef = useRef(null);
  const referenceRef = useRef(loadReference());
  const voteRef = useRef(makeVote());

  useEffect(() => {
    let stopped = false;
    let timer;
    let stream;
    const smoother = makeSmoother();
    const times = [];
    voteRef.current.reset();

    const fail = (message) => !stopped && setState((s) => ({ ...s, status: 'error', error: message }));

    const run = async () => {
      let detector = simulator;
      let modelReady = Boolean(simulator);

      if (!simulator) {
        try {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          } catch (first) {
            // some cheap cameras refuse a requested size, so ask again without one
            if (first.name === 'NotAllowedError') throw first;
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
          if (stopped) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        } catch (err) {
          fail(err.name === 'NotAllowedError' ? 'Camera permission was blocked.' : `Camera problem: ${err.message}`);
          return;
        }
        // no model yet is fine: the empty-basket check still works on its own
        try {
          detector = await createModelDetector();
          modelReady = true;
        } catch (err) {
          detector = null;
        }
      }
      detectorRef.current = detector && !simulator ? detector : null;

      const loop = async () => {
        if (stopped) return;
        const started = performance.now();
        try {
          let boxes = [];
          let known = [];
          let unknown = 0;
          let ready = true;

          if (detector) {
            boxes = await detector.detect(videoRef.current);
            smoother.push(boxes);
            const result = smoother.result();
            ready = result.ready;
            result.items.forEach((it) => {
              const p = lookup.current(it.barcode);
              if (p) known.push({ ...it, name: p.name });
              else unknown += it.quantity;
            });
          }

          // compare with the saved photo of the empty basket
          let changed = null;
          const reference = referenceRef.current;
          const video = videoRef.current;
          if (!simulator && reference && video && video.videoWidth) {
            changed = changedShare(reference.grid, grabGrid(video), { pixelLimit: EMPTY_PIXEL_DIFF });
            voteRef.current.push(changed > EMPTY_MAX_CHANGED);
          }
          const somethingThere = voteRef.current.ready() ? voteRef.current.notEmpty() : false;

          let status;
          if (!ready || (changed !== null && !voteRef.current.ready())) status = 'starting';
          else if (known.length || unknown) status = 'items';
          else if (!simulator && !reference) status = modelReady ? 'empty' : 'needsReference';
          else if (somethingThere) status = modelReady ? 'unnamed' : 'items';
          else status = 'empty';

          times.push(performance.now() - started);
          if (times.length > 5) times.shift();

          if (!stopped) {
            setState({
              status, items: known, unknown, boxes, error: '', changed,
              hasReference: Boolean(reference), modelReady,
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
  }, [simulator, videoRef]);

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

  // Runs the model on a picture from the phone or computer instead of the live camera.
  const testPhoto = useCallback(async (file) => {
    if (!detectorRef.current) return { ok: false, error: 'No model is installed yet.' };
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const boxes = await detectorRef.current.detect(img);
      setPhoto((old) => { if (old) URL.revokeObjectURL(old.url); return { url, boxes }; });
      return { ok: true };
    } catch (err) {
      URL.revokeObjectURL(url);
      return { ok: false, error: `Could not read that picture: ${err.message}` };
    }
  }, []);

  const closePhoto = useCallback(() => {
    setPhoto((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
  }, []);

  return { ...state, simulator, photo, saveEmptyPhoto, testPhoto, closePhoto };
}