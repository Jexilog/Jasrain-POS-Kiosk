import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useQueueContext } from '../../context/QueueContext';
import { useSettings } from '../../context/SettingsContext';
import CashPaymentModal from '../SelfCheckout/components/CashPaymentModal';
import { saveFile } from '../../utils/fileStore';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import QtyPadModal from '../SelfCheckout/components/QtyPadModal';
import MarqueeText from '../../components/MarqueeText';

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
 
<<<<<<< HEAD
=======
const fileEmoji = (name) => {
  const e = extOf(name);

  if (e === 'pdf') return '📕';
  if (['doc', 'docx'].includes(e)) return '📝';
  if (['xls', 'xlsx'].includes(e)) return '📊';
  if (['ppt', 'pptx'].includes(e)) return '📽️';
  if (['jpg', 'jpeg', 'png'].includes(e)) return '🖼️';

  return '📄';
};

>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
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
 
const UploadIcon = () => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
);
 
const CheckIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  const { theme, toggleTheme } = useKiosk();
  const { queue, currentQueue, addQueue, removeQueue } = useQueueContext();
 
  const fileInput = useRef(null);
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
 
  useIdleTimer(60000, () => navigate('/'), !payOpen);
 
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
 
  // File picking
  const handleFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
 
    if (!ALLOWED.includes(extOf(f.name))) {
      toast.error('That file type is not supported. Use PDF, Word, Excel, PowerPoint, JPG or PNG.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`File is too big (max ${MAX_MB} MB). Please ask staff for help.`);
      return;
    }
 
    setFile(f);
    setReading(true);
    const n = await detectPages(f);
    setPages(n || 1);
    setDetected(Boolean(n));
    setReading(false);
  };
 
  const removeFile = () => {
    setFile(null);
    setPages(1);
    setDetected(false);
  };
 
  // Submit
  // Called once the cash machine has the full amount
  const handlePaid = async (cash) => {
    setPayOpen(false);
    if (!file || saving) return;
    setSaving(true);
 
    const ahead = queue.filter((q) => q.status === 'Waiting' || q.status === 'Printing').length;
<<<<<<< HEAD
    const job = addQueue({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasFile: true,
      pages,
      copies,
      color,
      paperSize: paper,
      total,
      payment: 'Cash',
      cashReceived: cash.received,
      change: cash.change,
      changeGiven: cash.change === 0,
    });
=======
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
      toast.error(`${err.message} Please call staff.`);
      return;
    }
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
 
    try {
      // Store the actual file so staff can open it from the staff screen
      await saveFile(job.id, file);
      setTicket({ ...job, ahead });
    } catch (err) {
      // the customer has already paid, so keep the job and send them to staff
      setTicket({ ...job, ahead, fileLost: true });
      toast.error('Your payment was received but the file could not be saved. Please show this ticket to staff.');
    } finally {
      setSaving(false);
    }
  };
 
  const startOver = () => {
    setTicket(null);
    removeFile();
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
      <header className="checkoutHeader">
        <div className="brandBadge">
          <div className="brandLogo">J</div>
          <div>
            <h1 className="checkoutBrandTitle">JASRAIN</h1>
            <span className="checkoutBrandSubtitle">STORE &amp; COMPUTER SHOP</span>
          </div>
        </div>
        <div className="headerActions">
          <span className="checkoutTag"><Icon name="printer" size={16} /> PRINTING</span>
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
              <h2>You&apos;re in line!</h2>
              <p className="prMuted">Your queue number</p>
              <div className="prTicketNumber">{ticket.queueNumber}</div>
              <div className="prTicketWait">
                {ticket.ahead === 0 ? "You're next!" : `${ticket.ahead} ahead of you`} · about {minutes} min
              </div>
            </div>
 
            <div className="prTicketTear" aria-hidden="true" />
 
            <div className="prTicketBottom">
              <div className="prTicketRow"><span>File</span><strong className="prClip"><MarqueeText text={ticket.fileName} /></strong></div>
              <div className="prTicketRow"><span>Pages × copies</span><strong>{ticket.pages} × {ticket.copies}</strong></div>
              <div className="prTicketRow"><span>Type</span><strong>{ticket.color === 'bw' ? 'Black & White' : 'Colored'} · {ticket.paperSize}</strong></div>
              <div className="prTicketRow total"><span>Total</span><strong>₱{ticket.total.toFixed(2)}</strong></div>
              {file && (
                <button className="prGhost prViewBtn" onClick={() => setPreviewOpen(true)}>
                  <Icon name="eye" size={18} /> View my file
                </button>
              )}
              <p className="prTicketNote">
                {ticket.fileLost
                  ? <>Your payment was received but we could not save your file. Please show this ticket to staff.</>
                  : <>Paid. Watch the screen for <b>{ticket.queueNumber}</b>.</>}
                {ticket.change > 0 && <> <b>Change due ₱{ticket.change.toFixed(2)}</b>: the machine does not give change, so please ask staff.</>}
              </p>
            </div>
          </div>
 
          <div className="prTicketActions">
            <button className="auxButton" onClick={startOver}><Icon name="printer" size={18} /> Print another</button>
            <button className="prPrimary" onClick={() => navigate('/')}>Done</button>
          </div>
        </main>
      ) : (
        /* form */
        <>
          <main className="printBody">
            {/* live queue strip */}
            <div className="prQueueStrip" aria-label="Print queue status">
              <div className="prStat">
                <span className="prStatLabel">Now printing</span>
                <strong>{currentQueue || '—'}</strong>
              </div>
              <div className="prStat">
                <span className="prStatLabel">Waiting</span>
                <strong>{waiting}</strong>
              </div>
              <div className="prStat">
                <span className="prStatLabel">Est. wait</span>
                <strong>~{Math.max(1, waiting * 2)} min</strong>
              </div>
            </div>
 
            {/* 1. file  */}
            <section className="prCard">
              <h2 className="prCardTitle"><span className="prNum">1</span> Choose your file</h2>
 
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={handleFile}
                hidden
              />
 
              {!file ? (
                <button className="prDrop" onClick={() => fileInput.current && fileInput.current.click()}>
                  <UploadIcon />
                  <span className="prDropTitle">Tap to choose a file</span>
                  <span className="prDropHint">Insert your USB flash drive first, then pick the file.</span>
                  <span className="prDropTypes">PDF · Word · Excel · PowerPoint · JPG · PNG · up to {MAX_MB} MB</span>
                </button>
              ) : (
                <>
                  <div className="prFileRow">
                    <div className="prFileIcon" aria-hidden="true">{fileEmoji(file.name)}</div>
                    <div className="prFileInfo">
                      <MarqueeText text={file.name} className="prFileName" />
                      <span className="prMuted">{formatSize(file.size)}</span>
                    </div>
                    <button className="prGhost view" onClick={() => setPreviewOpen(true)}><Icon name="eye" size={16} /> View</button>
                    <button className="prGhost" onClick={() => fileInput.current && fileInput.current.click()}>Change</button>
                    <button className="prGhost danger" onClick={removeFile} aria-label="Remove file"><Icon name="x" size={16} /></button>
                  </div>
 
                  <div className="prRow">
                    <div>
                      <div className="prLabel">Number of pages</div>
                      <div className="prMuted prSmall">
                        {reading ? 'Reading your file…' : detected ? 'Counted automatically. Fix it if it looks wrong.' : 'Please check or type the page count.'}
                      </div>
                    </div>
                    <Stepper value={pages} onChange={(n) => { setPages(n); setDetected(false); }} onTap={() => setPadFor('pages')} label="pages" />
                  </div>
                </>
              )}
            </section>
 
            {/* 2. settings  */}
            <section className="prCard">
              <h2 className="prCardTitle"><span className="prNum">2</span> Print settings</h2>
 
              <div className="prLabel">Color</div>
              <div className="prChoices">
                <button className={`prChoice ${color === 'bw' ? 'active' : ''}`} onClick={() => setColor('bw')}>
                  <span className="prSwatch bw" aria-hidden="true" />
                  <span className="prChoiceText">
                    <strong>Black &amp; White</strong>
                    <span className="prMuted">₱{RATES.bw} per page</span>
                  </span>
                </button>
                <button className={`prChoice ${color === 'color' ? 'active' : ''}`} onClick={() => setColor('color')}>
                  <span className="prSwatch color" aria-hidden="true" />
                  <span className="prChoiceText">
                    <strong>Colored</strong>
                    <span className="prMuted">₱{RATES.color} per page</span>
                  </span>
                </button>
              </div>
 
              <div className="prLabel">Paper size</div>
              <div className="prSeg" role="radiogroup" aria-label="Paper size">
                {PAPER.map((p) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={paper === p.id}
                    className={paper === p.id ? 'active' : ''}
                    onClick={() => setPaper(p.id)}
                  >
                    <strong>{p.id}</strong>
                    <span>{p.note}</span>
                  </button>
                ))}
              </div>
 
              <div className="prRow">
                <div className="prLabel noMargin">Copies</div>
                <Stepper value={copies} onChange={setCopies} onTap={() => setPadFor('copies')} label="copies" />
              </div>
            </section>
          </main>
 
          <footer className="checkoutFooter">
            <div className="prSummary">
              <div className="prSummaryText">
                <span className="prSummaryTitle">
                  {pages} page{pages > 1 ? 's' : ''} × {copies} cop{copies > 1 ? 'ies' : 'y'} = {sheets} sheet{sheets > 1 ? 's' : ''}
                </span>
                <span className="prMuted">{color === 'bw' ? 'Black & White' : 'Colored'} · {paper} · pay with cash</span>
              </div>
              <div className="prTotal">₱{total.toFixed(2)}</div>
              <button className="prPrimary" disabled={!file || reading || saving} onClick={() => setPayOpen(true)}>
                {saving ? 'Sending…' : 'Pay & Join Queue'}
              </button>
            </div>
 
            <div className="secondaryActionRow">
              <button className="auxButton" onClick={() => navigate('/')}>
                <span className="auxIcon"><Icon name="home" size={20} /></span>
                Back to Menu
              </button>
            </div>
          </footer>
        </>
      )}
 
      {previewOpen && file && fileUrl && (
        <div className="prPreviewOverlay" onClick={() => setPreviewOpen(false)}>
          <div className="prPreviewCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="File preview">
            <div className="prPreviewHead">
              <div className="prPreviewTitle">
                <span aria-hidden="true">{fileEmoji(file.name)}</span>
                <MarqueeText text={file.name} className="prPreviewName" />
              </div>
              <button className="closeIconBtn" onClick={() => setPreviewOpen(false)} aria-label="Close preview"><Icon name="x" size={18} /></button>
            </div>
 
            <div className="prPreviewBody">
              {extOf(file.name) === 'pdf' && <iframe title="PDF preview" src={fileUrl} />}
              {['jpg', 'jpeg', 'png'].includes(extOf(file.name)) && <img src={fileUrl} alt={file.name} />}
              {!['pdf', 'jpg', 'jpeg', 'png'].includes(extOf(file.name)) && (
                <div className="prNoPreview">
                  <div className="prNoPreviewIcon">{fileEmoji(file.name)}</div>
                  <h3>Preview isn&apos;t available for this file type</h3>
                  <p className="prMuted">
                    Word, Excel and PowerPoint files can&apos;t be shown here, but they will print normally.
                    Please make sure this is the right file:
                  </p>
                  <strong>{file.name}</strong>
                  <span className="prMuted">{formatSize(file.size)}</span>
                </div>
              )}
            </div>
 
            <div className="prPreviewFoot">
              <button className="prPrimary" onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
 
      {payOpen && (
        <CashPaymentModal
          total={total}
          subtitle={`${sheets} sheet${sheets > 1 ? 's' : ''} · ${color === 'bw' ? 'Black & White' : 'Colored'}`}
          onPaid={handlePaid}
          onClose={() => setPayOpen(false)}
        />
      )}

      {padFor && (
        <QtyPadModal
          name={padFor === 'pages' ? 'Number of pages' : 'Number of copies'}
          value={padFor === 'pages' ? pages : copies}
          onSave={savePad}
          onClose={() => setPadFor(null)}
        />
      )}
    </div>
  );
}
 