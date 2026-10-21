import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useProducts } from '../../../context/ProductContext';
import { useReport } from '../../../hooks/useReport';
import { stockStatus, STOCK } from '../../../utils/analytics';
import { toCSV, downloadText } from '../../../utils/csv';
import { peso, int, dateTime } from '../../../utils/format';
import { PageHeader, Card, StatCard, Badge, Segmented, EmptyState, Modal, Field } from '../components/ui';
import { StockMeter } from '../components/charts';
import ProdCell from '../components/ProdCell';
import Icon from '../../../components/Icon';

const REASONS = {
  add: ['Restock from supplier', 'Customer return', 'Found / correction'],
  remove: ['Damaged', 'Expired', 'Lost or stolen', 'Used in store', 'Correction'],
  set: ['Stock count'],
};

const MODES = [
  { value: 'add', label: '＋ Receive' },
  { value: 'remove', label: '－ Remove' },
  { value: 'set', label: '＝ Set count' },
];

const todayStamp = () => new Date().toISOString().slice(0, 10);

// adjust stock
function AdjustModal({ product, onClose, onSave }) {
  const [mode, setMode] = useState('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(REASONS.add[0]);
  const [note, setNote] = useState('');

  const n = Math.floor(Number(qty));
  const valid = qty !== '' && Number.isFinite(n) && (mode === 'set' ? n >= 0 : n >= 1);
  const after = !valid
    ? product.stock
    : mode === 'add' ? product.stock + n : mode === 'remove' ? Math.max(0, product.stock - n) : n;
  const tooMany = mode === 'remove' && valid && n > product.stock;

  const changeMode = (m) => {
    setMode(m);
    setReason(REASONS[m][0]);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      barcode: product.barcode,
      ...(mode === 'set' ? { setTo: n } : { delta: mode === 'add' ? n : -n }),
      reason,
      note: note.trim(),
    });
  };

  return (
    <Modal
      title="Adjust stock"
      onClose={onClose}
      footer={
        <>
          <button className="admBtn" type="button" onClick={onClose}>Cancel</button>
          <button className="admBtn primary" type="submit" form="adjustForm" disabled={!valid}>Save</button>
        </>
      }
    >
      <form id="adjustForm" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProdCell p={product} sub={`${product.barcode} · ${int(product.stock)} in stock now`} />

        <Segmented label="Type of change" value={mode} onChange={changeMode} options={MODES} />

        <div className="admFormGrid">
          <Field label={mode === 'set' ? 'Counted quantity' : 'Quantity'} error={tooMany ? `Only ${product.stock} in stock. Stock will go to 0.` : ''}>
            <input type="number" inputMode="numeric" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </Field>
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS[mode].map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <div className="full">
            <Field label="Note (optional)" hint="For example the supplier name or receipt number.">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
            </Field>
          </div>
        </div>

        <div className="admCallout">
          Stock after saving: <strong>{int(after)}</strong>
          {valid && after !== product.stock && (
            <span className="admMuted"> ({after > product.stock ? '+' : '−'}{int(Math.abs(after - product.stock))})</span>
          )}
        </div>
      </form>
    </Modal>
  );
}

// page
export default function Inventory() {
  const { products, log, applyMovements } = useProducts();
  const stats30 = useReport('30d').stats;
  const [params, setParams] = useSearchParams();

  const filter = ['critical', 'ok'].includes(params.get('filter')) ? params.get('filter') : 'all';
  const setFilter = (v) => setParams(v === 'all' ? {} : { filter: v }, { replace: true });

  const [tab, setTab] = useState('stock');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState('name');
  const [adjusting, setAdjusting] = useState(null);

  const [logQuery, setLogQuery] = useState('');
  const [logReason, setLogReason] = useState('All');

  const velocity = useMemo(() => {
    const map = {};
    stats30.forEach((s) => { map[s.barcode] = s; });
    return map;
  }, [stats30]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);

  const visible = useMemo(() => products.filter((p) => showArchived || p.active), [products, showArchived]);

  const totals = useMemo(() => {
    const live = products.filter((p) => p.active);
    return {
      count: live.length,
      units: live.reduce((s, p) => s + p.stock, 0),
      cost: live.reduce((s, p) => s + p.stock * p.cost, 0),
      retail: live.reduce((s, p) => s + p.stock * p.price, 0),
    };
  }, [products]);

  const counts = useMemo(() => {
    const c = { all: visible.length, critical: 0, ok: 0 };
    visible.forEach((p) => {
      if (stockStatus(p) === STOCK.OK) c.ok += 1;
      else c.critical += 1;
    });
    return c;
  }, [visible]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = visible
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))
      .filter((p) => {
        const st = stockStatus(p);
        return filter === 'all' || (filter === 'ok' ? st === STOCK.OK : st !== STOCK.OK);
      })
      .map((p) => ({ p, status: stockStatus(p), daysLeft: velocity[p.barcode]?.daysLeft ?? null }));

    const by = {
      name: (a, b) => a.p.name.localeCompare(b.p.name),
      low: (a, b) => a.p.stock - b.p.stock,
      value: (a, b) => b.p.stock * b.p.cost - a.p.stock * a.p.cost,
      cover: (a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity),
    };
    return list.sort(by[sort]);
  }, [visible, query, category, filter, sort, velocity]);

  const logRows = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    return log
      .filter((l) => logReason === 'All' || l.reason === logReason)
      .filter((l) => !q || l.name.toLowerCase().includes(q) || (l.note || '').toLowerCase().includes(q))
      .slice()
      .reverse();
  }, [log, logQuery, logReason]);

  const logReasons = useMemo(() => ['All', ...Array.from(new Set(log.map((l) => l.reason))).sort()], [log]);

  const save = async (change) => {
    try {
      const done = await applyMovements([change]);
      if (done.length) toast.success(`${done[0].name}: stock is now ${done[0].stockAfter}`);
      else toast.info('Nothing changed.');
      setAdjusting(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportStock = () => {
    downloadText(
      `inventory-${todayStamp()}.csv`,
      toCSV(
        rows.map(({ p, status }) => ({
          barcode: p.barcode, name: p.name, category: p.category, stock: p.stock, critical: p.critical,
          status, cost: p.cost, price: p.price, value_at_cost: p.stock * p.cost,
        })),
        [
          { key: 'barcode', label: 'Barcode' }, { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
          { key: 'stock', label: 'In stock' }, { key: 'critical', label: 'Critical level' }, { key: 'status', label: 'Status' },
          { key: 'cost', label: 'Cost' }, { key: 'price', label: 'Price' }, { key: 'value_at_cost', label: 'Value at cost' },
        ]
      )
    );
  };

  const exportLog = () => {
    downloadText(
      `stock-movements-${todayStamp()}.csv`,
      toCSV(
        logRows.map((l) => ({ ...l, at: new Date(l.at).toLocaleString('en-PH') })),
        [
          { key: 'at', label: 'When' }, { key: 'barcode', label: 'Barcode' }, { key: 'name', label: 'Product' },
          { key: 'delta', label: 'Change' }, { key: 'stockAfter', label: 'Stock after' }, { key: 'reason', label: 'Reason' },
          { key: 'note', label: 'Note' }, { key: 'by', label: 'By' },
        ]
      )
    );
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="What you have on the shelf, what is running low, and every change to stock."
        actions={
          <button className="admBtn" onClick={tab === 'stock' ? exportStock : exportLog}><Icon name="download" size={16} /> Export CSV</button>
        }
      />

      <div className="admGrid c4">
        <StatCard label="Products" value={int(totals.count)} sub="Active on the kiosk" />
        <StatCard label="Units on hand" value={int(totals.units)} />
        <StatCard label="Stock value" value={peso(totals.cost, 0)} sub="What you paid for it" />
        <StatCard label="Retail value" value={peso(totals.retail, 0)} sub={`${peso(totals.retail - totals.cost, 0)} potential profit`} />
      </div>

      <Segmented
        label="Inventory view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'stock', label: 'Stock levels' },
          { value: 'log', label: 'Movement log', count: log.length },
        ]}
      />

      {tab === 'stock' ? (
        <Card>
          <div className="admToolbar" style={{ marginBottom: 12 }}>
            <input className="grow" placeholder="Search name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
              <option value="name">Sort: Name</option>
              <option value="low">Sort: Lowest stock</option>
              <option value="cover">Sort: Fewest days left</option>
              <option value="value">Sort: Highest value</option>
            </select>
            <label className="admCheck">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Segmented
              label="Stock filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'critical', label: 'Needs restock', count: counts.critical },
                { value: 'ok', label: 'Healthy', count: counts.ok },
              ]}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState icon="search" title="No products match" hint="Try a different search or filter." />
          ) : (
            <div className="admTableWrap">
              <table className="admTable">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>In stock</th>
                    <th className="num">Critical level</th>
                    <th>Status</th>
                    <th className="num">Value at cost</th>
                    <th className="num" title="Based on the last 30 days of sales">Days left</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, status, daysLeft }) => (
                    <tr key={p.barcode}>
                      <td><ProdCell p={p} /></td>
                      <td>{p.category}</td>
                      <td>
                        <b>{int(p.stock)}</b>
                        <StockMeter stock={p.stock} critical={p.critical} />
                      </td>
                      <td className="num">{int(p.critical)}</td>
                      <td>
                        {!p.active ? <Badge tone="neutral">Archived</Badge>
                          : status === STOCK.OUT ? <Badge tone="critical">Out of stock</Badge>
                          : status === STOCK.LOW ? <Badge tone="warn">Low</Badge>
                          : <Badge tone="good">OK</Badge>}
                      </td>
                      <td className="num">{peso(p.stock * p.cost)}</td>
                      <td className="num">
                        {daysLeft == null ? <span className="admMuted">—</span> : (
                          <span style={daysLeft < 7 ? { fontWeight: 700 } : undefined}>
                            {daysLeft < 1 ? '< 1' : int(daysLeft)} d
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="admRowActions">
                          <button className="admBtn sm" onClick={() => setAdjusting(p)}>Adjust</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="admHint">“Days left” estimates how long the stock lasts at the pace you sold it over the last 30 days.</p>
        </Card>
      ) : (
        <Card title="Movement log" subtitle="Every sale, restock, return and correction, newest first.">
          <div className="admToolbar" style={{ marginBottom: 12 }}>
            <input className="grow" placeholder="Search product or note" value={logQuery} onChange={(e) => setLogQuery(e.target.value)} aria-label="Search the log" />
            <select value={logReason} onChange={(e) => setLogReason(e.target.value)} aria-label="Reason">
              {logReasons.map((r) => <option key={r} value={r}>{r === 'All' ? 'All reasons' : r}</option>)}
            </select>
          </div>

          {logRows.length === 0 ? (
            <EmptyState icon="list" title="No movements yet" hint="Sales from the kiosk and your stock adjustments will be listed here." />
          ) : (
            <div className="admTableWrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
              <table className="admTable">
                <thead>
                  <tr>
                    <th>When</th><th>Product</th><th className="num">Change</th><th className="num">Stock after</th>
                    <th>Reason</th><th>Note</th><th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.slice(0, 300).map((l) => (
                    <tr key={l.id}>
                      <td>{dateTime(l.at)}</td>
                      <td>{l.name}</td>
                      <td className="num"><b>{l.delta > 0 ? '+' : '−'}{int(Math.abs(l.delta))}</b></td>
                      <td className="num">{int(l.stockAfter)}</td>
                      <td>{l.reason}</td>
                      <td className="admMuted">{l.note || '—'}</td>
                      <td>{l.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {logRows.length > 300 && <p className="admHint">Showing the newest 300 of {int(logRows.length)}. Export the CSV to see all.</p>}
        </Card>
      )}

      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} onSave={save} />}
    </>
  );
}
