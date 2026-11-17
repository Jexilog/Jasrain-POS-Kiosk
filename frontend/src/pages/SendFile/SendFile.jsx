import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { sessionStatus, sendFromPhone } from '../../utils/incoming';
import './SendFile.css';

const MAX_MB = 25;
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'];
const size = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

// The page a customer sees on their PHONE after scanning the kiosk QR code.
export default function SendFile() {
  const { code } = useParams();
  const [state, setState] = useState('checking'); // checking | ready | expired | sending | done
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    sessionStatus(String(code || '').toUpperCase())
      .then((s) => setState(s.status === 'waiting' ? 'ready' : s.status === 'ready' ? 'done' : 'expired'))
      .catch(() => setState('expired'));
  }, [code]);

  const choose = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    if (!ALLOWED.includes(f.name.split('.').pop().toLowerCase())) return setError('Use a PDF, Word, Excel, PowerPoint, JPG or PNG file.');
    if (f.size > MAX_MB * 1048576) return setError(`That file is too big. The limit is ${MAX_MB} MB.`);
    setFile(f);
  };

  const send = async () => {
    setState('sending');
    setError('');
    try {
      await sendFromPhone(String(code).toUpperCase(), file);
      setState('done');
    } catch (e) {
      setError(e.message);
      setState(e.status === 410 ? 'expired' : 'ready');
    }
  };

  return (
    <div className="sfPage">
      <div className="sfBrand"><span className="sfMark">J</span><div><b>JASRAIN</b><small>STORE &amp; COMPUTER SHOP</small></div></div>

      <div className="sfCard">
        {state === 'checking' && <p className="sfMuted">One moment…</p>}

        {state === 'expired' && (
          <>
            <span className="sfIcon bad"><Icon name="alert" size={30} /></span>
            <h1>This code has expired</h1>
            <p className="sfMuted">Go back to the kiosk and scan the new code.</p>
          </>
        )}

        {state === 'done' && (
          <>
            <span className="sfIcon good"><Icon name="check" size={30} /></span>
            <h1>File sent</h1>
            <p className="sfMuted">Look at the kiosk screen to choose your print settings. You can close this page.</p>
          </>
        )}

        {(state === 'ready' || state === 'sending') && (
          <>
            <span className="sfIcon"><Icon name="upload" size={30} /></span>
            <h1>Send your file to the kiosk</h1>
            <p className="sfMuted">PDF, Word, Excel, PowerPoint, JPG or PNG, up to {MAX_MB} MB.</p>
            <input ref={input} type="file" hidden onChange={choose} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" />
            {file ? (
              <div className="sfFile"><Icon name="file" size={24} /><span><b>{file.name}</b><small>{size(file.size)}</small></span></div>
            ) : null}
            {error && <p className="sfError">{error}</p>}
            <button className="sfBtn ghost" onClick={() => input.current && input.current.click()} disabled={state === 'sending'}>
              {file ? 'Choose a different file' : 'Choose file'}
            </button>
            {file && (
              <button className="sfBtn" onClick={send} disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send to kiosk'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
