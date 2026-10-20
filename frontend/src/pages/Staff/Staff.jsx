import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useAuth } from '../../context/AuthContext';
import { useQueueContext } from '../../context/QueueContext';
import { getFile, deleteFile } from '../../utils/fileStore';
import OrdersPanel from './OrdersPanel';
import Icon from '../../components/Icon';
import { useOrders } from '../../context/OrderContext';
import { PageHeader, Card, StatCard, Badge, Segmented, EmptyState, Modal, Field } from '../Admin/components/ui';
import { peso, int } from '../../utils/format';

import '../Admin/Admin.css'; // the staff screen shares the admin look
import './Staff.css';


const KEEP_HOURS = 24; // finished jobs lose their file after this long
 
const extOf = (name = '') => name.split('.').pop().toLowerCase();
const isPdf = (name) => extOf(name) === 'pdf';
const isImage = (name) => ['jpg', 'jpeg', 'png'].includes(extOf(name));
 
const formatSize = (bytes = 0) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
 
const timeAgo = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
};
 
export default function Staff() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useKiosk();
  const { isAuthenticated, login, logout } = useAuth();
  const { queue, nextQueue, startQueue, completeQueue, removeQueue, giveChange } = useQueueContext();
 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('active');
  const [section, setSection] = useState('print'); // 'print' | 'orders'
  const { orders } = useOrders();
  const todoCount = orders.filter((o) => o.status === 'Unpaid' || (o.change > 0 && !o.changeGiven && o.status !== 'Cancelled')).length;
  const [preview, setPreview] = useState(null); // { job, url, name }
  const [, tick] = useState(0);
 
  // refresh "x min ago" labels
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
 
  // delete files of old finished jobs
  useEffect(() => {
    if (!isAuthenticated) return;
    const limit = KEEP_HOURS * 3600 * 1000;
    queue.forEach((job) => {
      if (job.status === 'Completed' && Date.now() - new Date(job.createdAt).getTime() > limit) {
        deleteFile(job.id).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
 
  // free the preview URL when it closes
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);
 
  const active = useMemo(() => queue.filter((j) => j.status !== 'Completed'), [queue]);
  const done = useMemo(() => queue.filter((j) => j.status === 'Completed').slice().reverse(), [queue]);
  const waiting = queue.filter((j) => j.status === 'Waiting').length;
  const printing = queue.find((j) => j.status === 'Printing');
  const shown = tab === 'active' ? active : done;
 
  const handleLogin = (e) => {
    e.preventDefault();
    if (!login(username.trim(), password)) {
      toast.error('Wrong username or password');
      return;
    }
    setUsername('');
    setPassword('');
  };
 
  const loadBlob = async (job) => {
    try {
      const rec = await getFile(job.id);
      if (!rec) {
        toast.error('File not found. It may have been cleared, or it was sent from another computer.');
        return null;
      }
      return rec.blob;
    } catch (err) {
      toast.error('Could not open the file.');
      return null;
    }
  };
 
  const handleView = async (job) => {
    const blob = await loadBlob(job);
    if (!blob) return;
    setPreview({ job, url: URL.createObjectURL(blob), name: job.fileName });
  };
 
  const handleDownload = async (job) => {
    const blob = await loadBlob(job);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = job.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
 
  // PDFs and images open in a new tab so the browser's own Print button works
  const handleOpenTab = async (job) => {
    const blob = await loadBlob(job);
    if (!blob) return;
    window.open(URL.createObjectURL(blob), '_blank');
  };
 
  const handleRemove = async (job) => {
    if (!window.confirm(`Remove ${job.queueNumber} and delete its file?`)) return;
    removeQueue(job.queueNumber);
    deleteFile(job.id).catch(() => {});
  };
 
  // Login
  if (!isAuthenticated) {
    return (
      <div className={`adminApp ${theme}Mode`}>
        <div className="admLoginWrap">
          <form className="admLogin" onSubmit={handleLogin}>
            <div className="admBrand" style={{ padding: 0 }}>
              <div className="admBrandMark" aria-hidden="true">J</div>
              <div>
                <div className="admBrandName">JASRAIN</div>
                <div className="admBrandSub">Staff</div>
              </div>
            </div>
            <Field label="Username">
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <button className="admBtn primary" type="submit" disabled={!username || !password}>Sign in</button>
            <button type="button" className="admLinkBtn" onClick={() => navigate('/')}>
              <Icon name="arrow-left" size={14} /> Back to kiosk
            </button>
          </form>
        </div>
      </div>
    );
  }

  const owedJobs = queue.filter((j) => j.change > 0 && !j.changeGiven);
  const JOB_TONE = { Waiting: 'warn', Printing: 'info', Completed: 'good' };
  const JOB_ICON = { Waiting: 'clock', Printing: 'printer', Completed: 'check' };

  // Dashboard
  return (
    <div className={`adminApp ${theme}Mode`}>
      <aside className="admSide">
        <div className="admBrand">
          <div className="admBrandMark" aria-hidden="true">J</div>
          <div>
            <div className="admBrandName">JASRAIN</div>
            <div className="admBrandSub">Staff</div>
          </div>
        </div>

        <nav aria-label="Staff sections" style={{ display: 'contents' }}>
          <button type="button" className={`admNavLink${section === 'print' ? ' active' : ''}`} onClick={() => setSection('print')}>
            <Icon name="printer" size={18} /> Print queue
            {waiting > 0 && <span className="admNavCount">{waiting}</span>}
          </button>
          <button type="button" className={`admNavLink${section === 'orders' ? ' active' : ''}`} onClick={() => setSection('orders')}>
            <Icon name="receipt" size={18} /> Store orders
            {todoCount > 0 && <span className="admNavCount">{todoCount}</span>}
          </button>
        </nav>
      </aside>

      <div className="admMain">
        <div className="admTopbar">
          <span className="admWho">Signed in as <b>staff</b></span>
          <a className="admIconBtn" href="/" target="_blank" rel="noopener noreferrer" title="Kiosk (new tab)" aria-label="Open kiosk in a new tab">
            <Icon name="cart" size={19} />
          </a>
          <button className="admIconBtn" onClick={toggleTheme} aria-label="Switch light or dark mode">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
          <button className="admBtn" onClick={logout}>Sign out</button>
        </div>

        <main className="admContent">
          {section === 'orders' ? (
            <OrdersPanel />
          ) : (
            <>
              <PageHeader
                title="Print queue"
                subtitle="Customers who have paid and are waiting for their prints."
                actions={
                  <button className="admBtn primary" onClick={nextQueue} disabled={waiting === 0}>
                    <Icon name="megaphone" size={17} /> Call next
                  </button>
                }
              />

              <div className="admGrid c4">
                <StatCard label="Now printing" value={printing ? printing.queueNumber : '—'} tone={printing ? undefined : undefined} />
                <StatCard label="Waiting" value={int(waiting)} tone={waiting ? 'warn' : undefined} />
                <StatCard label="Done today" value={int(done.length)} />
                <StatCard
                  label="Change owed"
                  value={peso(owedJobs.reduce((n, j) => n + j.change, 0))}
                  tone={owedJobs.length ? 'warn' : undefined}
                  sub="To hand to customers"
                />
              </div>

              <Card
                actions={
                  <Segmented
                    label="Show"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'active', label: 'Active', count: active.length },
                      { value: 'done', label: 'Done', count: done.length },
                    ]}
                  />
                }
              >
                {shown.length === 0 ? (
                  <EmptyState icon="check-circle" title={tab === 'active' ? 'No one in line' : 'Nothing finished yet'} />
                ) : (
                  <div className="admTableWrap">
                    <table className="admTable">
                      <thead>
                        <tr><th>Queue</th><th>File</th><th>Details</th><th>Submitted</th><th className="num">Total</th><th>Status</th><th /></tr>
                      </thead>
                      <tbody>
                        {shown.map((job) => {
                          const canOpen = isPdf(job.fileName) || isImage(job.fileName);
                          return (
                            <tr key={job.id} className={job.status === 'Printing' ? 'stfRowNow' : ''}>
                              <td><span className="stfNum">{job.queueNumber}</span></td>
                              <td>
                                <div className="stfFile" title={job.fileName}>
                                  <b>{job.fileName}</b>
                                  <small>{formatSize(job.fileSize)}</small>
                                </div>
                              </td>
                              <td>
                                {job.pages} pg × {job.copies}
                                <div className="stfMeta">{job.color === 'bw' ? 'B&W' : 'Color'} · {job.paperSize}</div>
                              </td>
                              <td>
                                {timeAgo(job.createdAt)}
                                <div className="stfMeta">
                                  {job.payment}
                                  {job.change > 0 && (job.changeGiven
                                    ? ` · change ${peso(job.change)} given`
                                    : '')}
                                </div>
                                {job.change > 0 && !job.changeGiven && (
                                  <div className="stfMeta"><b style={{ color: 'var(--crit)' }}>Owes change {peso(job.change)}</b></div>
                                )}
                              </td>
                              <td className="num">{peso(job.total)}</td>
                              <td><Badge tone={JOB_TONE[job.status]} icon={JOB_ICON[job.status]}>{job.status}</Badge></td>
                              <td>
                                <div className="stfActions">
                                  {job.hasFile && (
                                    <>
                                      <button className="admBtn sm" onClick={() => handleView(job)}title="View file"><Icon name="eye" size={15} /> View</button>
                                      {canOpen && <button className="admBtn sm" onClick={() => handleOpenTab(job)}title="Open in a new tab to print"><Icon name="printer" size={15} /> Open to print</button>}
                                      <button className="admBtn sm" onClick={() => handleDownload(job)} title="Download file"><Icon name="download" size={15} /></button>
                                    </>
                                  )}
                                  {job.change > 0 && !job.changeGiven && (
                                    <button className="admBtn sm primary" onClick={() => giveChange(job.queueNumber)}>
                                      Gave change {peso(job.change)}
                                    </button>
                                  )}
                                  {job.status === 'Waiting' && (
                                    <button className="admBtn sm primary" onClick={() => startQueue(job.queueNumber)}>Start printing</button>
                                  )}
                                  {job.status === 'Printing' && (
                                    <button className="admBtn sm primary" onClick={() => completeQueue(job.queueNumber)}><Icon name="check" size={15} /> Done</button>
                                  )}
                                  <button className="admBtn sm" onClick={() => handleRemove(job)} title="Remove" aria-label={`Remove ${job.queueNumber}`}><Icon name="trash" size={15} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>

      {/* file preview  */}
      {preview && (
        <Modal
          title={`${preview.job.queueNumber} · ${preview.name}`}
          size="lg stfWide"
          onClose={() => setPreview(null)}
          footer={
            <>
              <span className="stfMeta" style={{ marginRight: 'auto' }}>
                {preview.job.pages} pg × {preview.job.copies} · {preview.job.color === 'bw' ? 'Black & White' : 'Color'} · {preview.job.paperSize} · {peso(preview.job.total)}
              </span>
              <button className="admBtn" onClick={() => handleDownload(preview.job)}><Icon name="download" size={16} /> Download</button>
              <button className="admBtn primary" onClick={() => setPreview(null)}>Close</button>
            </>
          }
        >
          <div className="stfPreview">
            {isPdf(preview.name) && <iframe title="PDF preview" src={preview.url} />}
            {isImage(preview.name) && <img src={preview.url} alt={preview.name} />}
            {!isPdf(preview.name) && !isImage(preview.name) && (
              <div className="stfNoPreview">
                <Icon name="file" size={52} strokeWidth={1.5} />
                <h3>No preview for this file type</h3>
                <p>Download it and open it in Word, Excel or PowerPoint.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
