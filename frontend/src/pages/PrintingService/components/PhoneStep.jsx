import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Icon from '../../../components/Icon';
import { useKiosk } from '../../../context/KioskContext';
import QrCode from '../../../components/QrCode';
import { PUBLIC_URL } from '../../../config/sendFile';
import { createSession, sessionStatus, downloadPhoneFile, dropSession } from '../../../utils/incoming';

const address = () => (PUBLIC_URL || window.location.origin).replace(/\/$/, '');

// Screen 2a: scan the code, upload from the phone, the file shows up here by itself
export default function PhoneStep({ onFile, onBack, registerCleanup }) {
  const { t } = useKiosk();
  const [session, setSession] = useState(null); // { code, minutes }
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const codeRef = useRef(null);
  const busy = useRef(false);

  const newCode = useCallback(async () => {
    setError('');
    setExpired(false);
    if (codeRef.current) dropSession(codeRef.current).catch(() => {});
    try {
      const s = await createSession();
      codeRef.current = s.code;
      setSession(s);
    } catch (e) {
      setSession(null);
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    newCode();
    return () => {
      // leaving the screen without a file: throw the code away
      if (codeRef.current) dropSession(codeRef.current).catch(() => {});
    };
  }, [newCode]);

  // ask the server every 2 seconds whether the phone has sent the file
  useEffect(() => {
    if (!session || expired) return undefined;
    const timer = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const st = await sessionStatus(session.code);
        if (st.status === 'expired') {
          setExpired(true);
        } else if (st.status === 'ready') {
          const file = await downloadPhoneFile(session.code, st.fileName, st.fileType);
          const code = session.code;
          codeRef.current = null; // the file is ours now, the server copy is removed after payment
          onFile(file, { source: 'Phone', ref: code });
          return;
        }
      } catch (e) {
        /* try again on the next tick */
      } finally {
        busy.current = false;
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [session, expired, onFile]);

  // if the file could not be fetched, tell the customer once
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const link = session ? `${address()}/send/${session.code}` : '';
  const shortLink = link.replace(/^https?:\/\//, '');

  return (
    <>
      <div className="prStepHead">
        <h1 className="prStepTitle"><span className="prNum">1</span> {t('Send your file from your phone')}</h1>
      </div>

      <div className="prPhoneGrid">
        <div className="prCodeCard">
          {session && !expired ? <QrCode value={link} size={260} label="Scan to upload your file" /> : (
            <div className="qrImg qrBlank prQrNote" style={{ width: 260, height: 260 }}>
              {error || (expired ? t('This code expired.') : t('Making your code…'))}
            </div>
          )}
          <div className="prCodeText">
            {t('Or type this on your phone:')}
            <strong>{session ? shortLink : '…'}</strong>
          </div>
          <div className="prMuted prCodeNote">
            <Icon name="clock" size={16} /> {t('This code works for {n} minutes', { n: session ? session.minutes : 10 })}
          </div>
        </div>

        <div className="prSteps">
          <div className="prStepRow"><span className="prStepBadge">1</span><div><strong>{t('Open your phone camera')}</strong><span>{t('Point it at the code. Tap the link that appears.')}</span></div></div>
          <div className="prStepRow"><span className="prStepBadge">2</span><div><strong>{t('Choose your file')}</strong><span>{t('From your phone, Google Drive or Messenger downloads.')}</span></div></div>
          <div className="prStepRow"><span className="prStepBadge">3</span><div><strong>{t('Wait on this screen')}</strong><span>{t('Your file shows up here by itself. Then pick your print settings.')}</span></div></div>
          <div className="prWaiting">
            <span className="prDots" aria-hidden="true"><i /><i /><i /></span>
            {expired ? t('The code expired. Tap "Get a new code".') : t('Waiting for your file…')}
          </div>
        </div>
      </div>

      <div className="prStepFoot">
        <button className="auxButton" onClick={onBack}><Icon name="arrow-left" size={20} /> {t('Choose another way')}</button>
        <button className="auxButton" onClick={newCode}><Icon name="refresh" size={20} /> {t('Get a new code')}</button>
      </div>
    </>
  );
}
