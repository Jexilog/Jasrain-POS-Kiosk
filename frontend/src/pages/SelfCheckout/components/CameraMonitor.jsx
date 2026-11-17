import React from 'react';
import Icon from '../../../components/Icon';
import { useKiosk } from '../../../context/KioskContext';

const CAMERA_TEXT = {
  off: 'Camera is off',
  starting: 'Starting camera...',
  ready: 'Camera detected',
  blocked: 'Camera blocked. Allow it in the browser.',
  missing: 'No camera found',
  error: 'Camera problem',
};

const BASKET_TEXT = {
  unknown: 'Looking for the basket...',
  noModel: 'Cart model not installed',
  empty: 'No basket detected',
  present: 'Basket detected',
};

// A small live picture of what the camera sees, with two lines of text under it.
export default function CameraMonitor({ videoRef, cam }) {
  const { t } = useKiosk();
  const { camera, basket, items, message } = cam;

  const camOk = camera === 'ready';
  const present = basket === 'present';

  return (
    <div className="camMonitor" aria-label="Camera status">
      <div className={`camVideoBox${present ? ' found' : ''}`}>
        <video ref={videoRef} className="camVideo" muted playsInline />
        {!camOk && <div className="camVideoNote"><Icon name="camera" size={22} /></div>}
      </div>

      <div className="camText">
        <div className={`camLine ${camOk ? 'good' : camera === 'off' ? '' : 'bad'}`}>
          <Icon name={camOk ? 'check-circle' : camera === 'off' ? 'camera' : 'alert'} size={18} />
          <span>{t(CAMERA_TEXT[camera])}</span>
        </div>
        {camOk && (
          <div className={`camLine ${present ? 'good' : basket === 'noModel' ? 'bad' : ''}`}>
            <Icon name={present ? 'cart' : 'clock'} size={18} />
            <span>{t(BASKET_TEXT[basket])}</span>
          </div>
        )}
        {camOk && basket === 'present' && (items === 'some' || items === 'none') && (
          <div className={`camLine ${items === 'some' ? 'bad' : 'good'}`}>
            <Icon name={items === 'some' ? 'alert' : 'check-circle'} size={18} />
            <span>{items === 'some' ? t('Item left in basket') : t('Basket is empty inside')}</span>
          </div>
        )}
        {camOk && basket === 'present' && items === 'noPhoto' && (
          <div className="camLine bad">
            <Icon name="alert" size={18} />
            <span>{t('Staff: save the empty cart photo in Settings')}</span>
          </div>
        )}
        {camera === 'error' && message && <small className="camSmall">{message}</small>}
      </div>
    </div>
  );
}
