import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useQueueContext } from '../../context/QueueContext';
import { useSettings } from '../../context/SettingsContext';
import CashPaymentModal from '../SelfCheckout/components/CashPaymentModal';
import { saveFile } from '../../utils/fileStore';
import { dropFile } from '../../utils/incoming';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import IdleWarning from '../../components/IdleWarning';
import QtyPadModal from '../SelfCheckout/components/QtyPadModal';
import MarqueeText from '../../components/MarqueeText';
import SourceStep from './components/SourceStep';
import PhoneStep from './components/PhoneStep';
import OnlineStep from './components/OnlineStep';

import '../SelfCheckout/SelfCheckout.css'; // shared header + theme colors
import './PrintingService.css';
import Icon from '../../components/Icon';

// Settings (later: load these from the database)
const PAPER = [
  { id: 'Short', note: '8.5 × 11 in' },
  { id: 'A4', note: '8.27 × 11.69 in' },
  { id: 'Long', note: '8.5 × 13 in' },
];
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'];
const MAX_MB = 25;
 
// Helpers
const extOf = (name) => name.split('.').pop().toLowerCase();
 
const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
 
const fileIconName = (name) => {
  const e = extOf(name);
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(e) ? 'file' : 'image';
};
 
// Tries to count PDF pages. Returns null when it can't tell.
async function detectPages(file) {
  const e = extOf(file.name);
  if (['jpg', 'jpeg', 'png'].includes(e)) return 1;
  if (e !== 'pdf' || file.size > 20 * 1024 * 1024) return null;
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    const found = text.match(/\/Type\s*\/Page(?![s\w])/g);
    return found && found.length ? found.length : null;
  } catch (err) {
    return null;
  }
}
 
const CheckIcon = () => (
  <svg style={{ width: '2.125rem', height: '2.125rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);
 
function Stepper({ value, onChange, onTap, label }) {
  return (
    <div className="prStepper">
      <button onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={`Less ${label}`}>
        −
      </button>
      <button className="prStepNum" onClick={onTap} aria-label={`${value} ${label}. Tap to type a number`}>
        {value}
      </button>
      <button onClick={() => onChange(Math.min(999, value + 1))} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}
export default function Printing() {
  const { settings } = useSettings();
  const RATES = settings.printRates; // set by the admin in Settings
  const navigate = useNavigate();
  const { theme, toggleTheme, t } = useKiosk();
  const { queue, currentQueue, addQueue, removeQueue } = useQueueContext();
 
  const fileInput = useRef(null);
  const [step, setStep] = useState('source'); // 'source' | 'phone' | 'online' | 'settings'
  const [onlineStart, setOnlineStart] = useState('messenger');
  const [origin, setOrigin] = useState(null); // { source: 'USB flash drive' | 'Phone' | 'Messenger' | 'Email', ref }
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [pages, setPages] = useState(1);
  const [detected, setDetected] = useState(false);
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState('bw');
  const [paper, setPaper] = useState('Short');
  const [padFor, setPadFor] = useState(null); // 'pages' | 'copies' | null
  const [ticket, setTicket] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
 
  const idle = useIdleTimer(step === 'phone' || step === 'online' ? 180000 : 60000, () => navigate('/'), !payOpen);
 
  // A temporary link so the customer can preview the file they picked
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      setPreviewOpen(false);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
 
  const waiting = queue.filter((q) => q.status === 'Waiting').length;
  const sheets = pages * copies;
  const total = sheets * RATES[color];
 
  // A file arrived (USB pick, phone upload, Messenger or email). Check it, count the pages, go to the settings.
  const acceptFile = useCallback(async (f, from) => {
    if (!ALLOWED.includes(extOf(f.name))) {
      toast.error(t('That file type is not supported. Use PDF, Word, Excel, PowerPoint, JPG or PNG.'));
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(t('File is too big (max {mb} MB). Please ask staff for help.', { mb: MAX_MB }));
      return;
    }

    setFile(f);
    setOrigin(from);
    setStep('settings');
    setReading(true);
    const n = await detectPages(f);
    setPages(n || 1);
    setDetected(Boolean(n));
    setReading(false);
  }, [t]);

  // USB: the picker opens as soon as the customer taps the card
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) acceptFile(f, { source: 'USB flash drive' });
  };

  const pickWay = (way) => {
    if (way === 'usb') {
      if (fileInput.current) fileInput.current.click();
    } else if (way === 'phone') {
      setStep('phone');
    } else {
      setOnlineStart(way);
      setStep('online');
    }
  };

  const removeFile = () => {
    setFile(null);
    setOrigin(null);
    setPages(1);
    setDetected(false);
  };

  const changeFile = () => {
    removeFile();
    setStep('source');
  };
 
  // Submit
  // Called once the cash machine has the full amount
  const handlePaid = async (cash) => {
    setPayOpen(false);
    if (!file || saving) return;
    setSaving(true);
 
    const ahead = queue.filter((q) => q.status === 'Waiting' || q.status === 'Printing').length;
    let job;
    try {
      job = await addQueue({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        pages,
        copies,
        color,
        paperSize: paper,
        payment: 'Cash',
        cashReceived: cash.received,
      });
    } catch (err) {
      setSaving(false);
      toast.error(`${err.message} ${t('Please call staff.')}`);
      return;
    }
 
    try {
      // Store the actual file so staff can open it from the staff screen
      await saveFile(job.id, file, job.uploadToken);
      setTicket({ ...job, ahead });
    } catch (err) {
      // the customer has already paid, so keep the job and send them to staff
      setTicket({ ...job, ahead, fileLost: true });
      toast.error(t('Your payment was received but the file could not be saved. Please show this ticket to staff.'));
    } finally {
      setSaving(false);
    }
  };
 
  const startOver = () => {
    setTicket(null);
    removeFile();
    setStep('source');
    setCopies(1);
    setColor('bw');
    setPaper('Short');
  };
 
  // Ticket screen goes back to the menu by itself after a while
  useEffect(() => {
    if (!ticket) return undefined;
    const t = setTimeout(() => navigate('/'), 45000);
    return () => clearTimeout(t);
  }, [ticket, navigate]);
 
  // Pad (tap the number to type)
  const savePad = (n) => {
    if (padFor === 'pages') {
      setPages(n);
      setDetected(false);
    } else {
      setCopies(n);
    }
    setPadFor(null);
  };
 
  const minutes = ticket ? Math.max(2, (ticket.ahead + 1) * 2) : 0;
  return (
    <div className={`checkoutScreen ${theme}Mode printScreen`}>
      <IdleWarning idle={idle} />
      <header className="checkoutHeader">
        <div className="brandBadge">
          <div className="brandLogo">J</div>
          <div>
            <h1 className="checkoutBrandTitle">JASRAIN</h1>
            <span className="checkoutBrandSubtitle">STORE &amp; COMPUTER SHOP</span>
          </div>
        </div>
        <div className="headerActions">
          <span className="checkoutTag"><Icon name="printer" size={16} /> {t('PRINTING')}</span>
          <button className="checkoutThemeBtn" onClick={toggleTheme} aria-label="Toggle Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
        </div>
      </header>
 
      {ticket ? (
        /* ticket */
        <main className="printBody ticketBody">
          <div className="prTicket">
            <div className="prTicketTop">
              <span className="prTicketCheck"><CheckIcon /></span>
              <h2>{t("You're in line!")}</h2>
              <p className="prMuted">{t('Your queue number')}</p>
              <div className="prTicketNumber">{ticket.queueNumber}</div>
              <div className="prTicketWait">
                {ticket.ahead === 0 ? t("You're next!") : t('{n} ahead of you', { n: ticket.ahead })} · {t('about {m} min', { m: minutes })}
              </div>
            </div>
 
            <div className="prTicketTear" aria-hidden="true" />
 
            <div className="prTicketBottom">
              <div className="prTicketRow"><span>{t('File')}</span><strong className="prClip"><MarqueeText text={ticket.fileName} /></strong></div>
              <div className="prTicketRow"><span>{t('Pages × copies')}</span><strong>{ticket.pages} × {ticket.copies}</strong></div>
              <div className="prTicketRow"><span>{t('Type')}</span><strong>{ticket.color === 'bw' ? t('Black & White') : t('Colored')} · {ticket.paperSize}</strong></div>
              <div className="prTicketRow total"><span>{t('Total')}</span><strong>₱{ticket.total.toFixed(2)}</strong></div>
              {file && (
                <button className="prGhost prViewBtn" onClick={() => setPreviewOpen(true)}>
                  <Icon name="eye" size={18} /> {t('View my file')}
                </button>
              )}
              <p className="prTicketNote">
                {ticket.fileLost
                  ? <>{t('Your payment was received but we could not save your file. Please show this ticket to staff.')}</>
                  : <>{t('Paid. Watch the screen for')} <b>{ticket.queueNumber}</b>.</>}
                {ticket.change > 0 && <> <b>{t('Change due')} ₱{ticket.change.toFixed(2)}</b>: {t('the machine does not give change, so please ask staff.')}</>}
              </p>
            </div>
          </div>
 
          <div className="prTicketActions">
            <button className="auxButton" onClick={startOver}><Icon name="printer" size={18} /> {t('Print another')}</button>
            <button className="prPrimary" onClick={() => navigate('/')}>{t('Done')}</button>
          </div>
        </main>
      ) : (
        <>
          {/* USB: the picker opens when the customer taps the USB card */}
          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={handleFile} hidden />

          <main className="printBody prWide">
            {step === 'source' && (
              <>
                <div className="prQueueStrip" aria-label="Print queue status">
                  <div className="prStat"><span className="prStatLabel">{t('Now printing')}</span><strong>{currentQueue || '—'}</strong></div>
                  <div className="prStat"><span className="prStatLabel">{t('Waiting')}</span><strong>{waiting}</strong></div>
                  <div className="prStat"><span className="prStatLabel">{t('Est. wait')}</span><strong>{t('~{n} min', { n: Math.max(1, waiting * 2) })}</strong></div>
                </div>
                <SourceStep maxMb={MAX_MB} onPick={pickWay} />
              </>
            )}

            {step === 'phone' && <PhoneStep onFile={acceptFile} onBack={() => setStep('source')} />}
            {step === 'online' && <OnlineStep start={onlineStart} onFile={acceptFile} onBack={() => setStep('source')} />}

            {step === 'settings' && file && (
              <div className="prSettingsGrid">
                <div className="prSettingsCol">
                  <h1 className="prStepTitle"><span className="prNum">2</span> {t('Print settings')}</h1>

                  <div className="prLabel">{t('Color')}</div>
                  <div className="prChoices">
                    <button className={`prChoice ${color === 'bw' ? 'active' : ''}`} onClick={() => setColor('bw')}>
                      <span className="prSwatch bw" aria-hidden="true" />
                      <span className="prChoiceText"><strong>{t('Black & White')}</strong><span className="prMuted">{t('₱{n} per page', { n: RATES.bw })}</span></span>
                    </button>
                    <button className={`prChoice ${color === 'color' ? 'active' : ''}`} onClick={() => setColor('color')}>
                      <span className="prSwatch color" aria-hidden="true" />
                      <span className="prChoiceText"><strong>{t('Colored')}</strong><span className="prMuted">{t('₱{n} per page', { n: RATES.color })}</span></span>
                    </button>
                  </div>

                  <div className="prLabel">{t('Paper size')}</div>
                  <div className="prSeg" role="radiogroup" aria-label="Paper size">
                    {PAPER.map((p) => (
                      <button key={p.id} role="radio" aria-checked={paper === p.id} className={paper === p.id ? 'active' : ''} onClick={() => setPaper(p.id)}>
                        <strong>{p.id}</strong><span>{p.note}</span>
                      </button>
                    ))}
                  </div>

                  <div className="prTwo">
                    <div className="prBox">
                      <div>
                        <div className="prLabel noMargin">{t('Pages')}</div>
                        <div className="prMuted prSmall">{reading ? t('Reading your file…') : detected ? t('Counted from your file') : t('Please check the count')}</div>
                      </div>
                      <Stepper value={pages} onChange={(n) => { setPages(n); setDetected(false); }} onTap={() => setPadFor('pages')} label="pages" />
                    </div>
                    <div className="prBox">
                      <div className="prLabel noMargin">{t('Copies')}</div>
                      <Stepper value={copies} onChange={setCopies} onTap={() => setPadFor('copies')} label="copies" />
                    </div>
                  </div>
                </div>

                <aside className="prSummaryCard">
                  <div className="prKicker">{t('YOUR FILE')}</div>
                  <div className="prFileRow">
                    <div className="prFileIcon" aria-hidden="true"><Icon name={fileIconName(file.name)} size={26} /></div>
                    <div className="prFileInfo">
                      <MarqueeText text={file.name} className="prFileName" />
                      <span className="prMuted">{t('From {source}', { source: t(origin ? origin.source : 'USB flash drive') })} · {formatSize(file.size)}</span>
                    </div>
                    <button className="prGhost view" onClick={() => setPreviewOpen(true)}><Icon name="eye" size={16} /> {t('Preview')}</button>
                  </div>
                  <hr className="prLine" />
                  <div className="prSumRow"><span>{t(pages > 1 ? '{n} pages' : '{n} page', { n: pages })} × {t(copies > 1 ? '{n} copies' : '{n} copy', { n: copies })}</span><strong>{t(sheets > 1 ? '{n} sheets' : '{n} sheet', { n: sheets })}</strong></div>
                  <div className="prSumRow"><span>{color === 'bw' ? t('Black & White') : t('Colored')}, {paper}</span><strong>{t('₱{n} each', { n: RATES[color] })}</strong></div>
                  <hr className="prLine" />
                  <div className="prSumTotal"><span>{t('Total')}</span><strong>₱{total.toFixed(2)}</strong></div>
                  <button className="prPrimary prPay" disabled={reading || saving} onClick={() => setPayOpen(true)}>
                    <Icon name="cash" size={24} /> {saving ? t('Sending…') : t('Pay with cash')}
                  </button>
                  <p className="prMuted prSmall prCenter">{t('You get a queue number after you pay.')}</p>
                </aside>
              </div>
            )}
          </main>

          {(step === 'source' || step === 'settings') && (
          <footer className="checkoutFooter prWideFooter">
            <div className="secondaryActionRow">
              {step === 'settings' ? (
                <button className="auxButton" onClick={changeFile}><Icon name="arrow-left" size={20} /> {t('Change file')}</button>
              ) : (
                <button className="auxButton" onClick={() => navigate('/')}><span className="auxIcon"><Icon name="home" size={20} /></span> {t('Back to Menu')}</button>
              )}
              <span className="prMuted prFootNote">
                {step === 'settings'
                  ? t('Insert bills, then your queue number is shown on screen.')
                  : t('Black & white ₱{bw} per page · Colored ₱{color} per page · Pay with cash', { bw: RATES.bw, color: RATES.color })}
              </span>
            </div>
          </footer>
          )}
        </>
      )}

      {previewOpen && file && fileUrl && (
        <div className="prPreviewOverlay" onClick={() => setPreviewOpen(false)}>
          <div className="prPreviewCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="File preview">
            <div className="prPreviewHead">
              <div className="prPreviewTitle">
                <span aria-hidden="true"><Icon name={fileIconName(file.name)} size={26} /></span>
                <MarqueeText text={file.name} className="prPreviewName" />
              </div>
              <button className="closeIconBtn" onClick={() => setPreviewOpen(false)} aria-label="Close preview"><Icon name="x" size={18} /></button>
            </div>
 
            <div className="prPreviewBody">
              {extOf(file.name) === 'pdf' && <iframe title="PDF preview" src={fileUrl} />}
              {['jpg', 'jpeg', 'png'].includes(extOf(file.name)) && <img src={fileUrl} alt={file.name} />}
              {!['pdf', 'jpg', 'jpeg', 'png'].includes(extOf(file.name)) && (
                <div className="prNoPreview">
                  <div className="prNoPreviewIcon"><Icon name={fileIconName(file.name)} size={26} /></div>
                  <h3>{t("Preview isn't available for this file type")}</h3>
                  <p className="prMuted">
                    {t("Word, Excel and PowerPoint files can't be shown here, but they will print normally. Please make sure this is the right file:")}
                  </p>
                  <strong>{file.name}</strong>
                  <span className="prMuted">{formatSize(file.size)}</span>
                </div>
              )}
            </div>
 
            <div className="prPreviewFoot">
              <button className="prPrimary" onClick={() => setPreviewOpen(false)}>{t('Close')}</button>
            </div>
          </div>
        </div>
      )}
 
      {payOpen && (
        <CashPaymentModal
          total={total}
          subtitle={`${t(sheets > 1 ? '{n} sheets' : '{n} sheet', { n: sheets })} · ${color === 'bw' ? t('Black & White') : t('Colored')}`}
          onPaid={handlePaid}
          onClose={() => setPayOpen(false)}
        />
      )}

      {padFor && (
        <QtyPadModal
          name={padFor === 'pages' ? t('Number of pages') : t('Number of copies')}
          value={padFor === 'pages' ? pages : copies}
          onSave={savePad}
          onClose={() => setPadFor(null)}
        />
      )}
    </div>
  );
}
 