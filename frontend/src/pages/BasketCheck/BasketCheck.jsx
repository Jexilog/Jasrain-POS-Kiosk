import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { useBasketVision } from '../../hooks/useBasketVision';
import { EMPTY_MAX_CHANGED } from '../../utils/vision';
import Icon from '../../components/Icon';
import './BasketCheck.css';

const STATUS = {
  starting: { icon: 'clock', text: 'Looking at the basket...' },
  empty: { icon: 'check-circle', text: 'Basket is empty' },
  items: { icon: 'cart', text: 'Items in the basket' },
  unnamed: { icon: 'alert', text: 'Something is in the basket' },
  needsReference: { icon: 'camera', text: 'Save a photo of the empty basket first' },
  error: { icon: 'alert', text: 'Camera problem' },
};

export default function BasketCheck() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useKiosk();
  const { activeProducts, getProduct } = useProducts();
  const { isAuthenticated } = useAuth();
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const v = useBasketVision(videoRef);
  const { status, items, unknown, error, simulator, photo } = v;

  const boxes = photo ? photo.boxes : v.boxes;
  const total = items.reduce((n, i) => n + i.quantity, 0) + unknown;
  const nameOf = (code) => getProduct(code)?.name || 'Not recognised';
  const label = STATUS[status];

  const saveEmpty = async () => {
    const r = await v.saveEmptyPhoto();
    if (r.ok) toast.success('Saved. This is now what an empty basket looks like.');
    else toast.error(r.error);
  };

  const onPhoto = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = await v.testPhoto(f);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className={`basketScreen ${theme}Mode`}>
      <header className="basketHeader">
        <button className="basketBack" onClick={() => navigate('/')}><Icon name="arrow-left" size={20} /> Back</button>
        <h1>Basket check</h1>
        <button className="basketBack" onClick={toggleTheme} aria-label="Switch theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
        </button>
      </header>

      <main className="basketBody">
        <section className="basketView" aria-label="Camera view">
          {simulator && <div className="basketFake"><span>Pretend camera</span></div>}
          {!simulator && <video ref={videoRef} className="basketVideo" muted playsInline />}
          {photo && <img className="basketPhoto" src={photo.url} alt="The picture being tested" />}
          {boxes.map((b, i) => (
            <div
              key={i}
              className={`basketBox ${getProduct(b.barcode) ? '' : 'unknown'}`}
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
            >
              <span>{nameOf(b.barcode)} {Math.round(b.score * 100)}%</span>
            </div>
          ))}
        </section>

        <section className="basketSide">
          <div className={`basketStatus ${status}`}>
            <Icon name={label.icon} size={30} />
            <div>
              <strong>{label.text}</strong>
              {status === 'items' && total > 0 && <small>{total} item{total === 1 ? '' : 's'} seen</small>}
              {status === 'items' && total === 0 && <small>The camera sees something there.</small>}
              {status === 'unnamed' && <small>It is not one of our products. Ask staff for help.</small>}
              {status === 'empty' && <small>You can go to checkout.</small>}
              {status === 'error' && <small>{error}</small>}
            </div>
          </div>

          {unknown > 0 && (
            <div className="basketWarn"><Icon name="alert" size={18} /> {unknown} item{unknown === 1 ? '' : 's'} not recognised. Ask staff for help.</div>
          )}

          {items.length > 0 && (
            <ul className="basketList">
              {items.map((i) => (
                <li key={i.barcode}>
                  <span>{i.name}</span>
                  <b>x{i.quantity}</b>
                  <small>{Math.round(i.score * 100)}% sure</small>
                </li>
              ))}
            </ul>
          )}

          {!simulator && (
            <div className="basketTools">
              <div className="basketSimTag">CAMERA TOOLS</div>
              <dl className="basketFacts">
                <div><dt>One check takes</dt><dd>{v.ms == null ? '...' : `${v.ms} ms`}</dd></div>
                <div><dt>Model</dt><dd>{v.modelReady ? 'installed' : 'not installed (empty check only)'}</dd></div>
                <div><dt>Different from empty</dt><dd>{v.changed == null ? 'no empty photo yet' : `${(v.changed * 100).toFixed(1)}% (limit ${EMPTY_MAX_CHANGED * 100}%)`}</dd></div>
              </dl>
              {isAuthenticated ? (
                <button className="basketClear" onClick={saveEmpty}>Save photo of the empty basket</button>
              ) : (
                <p className="basketNote">Staff must sign in on the staff screen to save the empty basket photo.</p>
              )}
              {v.modelReady && (
                <>
                  <button className="basketClear" onClick={() => fileRef.current && fileRef.current.click()}>Test with a photo</button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
                  {photo && <button className="basketClear" onClick={v.closePhoto}>Back to the live camera</button>}
                </>
              )}
            </div>
          )}

          {simulator && (
            <div className="basketSim">
              <div className="basketSimTag">TEST PANEL · pretend camera</div>
              <div className="basketChips">
                {activeProducts.map((p) => (
                  <span className="basketChip" key={p.barcode}>
                    <button onClick={() => simulator.put(p.barcode)} title="Put in the basket">+ {p.name}</button>
                    <button onClick={() => simulator.take(p.barcode)} title="Take out" aria-label={`Take out ${p.name}`}>-</button>
                  </span>
                ))}
              </div>
              <button className="basketClear" onClick={() => simulator.clear()}>Empty the basket</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
