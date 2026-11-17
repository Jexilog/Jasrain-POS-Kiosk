import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import QrCode from '../../../components/QrCode';
import { useKiosk } from '../../../context/KioskContext';
import { MESSENGER_PAGE, MESSENGER_LINK, SHOP_EMAIL } from '../../../config/sendFile';
import './OnlineLink.css';

// Screen 2b: Messenger or email. It only shows the shop's account to send the file to. Staff handle the file from there.
export default function OnlineStep({ start, onBack }) {
  const { t } = useKiosk();
  const [source, setSource] = useState(start === 'email' ? 'email' : 'messenger');
  const isMessenger = source === 'messenger';

  return (
    <>
      <div className="prStepHead prStepHeadRow">
        <h1 className="prStepTitle"><span className="prNum">1</span> {t('Send your file')}</h1>
        <div className="prTabs" role="tablist" aria-label="Where to send it">
          <button role="tab" aria-selected={isMessenger} className={isMessenger ? 'active' : ''} onClick={() => setSource('messenger')}>Messenger</button>
          <button role="tab" aria-selected={!isMessenger} className={!isMessenger ? 'active' : ''} onClick={() => setSource('email')}>Email</button>
        </div>
      </div>

      <div className="prSendCard">
        <div className="prKicker">{isMessenger ? t('SEND YOUR FILE TO OUR MESSENGER') : t('SEND YOUR FILE TO OUR EMAIL')}</div>
        <div className="prSendMain">
          <QrCode
            value={isMessenger ? MESSENGER_LINK : `mailto:${SHOP_EMAIL}`}
            size={140}
            label={isMessenger ? 'Open our Messenger page' : 'Write to our email'}
          />
          <div className="prSendText">
            {isMessenger ? (
              <>
                <span className="prSendLabel">{t('Messenger page')}</span>
                <b className="prSendBig">{MESSENGER_PAGE}</b>
                <span className="prSendLink">{MESSENGER_LINK.replace(/^https?:\/\//, '')}</span>
              </>
            ) : (
              <>
                <span className="prSendLabel">{t('Email address')}</span>
                <b className="prSendBig">{SHOP_EMAIL}</b>
              </>
            )}
            <span className="prSendHint">{isMessenger ? t('Scan the code, or search for the page name above.') : t('Scan the code, or write to the address above.')}</span>
          </div>
        </div>
      </div>

      <div className="prStepFoot">
        <button className="auxButton" onClick={onBack}><Icon name="arrow-left" size={20} /> {t('Choose another way')}</button>
      </div>
    </>
  );
}
