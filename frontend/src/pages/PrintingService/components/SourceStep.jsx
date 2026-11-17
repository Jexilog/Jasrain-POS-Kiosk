import React from 'react';
import Icon from '../../../components/Icon';
import { MESSENGER_PAGE, SHOP_EMAIL } from '../../../config/sendFile';
import { useKiosk } from '../../../context/KioskContext';

// Screen 1: how do you want to send your file?
export default function SourceStep({ maxMb, onPick, usbReady }) {
  const { t } = useKiosk();
  const ways = [
    {
      id: 'usb',
      icon: 'usb',
      title: t('USB flash drive'),
      text: t('Plug it into the front of the kiosk, then pick your file.'),
      tag: t('Ready right away'),
      ready: true,
    },
    {
      id: 'phone',
      icon: 'phone',
      title: t('Your phone'),
      text: t('Scan a code with your camera and upload the file from your phone.'),
      tag: t('No account needed'),
      ready: true,
    },
    {
      id: 'messenger',
      icon: 'message',
      title: 'Messenger',
      text: t('Send the file to {page} on Messenger, then find it here.', { page: MESSENGER_PAGE }),
      tag: t('Send it first'),
    },
    {
      id: 'email',
      icon: 'mail',
      title: 'Email',
      text: t('Email the file to {mail}, then find it here with your email address.', { mail: SHOP_EMAIL }),
      tag: t('Send it first'),
    },
  ];

  return (
    <>
      <div className="prStepHead">
        <h1 className="prStepTitle"><span className="prNum">1</span> {t('How do you want to send your file?')}</h1>
        <p className="prMuted prStepSub">{t('Pick one. PDF, Word, Excel, PowerPoint, JPG or PNG, up to {mb} MB.', { mb: maxMb })}</p>
      </div>

      <div className="prWays">
        {ways.map((w) => (
          <button key={w.id} className="prWay" onClick={() => onPick(w.id)}>
            <span className="prWayIcon"><Icon name={w.icon} size={34} /></span>
            <span className="prWayTitle">{w.title}</span>
            <span className="prWayText">{w.text}</span>
            <span className={`prWayTag${w.ready ? ' ready' : ''}`}>{w.tag}</span>
          </button>
        ))}
      </div>
    </>
  );
}
