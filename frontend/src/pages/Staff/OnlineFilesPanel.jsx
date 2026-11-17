import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Icon from '../../components/Icon';
import { usePolling } from '../../hooks/usePolling';
import { PageHeader, Card, EmptyState, Field, Badge } from '../Admin/components/ui';
import { timeAgo } from '../../utils/format';
import { listOnlineFiles, attachOnlineFile, removeOnlineFile } from '../../utils/incoming';

const formatSize = (b = 0) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

// Staff: put the file a customer sent on Messenger or email here, so they can find it at the kiosk.
export default function OnlineFilesPanel() {
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState('messenger');
  const [owner, setOwner] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const load = useCallback(async () => {
    try {
      setRows(await listOnlineFiles());
    } catch (e) {
      /* keep the old list */
    }
  }, []);
  usePolling(load, 10000, 'online');

  const save = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose the file first.');
    setBusy(true);
    try {
      await attachOnlineFile(source, owner, file);
      toast.success('Saved. The customer can find it at the kiosk now.');
      setFile(null);
      setOwner('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete ${r.fileName}?`)) return;
    try {
      await removeOnlineFile(r.id);
    } catch (err) {
      toast.error(err.message);
    }
    load();
  };

  return (
    <>
      <PageHeader title="Online files" subtitle="Files customers sent on Messenger or email. Add them here so they can print at the kiosk. They are deleted after 24 hours." />

      <Card title="Add a file">
        <form onSubmit={save} className="stfOnlineForm">
          <Field label="Sent through">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="messenger">Messenger</option>
              <option value="email">Email</option>
            </select>
          </Field>
          <Field label={source === 'email' ? 'Customer email' : 'Customer Messenger name'}>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={source === 'email' ? 'juan@gmail.com' : 'Juan Dela Cruz'}
              type={source === 'email' ? 'email' : 'text'}
            />
          </Field>
          <Field label="File">
            <input ref={input} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files[0] || null)} />
          </Field>
          <button className="admBtn primary" type="submit" disabled={busy || !owner || !file}>
            <Icon name="upload" size={17} /> {busy ? 'Saving…' : 'Save for customer'}
          </button>
        </form>
        <p className="stfHint">Type the name exactly as it shows on Messenger, or the email it came from. The customer types the same thing at the kiosk.</p>
      </Card>

      <Card title="Waiting to be printed">
        {rows.length === 0 ? (
          <EmptyState icon="inbox" title="No online files right now" />
        ) : (
          <div className="admTableWrap">
            <table className="admTable">
              <thead><tr><th>Customer</th><th>File</th><th>Through</th><th>Added</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.owner}</td>
                    <td><div className="stfFile"><b>{r.fileName}</b><small>{formatSize(r.fileSize)}</small></div></td>
                    <td><Badge tone="info">{r.source === 'email' ? 'Email' : 'Messenger'}</Badge></td>
                    <td>{timeAgo(r.createdAt)}</td>
                    <td><button className="admBtn" onClick={() => remove(r)}><Icon name="trash" size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
