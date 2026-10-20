import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useSettings } from '../../../context/SettingsContext';
import { exportAll, importAll, resetAll } from '../../../utils/backup';
import { hasDemoData, applyDemoData, clearDemoData } from '../../../utils/demoData';
import { downloadText } from '../../../utils/csv';
import { PageHeader, Card, Field } from '../components/ui';
import Icon from '../../../components/Icon';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [bw, setBw] = useState(String(settings.printRates.bw));
  const [color, setColor] = useState(String(settings.printRates.color));
  const [crit, setCrit] = useState(String(settings.defaultCritical));
  const [confirm, setConfirm] = useState('');
  const fileRef = useRef(null);
  const demo = hasDemoData();

  const saveRates = () => {
    const b = Number(bw), c = Number(color);
    if (!(b >= 0) || !(c >= 0) || bw === '' || color === '') return toast.error('Enter a valid price for both rates.');
    updateSettings({ printRates: { bw: b, color: c } });
    toast.success('Print prices saved');
  };
  const saveCrit = () => {
    const n = Math.floor(Number(crit));
    if (!(n >= 0) || crit === '') return toast.error('Enter a whole number, 0 or more.');
    updateSettings({ defaultCritical: n });
    toast.success('Default critical level saved');
  };
  const backup = () => downloadText(`jasrain-backup-${new Date().toISOString().slice(0, 10)}.json`, exportAll(), 'application/json');
  const restore = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!window.confirm('Restoring replaces ALL current data with the backup. Continue?')) { e.target.value = ''; return; }
    const res = await importAll(f);
    if (!res.ok) toast.error(res.message);
    e.target.value = '';
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Prices, alerts and your data." />

      <div className="admGrid c2">
        <Card title="Print prices" subtitle="Per sheet. New print jobs use these prices.">
          <div className="admForm">
            <Field label="Black & white (₱)"><input type="number" min="0" step="0.5" value={bw} onChange={(e) => setBw(e.target.value)} /></Field>
            <Field label="Color (₱)"><input type="number" min="0" step="0.5" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
            <button className="admBtn primary" onClick={saveRates}>Save prices</button>
          </div>
        </Card>

        <Card title="Stock alerts" subtitle="Used when a product has no critical level of its own.">
          <div className="admForm">
            <Field label="Default critical level" hint="You are warned when stock is at or below this number."><input type="number" min="0" step="1" value={crit} onChange={(e) => setCrit(e.target.value)} /></Field>
            <button className="admBtn primary" onClick={saveCrit}>Save</button>
          </div>
        </Card>
      </div>

      <Card title="Sample data" subtitle="Fill the reports with 30 days of pretend sales to see how the dashboard works.">
        <p className="admMuted">Sample records are marked and never mixed into your real numbers once removed. Your real orders and stock stay untouched.</p>
        {demo ? (
          <button className="admBtn" onClick={() => window.confirm('Remove all sample data?') && clearDemoData()}>Remove sample data</button>
        ) : (
          <button className="admBtn primary" onClick={applyDemoData}>Load sample data</button>
        )}
      </Card>

      <Card title="Backup & restore" subtitle="Your data lives in this browser only.">
        <p className="admMuted">Download a backup regularly. Clearing browser data or switching computers will lose everything that is not backed up. Uploaded print files are not included.</p>
        <div className="admToolbar">
          <button className="admBtn primary" onClick={backup}><Icon name="download" size={16} /> Download backup</button>
          <button className="admBtn" onClick={() => fileRef.current && fileRef.current.click()}>Restore from file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </div>
      </Card>

      <Card title="Good to know">
        <ul className="admInsights">
          <li>The admin login (<b>admin / admin123</b>) is checked in the browser only. It keeps customers out of the screen but is not real security. Real accounts need a backend.</li>
          <li>Orders and stock do not sync between computers until a database is added.</li>
        </ul>
      </Card>

      <Card title="Danger zone" subtitle="Erase everything: products, stock, orders, print queue and settings.">
        <div className="admToolbar">
          <input placeholder='Type RESET to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type RESET to confirm" />
          <button className="admBtn danger" disabled={confirm !== 'RESET'} onClick={resetAll}>Erase all data</button>
        </div>
      </Card>
    </>
  );
}
