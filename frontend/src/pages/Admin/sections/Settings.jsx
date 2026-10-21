import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useSettings } from '../../../context/SettingsContext';
import { useProducts } from '../../../context/ProductContext';
import { useOrders } from '../../../context/OrderContext';
import { useQueueContext } from '../../../context/QueueContext';
import { exportAll, resetAll } from '../../../utils/backup';
import { applyDemoData, clearDemoData } from '../../../utils/demoData';
import { downloadText } from '../../../utils/csv';
import { PageHeader, Card, Field } from '../components/ui';
import Icon from '../../../components/Icon';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const { products, refreshProducts } = useProducts();
  const { orders, refreshOrders } = useOrders();
  const { queue, refreshQueue } = useQueueContext();
  const [bw, setBw] = useState(String(settings.printRates.bw));
  const [color, setColor] = useState(String(settings.printRates.color));
  const [crit, setCrit] = useState(String(settings.defaultCritical));
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  // sample records are marked as demo in the database
  const demo = orders.some((o) => o.demo) || queue.some((j) => j.demo);

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

  const reloadLists = () => Promise.all([refreshOrders(), refreshQueue(), refreshProducts()]);

  const loadDemo = async () => {
    setBusy(true);
    try {
      await applyDemoData(products, settings.printRates);
      await reloadLists();
      toast.success('Sample data loaded');
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const removeDemo = async () => {
    if (!window.confirm('Remove all sample data?')) return;
    setBusy(true);
    try {
      await clearDemoData();
      await reloadLists();
      toast.success('Sample data removed');
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const backup = async () => {
    try {
      downloadText(`jasrain-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll(), 'application/json');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const erase = async () => {
    try {
      await resetAll();
    } catch (e) {
      toast.error(e.message);
    }
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
          <button className="admBtn" disabled={busy} onClick={removeDemo}>Remove sample data</button>
        ) : (
          <button className="admBtn primary" disabled={busy} onClick={loadDemo}>Load sample data</button>
        )}
      </Card>

      <Card title="Backup" subtitle="Your data is saved in the MySQL database.">
        <p className="admMuted">Download a copy of the database as a file. Uploaded print files and logins are not included. For a full backup you can also use Data Export in MySQL Workbench.</p>
        <div className="admToolbar">
          <button className="admBtn primary" onClick={backup}><Icon name="download" size={16} /> Download backup</button>
        </div>
      </Card>

      <Card title="Good to know">
        <ul className="admInsights">
          <li>Logins are checked by the server and passwords are stored hashed. To add a user or change a password, run <b>node scripts/create-user.js</b> in the backend folder.</li>
          <li>Orders, stock and the print queue are shared by every computer that uses the same backend.</li>
        </ul>
      </Card>

      <Card title="Danger zone" subtitle="Erase products, stock, orders, print jobs and prices. Logins are kept.">
        <div className="admToolbar">
          <input placeholder='Type RESET to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type RESET to confirm" />
          <button className="admBtn danger" disabled={confirm !== 'RESET'} onClick={erase}>Erase all data</button>
        </div>
      </Card>
    </>
  );
}
