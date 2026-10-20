import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useProducts } from '../../../context/ProductContext';
import { useAlerts } from '../../../hooks/useAlerts';
import { useReport } from '../../../hooks/useReport';
import { desktopNotify } from '../../../hooks/useStockNotifier';
import { stockStatus, suggestReorder, STOCK } from '../../../utils/analytics';
import { toCSV, downloadText } from '../../../utils/csv';
import { peso, int } from '../../../utils/format';
import { PageHeader, Card, StatCard, Badge, EmptyState } from '../components/ui';
import ProdCell from '../components/ProdCell';
import Icon from '../../../components/Icon';

const COVER_DAYS = 14;

function AlertRow({ a }) {
  return (
    <Link to={a.to} className={`admAlertRow ${a.level}`}>
      <Icon name={a.icon} size={24} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{a.title}</strong>
        <span>{a.detail}</span>
      </div>
      <Badge tone={a.level === 'critical' ? 'critical' : 'warn'}>{a.level === 'critical' ? 'Critical' : 'Warning'}</Badge>
    </Link>
  );
}

export default function Alerts() {
  const { activeProducts } = useProducts();
  const alerts = useAlerts();
  const stats30 = useReport('30d').stats;
  const [overrides, setOverrides] = useState({});
  const [perm, setPerm] = useState(desktopNotify.permission());
  const [notifyOn, setNotifyOn] = useState(desktopNotify.enabled());

  const reorder = useMemo(() => {
    const byCode = {};
    stats30.forEach((s) => { byCode[s.barcode] = s; });
    return activeProducts
      .filter((p) => stockStatus(p) !== STOCK.OK)
      .map((p) => {
        const s = byCode[p.barcode];
        const suggested = s
          ? Math.max(suggestReorder(s, COVER_DAYS), p.critical * 2 - p.stock, 1)
          : Math.max(p.critical * 2 - p.stock, 1);
        return { p, status: stockStatus(p), velocity: s ? s.velocity : 0, suggested };
      })
      .sort((a, b) => a.p.stock - b.p.stock || a.p.name.localeCompare(b.p.name));
  }, [activeProducts, stats30]);

  const qtyOf = (r) => {
    const raw = overrides[r.p.barcode];
    if (raw === undefined) return r.suggested;
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const total = reorder.reduce((s, r) => s + qtyOf(r) * r.p.cost, 0);

  const listText = () => {
    const lines = reorder.filter((r) => qtyOf(r) > 0).map((r) => `• ${r.p.name} — ${qtyOf(r)} pcs (${peso(qtyOf(r) * r.p.cost)})`);
    return `Reorder list · ${new Date().toLocaleDateString('en-PH')}\n${lines.join('\n')}\nEstimated cost: ${peso(total)}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listText());
      toast.success('Reorder list copied. Paste it into Messenger or a note.');
    } catch (e) {
      toast.error('Could not copy. Use Download CSV instead.');
    }
  };

  const download = () =>
    downloadText(
      `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(
        reorder.map((r) => ({
          barcode: r.p.barcode, name: r.p.name, in_stock: r.p.stock, critical: r.p.critical,
          order_qty: qtyOf(r), unit_cost: r.p.cost, est_cost: qtyOf(r) * r.p.cost,
        })),
        [
          { key: 'barcode', label: 'Barcode' }, { key: 'name', label: 'Product' }, { key: 'in_stock', label: 'In stock' },
          { key: 'critical', label: 'Critical level' }, { key: 'order_qty', label: 'Order qty' },
          { key: 'unit_cost', label: 'Unit cost' }, { key: 'est_cost', label: 'Estimated cost' },
        ]
      )
    );

  const enableNotify = async () => {
    const result = await desktopNotify.turnOn();
    setPerm(desktopNotify.permission());
    setNotifyOn(result === 'granted');
    if (result === 'granted') toast.success('Desktop notifications are on.');
    else if (result === 'unsupported') toast.error('This browser does not support desktop notifications.');
    else toast.error('Notifications are blocked. Allow them in your browser’s site settings, then try again.');
  };
  const disableNotify = () => {
    desktopNotify.set(false);
    setNotifyOn(false);
  };

  const other = alerts.items.filter((a) => a.kind !== 'stock');

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Stock that has hit its critical level, and anything that has been waiting too long."
      />

      <div className="admGrid c3">
        <StatCard label="Out of stock" value={int(alerts.outCount)} tone={alerts.outCount ? 'critical' : undefined} sub="Customers cannot buy these" />
        <StatCard label="Low stock" value={int(alerts.lowCount)} tone={alerts.lowCount ? 'warn' : undefined} sub="At or below the critical level" />
        <StatCard label="Waiting too long" value={int(other.length)} sub="Unpaid orders and print jobs" />
      </div>

      <div className="admGrid main2">
        <Card title="All alerts" subtitle="Worst first. Tap one to fix it.">
          {alerts.items.length === 0 ? (
            <EmptyState icon="check-circle" title="All clear" hint="Every item is above its critical level and nothing is waiting too long." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.items.map((a) => <AlertRow key={a.id} a={a} />)}
            </div>
          )}
        </Card>

        <Card title="How you get notified">
          <ul className="admInsights">
            <li><b>The bell icon</b> at the top shows the number of open alerts on every admin page.</li>
            <li><b>A pop-up</b> appears when you sign in, and again the moment an item newly runs low or out while this page is open.</li>
            <li>
              <b>Desktop notifications</b> can show even when this tab is in the background.
              <div style={{ marginTop: 8 }}>
                {notifyOn ? (
                  <div className="admRow" style={{ alignItems: 'center' }}>
                    <Badge tone="good">On</Badge>
                    <button className="admBtn sm" onClick={disableNotify}>Turn off</button>
                  </div>
                ) : (
                  <button className="admBtn sm" onClick={enableNotify} disabled={perm === 'denied' && desktopNotify.supported()}>
                    Turn on desktop notifications
                  </button>
                )}
                {perm === 'denied' && desktopNotify.supported() && (
                  <p className="admHint">Blocked by your browser. Allow notifications for this site in the address bar, then reload.</p>
                )}
              </div>
            </li>
          </ul>
          <p className="admHint">Notifications only work while the admin page is open in a browser. Texts or emails to your phone need the online version of the system.</p>
        </Card>
      </div>

      <Card
        title="Reorder list"
        subtitle={`Enough to last about ${COVER_DAYS} days at your recent pace (last 30 days of sales). You can change any quantity.`}
        actions={
          reorder.length > 0 && (
            <>
              <button className="admBtn sm" onClick={copy}>Copy list</button>
              <button className="admBtn sm" onClick={download}><Icon name="download" size={16} /> CSV</button>
            </>
          )
        }
      >
        {reorder.length === 0 ? (
          <EmptyState icon="cart" title="Nothing to reorder" hint="Items show up here when they reach their critical level." />
        ) : (
          <>
            <div className="admTableWrap">
              <table className="admTable">
                <thead>
                  <tr>
                    <th>Product</th><th>Status</th><th className="num">In stock</th><th className="num">Critical level</th>
                    <th className="num">Sells / day</th><th className="num">Order qty</th>
                    <th className="num">Unit cost</th><th className="num">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {reorder.map((r) => (
                    <tr key={r.p.barcode}>
                      <td><ProdCell p={r.p} /></td>
                      <td>{r.status === STOCK.OUT ? <Badge tone="critical">Out of stock</Badge> : <Badge tone="warn">Low</Badge>}</td>
                      <td className="num">{int(r.p.stock)}</td>
                      <td className="num">{int(r.p.critical)}</td>
                      <td className="num">{r.velocity > 0 ? r.velocity.toFixed(1) : '—'}</td>
                      <td className="num">
                        <input
                          className="admQtyInput"
                          type="number"
                          min="0"
                          step="1"
                          value={overrides[r.p.barcode] ?? r.suggested}
                          onChange={(e) => setOverrides((o) => ({ ...o, [r.p.barcode]: e.target.value }))}
                          aria-label={`Order quantity for ${r.p.name}`}
                        />
                      </td>
                      <td className="num">{peso(r.p.cost)}</td>
                      <td className="num">{peso(qtyOf(r) * r.p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className="num"><b>Estimated total</b></td>
                    <td className="num"><b>{peso(total)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="admHint">When the delivery arrives, record it with <Link to="/admin/inventory" className="admLinkBtn">Inventory, Adjust, Receive</Link>.</p>
          </>
        )}
      </Card>
    </>
  );
}
