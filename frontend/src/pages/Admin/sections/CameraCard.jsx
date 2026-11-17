import React, { useEffect, useRef, useState } from 'react';
import { Card, Field } from '../components/ui';
import Icon from '../../../components/Icon';
import { useCameraPreview } from '../../../hooks/useCameraPreview';
import { getMinScore, setMinScore } from '../../../utils/cartModel';
import {
  isItemCheckOn, setItemCheckOn, getItemLimit, setItemLimit, loadEmptyCartPhoto,
} from '../../../utils/cartContents';
import { isCartRulesOn, setCartRulesOn } from '../../../utils/cartRules';
import { isCameraOn, setCameraOn, getCameraId, setCameraId, listCameras } from '../../../utils/camera';
import { isPiCart } from '../../../utils/piCart';

const CAMERA_TEXT = {
  starting: 'Starting camera...',
  ready: 'Camera is working.',
  blocked: 'Camera is blocked. Click the lock icon in the address bar and allow Camera. Also check Windows Settings > Privacy > Camera.',
  missing: 'No camera was found. Check the USB cable or try another USB port.',
  error: 'The camera could not start. Another app (Zoom, Teams, Camera) may be using it.',
};

const BASKET_TEXT = {
  unknown: 'Looking at the basket spot...',
  noModel: 'Cart model not found. Put cart.onnx in frontend/public/models/ and refresh.',
  empty: 'No cart seen.',
  present: 'Cart detected.',
};

// The live picture with a box drawn around the cart. It restarts when the parent changes its key.
function Live({ onReady }) {
  const videoRef = useRef(null);
  const { camera, basket, items, inside, boxes, score, best, ms, message, hasPhoto, photoSavedAt, saveEmptyCart } = useCameraPreview(videoRef);
  const [note, setNote] = useState('');
  // with the camera on the Pi, the empty cart photo is kept on the Pi
  const saved = isPiCart() ? (hasPhoto ? { savedAt: photoSavedAt } : null) : loadEmptyCartPhoto();

  const save = async () => {
    const r = await saveEmptyCart();
    setNote(r.ok ? 'Saved. This is now what an empty cart looks like.' : r.error);
  };

  useEffect(() => {
    if (camera === 'ready') onReady();
  }, [camera]);

  const box = boxes[0];

  return (
    <>
      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', aspectRatio: '16 / 9', background: '#0f172a', borderRadius: 10, display: 'block', objectFit: 'cover' }} />
        {box && (
          <div style={{
            position: 'absolute', border: '3px solid #22c55e', borderRadius: 6, pointerEvents: 'none',
            left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`,
          }}
          />
        )}
      </div>
      <p className="admMuted">{CAMERA_TEXT[camera]}{camera === 'error' && message ? ` (${message})` : ''}</p>
      {camera === 'ready' && (
        <p className="admMuted">
          {BASKET_TEXT[basket]}
          {score !== null ? ` ${Math.round(score * 100)}% sure.` : ''}
          {best !== null && best !== undefined ? ` Best guess now: ${Math.round(best * 100)}% (needs ${Math.round(getMinScore() * 100)}%).` : ''}
          {ms !== null ? ` One check takes ${ms} ms.` : ''}
        </p>
      )}
      {camera === 'ready' && basket === 'present' && (
        <p className="admMuted">
          {items === 'noPhoto' && 'Item check: no empty cart photo saved yet.'}
          {items === 'unknown' && 'Item check: looking...'}
          {items === 'none' && 'Item check: the cart is empty inside.'}
          {items === 'some' && 'Item check: something is in the cart.'}
          {inside !== null ? ` Inside changed: ${Math.round(inside * 100)}%.` : ''}
        </p>
      )}
      {camera === 'ready' && (
        <>
          <p className="admMuted">
            {saved ? `Empty cart photo saved on ${new Date(saved.savedAt).toLocaleString()}.` : 'Put the EMPTY cart under the camera, then press the button.'}
          </p>
          <div className="admToolbar">
            <button type="button" className="admBtn primary" onClick={save}><Icon name="camera" size={16} /> Save empty cart photo</button>
          </div>
          {note && <p className="admMuted">{note}</p>}
        </>
      )}
    </>
  );
}

export default function CameraCard() {
  const [cams, setCams] = useState([]);
  const [id, setId] = useState(getCameraId());
  const [run, setRun] = useState(0);
  const [on, setOn] = useState(isCameraOn());
  const [rules, setRules] = useState(isCartRulesOn());
  const [itemCheck, setItemCheck] = useState(isItemCheckOn());
  const [itemPercent, setItemPercent] = useState(Math.round(getItemLimit() * 100));

  const toggleItemCheck = () => {
    setItemCheckOn(!itemCheck);
    setItemCheck(!itemCheck);
  };
  const changeItemPercent = (e) => {
    const n = Number(e.target.value);
    setItemPercent(n);
    setItemLimit(n / 100);
  };

  const toggleRules = () => {
    setCartRulesOn(!rules);
    setRules(!rules);
  };

  const toggle = () => {
    setCameraOn(!on);
    setOn(!on);
  };
  const [percent, setPercent] = useState(Math.round(getMinScore() * 100));

  const changePercent = (e) => {
    const n = Number(e.target.value);
    setPercent(n);
    setMinScore(n / 100);
  };

  const refresh = async () => {
    try { setCams(await listCameras()); } catch (e) { setCams([]); }
  };

  useEffect(() => { refresh(); }, []);

  const pick = (e) => {
    setCameraId(e.target.value);
    setId(e.target.value);
  };

  return (
    <Card title="Camera" subtitle="Self checkout uses the cart model to see if the basket is there. Hold the basket in view to test it.">
      <div className="admToolbar">
        <button type="button" className={`admBtn${on ? '' : ' primary'}`} onClick={toggle}>
          <Icon name="camera" size={16} /> {on ? 'Turn camera off' : 'Turn camera on'}
        </button>
      </div>
      <p className="admMuted">
        {on
          ? 'The camera is on. Self checkout and the start screen use it.'
          : 'The camera is off. Self checkout will not detect the basket and the start screen will not open by itself. Customers can still tap.'}
      </p>
      <div className="admToolbar">
        <button type="button" className={`admBtn${rules ? '' : ' primary'}`} onClick={toggleRules}>
          {rules ? 'Turn cart rules off' : 'Turn cart rules on'}
        </button>
      </div>
      <p className="admMuted">
        {rules
          ? 'Cart rules are on. Scanning is locked until a cart is seen, and a warning shows if the cart is taken away. They only apply while the camera is working.'
          : 'Cart rules are off. Customers can scan without a cart.'}
      </p>
      <div className="admToolbar">
        <button type="button" className={`admBtn${itemCheck ? '' : ' primary'}`} onClick={toggleItemCheck}>
          {itemCheck ? 'Turn item check off' : 'Turn item check on'}
        </button>
      </div>
      <p className="admMuted">
        {itemCheck
          ? 'Item check is on. If something is still inside the cart, Pay waits until it is scanned and taken out. It needs the empty cart photo below.'
          : 'Item check is off. Pay is never held because of what is inside the cart.'}
      </p>
      <div className="admForm">
        <Field label={`Item sensitivity: ${itemPercent}%`} hint="Something counts as an item when this much of the inside of the cart looks different from the empty cart. Lower = notices smaller items. Raise it if it sees an item in an empty cart.">
          <input type="range" min="3" max="40" step="1" value={itemPercent} onChange={changeItemPercent} />
        </Field>
      </div>
      {isPiCart() ? (
        <p className="admMuted">The camera is plugged into the Raspberry Pi. To use another camera, run cart_pi.py on the Pi with --camera 1 (or 2).</p>
      ) : (
      <div className="admForm">
        <Field label="Camera" hint="Press Try again if your camera is not in the list.">
          <select value={id} onChange={pick}>
            <option value="">Default camera</option>
            {cams.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
            ))}
          </select>
        </Field>
      </div>
      )}
      <div className="admForm">
        <Field label={`Cart sensitivity: ${percent}%`} hint="The model must be at least this sure to count a cart. Lower it if a real cart is missed. Raise it if it sees a cart that is not there.">
          <input type="range" min="30" max="95" step="5" value={percent} onChange={changePercent} />
        </Field>
      </div>
      {on && <Live key={`${id}-${run}`} onReady={refresh} />}
      <div className="admToolbar">
        {on && <button type="button" className="admBtn" onClick={() => setRun((n) => n + 1)}>Try again</button>}
      </div>
    </Card>
  );
}
