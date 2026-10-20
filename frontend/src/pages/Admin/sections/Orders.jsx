import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useOrders } from '../../../context/OrderContext';
import { useQueueContext } from '../../../context/QueueContext';
import { toCSV, downloadText } from '../../../utils/csv';
import { peso, int, dateTime } from '../../../utils/format';
import { PageHeader, Card, Badge, Segmented, EmptyState, Modal } from '../components/ui';
import Icon from '../../../components/Icon';

const TONE = { Paid: 'good', Unpaid: 'warn', Cancelled: 'neutral', Completed: 'good', Waiting: 'warn', Printing: 'info' };
const ICON = { Paid: 'check', Unpaid: 'alert', Cancelled: 'x', Completed: 'check', Waiting: 'clock', Printing: 'printer' };
const DATES = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

function inDate(iso, key) {
  if (key === 'all') return true;
  const t = new Date(iso);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (key !== 'today') from.setDate(from.getDate() - (Number(key) - 1));
  return t >= from;
}

export default function Orders() {
  const { orders, markPaid, cancelOrder } = useOrders();
  const { queue } = useQueueContext();
  const [tab, setTab] = useState('orders');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('all');
  const [open, setOpen] = useState(null);

  const list = tab === 'orders' ? orders : queue;
  const idOf = (x) => (tab === 'orders' ? x.orderNumber : x.queueNumber);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list
      .filter((x) => status === 'all' || x.status === status)
      .filter((x) => inDate(x.createdAt, date))
      .filter((x) => {
        if (!term) return true;
        const hay = tab === 'orders' ? `${x.orderNumber} ${x.items.map((i) => i.name).join(' ')}` : `${x.queueNumber} ${x.fileName || ''}`;
        return hay.toLowerCase().includes(term);
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [list, q, status, date, tab]);

  const statuses = tab === 'orders' ? ['Unpaid', 'Paid', 'Cancelled'] : ['Waiting', 'Printing', 'Completed'];
  const unpaid = orders.filter((o) => o.status === 'Unpaid').length;
  const total = rows.filter((x) => x.status === 'Paid' || x.status === 'Completed').reduce((s, x) => s + Number(x.total), 0);
  const current = open && list.find((x) => idOf(x) === open);

  const switchTab = (t) => { setTab(t); setStatus('all'); setOpen(null); };

  const exportCSV = () =>
    downloadText(
      `${tab === 'orders' ? 'orders' : 'print-jobs'}-${new Date().toISOString().slice(0, 10)}.csv`,
      tab === 'orders'
        ? toCSV(rows.map((o) => ({ no: o.orderNumber, at: o.createdAt, status: o.status, payment: o.payment, items: o.items.map((i) => `${i.quantity}x ${i.name}`).join('; '), total: o.total, paidAt: o.paidAt || '' })),
            [{ key: 'no', label: 'Order' }, { key: 'at', label: 'Placed' }, { key: 'status', label: 'Status' }, { key: 'payment', label: 'Payment' }, { key: 'items', label: 'Items' }, { key: 'total', label: 'Total' }, { key: 'paidAt', label: 'Paid at' }])
        : toCSV(rows.map((j) => ({ no: j.queueNumber, at: j.createdAt, status: j.status, file: j.fileName || '', pages: j.pages, copies: j.copies, color: j.color, paper: j.paperSize, total: j.total })),
            [{ key: 'no', label: 'Queue no.' }, { key: 'at', label: 'Submitted' }, { key: 'status', label: 'Status' }, { key: 'file', label: 'File' }, { key: 'pages', label: 'Pages' }, { key: 'copies', label: 'Copies' }, { key: 'color', label: 'Color' }, { key: 'paper', label: 'Paper' }, { key: 'total', label: 'Total' }])
    );

  const pay = (o) => { markPaid(o.orderNumber); toast.success(`${o.orderNumber} marked as paid`); };
  const cancel = (o) => {
    if (!window.confirm(`Cancel ${o.orderNumber}? The items go back into stock.`)) return;
    cancelOrder(o.orderNumber);
    toast.info(`${o.orderNumber} cancelled`);
  };

  return (
    <>
      <PageHeader
        title="Orders & printing"
        subtitle="Everything customers placed at the kiosk."
        actions={
          <>
            <Segmented label="Type" value={tab} onChange={switchTab}
              options={[{ value: 'orders', label: 'Store orders', count: unpaid || undefined }, { value: 'print', label: 'Print jobs' }]} />
            <button className="admBtn" onClick={exportCSV} disabled={!rows.length}><Icon name="download" size={16} /> Export CSV</button>
          </>
        }
      />

      <Card>
        <div className="admToolbar" style={{ marginBottom: 12 }}>
          <input type="search" placeholder={tab === 'orders' ? 'Search order number or item' : 'Search queue number or file'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date">
            {DATES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={tab === 'orders' ? 'receipt' : 'printer'} title="Nothing matches" hint="Try a different search or date range." />
        ) : (
          <div className="admTableWrap">
            <table className="admTable">
              <thead>
                {tab === 'orders' ? (
                  <tr><th>Order</th><th>Placed</th><th>Items</th><th>Payment</th><th className="num">Total</th><th>Status</th><th /></tr>
                ) : (
                  <tr><th>Queue</th><th>Submitted</th><th>File</th><th>Details</th><th className="num">Total</th><th>Status</th><th /></tr>
                )}
              </thead>
              <tbody>
                {rows.slice(0, 200).map((x) => (
                  <tr key={x.id}>
                    <td><b>{idOf(x)}</b>{x.demo && <span className="admMuted"> · sample</span>}</td>
                    <td>{dateTime(x.createdAt)}</td>
                    {tab === 'orders' ? (
                      <>
                        <td>{int(x.items.reduce((s, i) => s + i.quantity, 0))} items</td>
                        <td>{x.payment}</td>
                      </>
                    ) : (
                      <>
                        <td>{x.fileName || '—'}</td>
                        <td>{x.pages} pg × {x.copies} · {x.color === 'color' ? 'Color' : 'B&W'} · {x.paperSize}</td>
                      </>
                    )}
                    <td className="num">{peso(x.total)}</td>
                    <td><Badge tone={TONE[x.status]} icon={ICON[x.status]}>{x.status}</Badge></td>
                    <td className="num"><button className="admBtn sm" onClick={() => setOpen(idOf(x))}>View</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>{int(rows.length)} shown{rows.length > 200 ? ' (first 200)' : ''}</td><td className="num">{peso(total)}</td><td colSpan={2} className="admMuted">paid / completed</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {current && tab === 'orders' && (
        <Modal
          title={`Order ${current.orderNumber}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              {current.status === 'Unpaid' && <button className="admBtn danger" onClick={() => { cancel(current); setOpen(null); }}>Cancel order</button>}
              {current.status === 'Unpaid' && <button className="admBtn primary" onClick={() => { pay(current); setOpen(null); }}>Mark as paid</button>}
              <button className="admBtn" onClick={() => setOpen(null)}>Close</button>
            </>
          }
        >
          <p><Badge tone={TONE[current.status]} icon={ICON[current.status]}>{current.status}</Badge> <span className="admMuted"> {current.payment} · placed {dateTime(current.createdAt)}{current.paidAt ? ` · paid ${dateTime(current.paidAt)}` : ''}</span></p>
          {current.cashReceived != null && (
            <p className="admCallout">
              Cash inserted <b>{peso(current.cashReceived)}</b>
              {current.change > 0 && <> · change <b>{peso(current.change)}</b> {current.changeGiven ? '(given)' : <span className="admBad"><Icon name="alert" size={13} /> not given yet</span>}</>}
            </p>
          )}
          <div className="admTableWrap">
            <table className="admTable">
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {current.items.map((i) => (
                  <tr key={i.barcode}><td>{i.name}</td><td className="num">{i.quantity}</td><td className="num">{peso(i.price)}</td><td className="num">{peso(i.price * i.quantity)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="num">{peso(current.total)}</td></tr></tfoot>
            </table>
          </div>
        </Modal>
      )}

      {current && tab === 'print' && (
        <Modal
          title={`Print job ${current.queueNumber}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Link className="admBtn primary" to="/staff">Open staff screen</Link>
              <button className="admBtn" onClick={() => setOpen(null)}>Close</button>
            </>
          }
        >
          <p><Badge tone={TONE[current.status]} icon={ICON[current.status]}>{current.status}</Badge> <span className="admMuted"> submitted {dateTime(current.createdAt)}</span></p>
          <ul className="admList">
            <li className="admListItem"><span>File</span><b>{current.fileName || '—'}</b></li>
            <li className="admListItem"><span>Pages × copies</span><b>{current.pages} × {current.copies}</b></li>
            <li className="admListItem"><span>Ink</span><b>{current.color === 'color' ? 'Color' : 'Black & white'}</b></li>
            <li className="admListItem"><span>Paper</span><b>{current.paperSize}</b></li>
            <li className="admListItem"><span>Total</span><b>{peso(current.total)}</b></li>
            {current.cashReceived != null && (
              <li className="admListItem"><span>Cash inserted</span><b>{peso(current.cashReceived)}{current.change > 0 ? ` · change ${peso(current.change)} ${current.changeGiven ? '(given)' : '(not given yet)'}` : ''}</b></li>
            )}
          </ul>
          <p className="admHint">Printing and status changes are done on the staff screen, where the uploaded file can be opened.</p>
        </Modal>
      )}
    </>
  );
}
