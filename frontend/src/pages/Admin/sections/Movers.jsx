import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReport } from '../../../hooks/useReport';
import { MOVE, RANGE_OPTIONS } from '../../../utils/analytics';
import { toCSV, downloadText } from '../../../utils/csv';
import { peso, int, timeAgo } from '../../../utils/format';
import { PageHeader, Card, StatCard, Badge, Segmented, EmptyState } from '../components/ui';
import { HBars } from '../components/charts';
import ProdCell from '../components/ProdCell';
import Icon from '../../../components/Icon';

const RANGES = RANGE_OPTIONS.filter((r) => r.value !== 'today');

const TONE = { [MOVE.FAST]: 'good', [MOVE.MEDIUM]: 'neutral', [MOVE.SLOW]: 'warn', [MOVE.DEAD]: 'critical' };
const ICON = { [MOVE.FAST]: 'arrow-up', [MOVE.MEDIUM]: 'dot', [MOVE.SLOW]: 'arrow-down', [MOVE.DEAD]: 'x' };

const daysText = (d) => (d == null ? '—' : d < 1 ? '< 1 d' : `${int(d)} d`);

export default function Movers() {
  const [range, setRange] = useState('30d');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('units');
  const r = useReport(range);
  const days = r.range.days;

  const stats = r.stats;
  const by = (m) => stats.filter((s) => s.move === m);
  const fast = by(MOVE.FAST).sort((a, b) => b.units - a.units);
  const slow = by(MOVE.SLOW);
  const dead = by(MOVE.DEAD).filter((s) => s.active);

  const tiedUp = useMemo(
    () => [...slow, ...dead].reduce((sum, s) => sum + (s.stock || 0) * (s.cost || 0), 0),
    [slow, dead]
  );
  const totalStock = useMemo(() => stats.reduce((sum, s) => sum + (s.stock || 0) * (s.cost || 0), 0), [stats]);

  const sorted = useMemo(() => {
    const sorters = {
      units: (a, b) => b.units - a.units,
      revenue: (a, b) => b.revenue - a.revenue,
      profit: (a, b) => b.profit - a.profit,
      cover: (a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity),
    };
    return stats
      .filter((s) => filter === 'all' || s.move === filter)
      .slice()
      .sort(sorters[sort]);
  }, [stats, filter, sort]);

  const insights = useMemo(() => {
    const list = [];
    fast
      .filter((s) => s.daysLeft != null && s.daysLeft < 7)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3)
      .forEach((s) => {
        list.push(
          <li key={`f-${s.barcode}`}>
            <b>{s.name}</b> is a fast mover (about {s.velocity.toFixed(1)} a day) and will run out in{' '}
            <b>{s.daysLeft < 1 ? 'less than a day' : `about ${Math.round(s.daysLeft)} day${Math.round(s.daysLeft) === 1 ? '' : 's'}`}</b>. Reorder it soon.
          </li>
        );
      });
    if (dead.length) {
      list.push(
        <li key="dead">
          <b>{dead.length} product{dead.length > 1 ? 's' : ''}</b> had no sales in the last {days} days and{' '}
          {dead.length > 1 ? 'tie' : 'ties'} up <b>{peso(dead.reduce((s, x) => s + x.stock * x.cost, 0), 0)}</b> of stock. Try a promo or bundle, or stop restocking.
        </li>
      );
    }
    slow
      .sort((a, b) => b.stock * b.cost - a.stock * a.cost)
      .slice(0, 2)
      .forEach((s) => {
        list.push(
          <li key={`s-${s.barcode}`}>
            <b>{s.name}</b> sold only {int(s.units)} in {days} days but you hold {int(s.stock)} ({peso(s.stock * s.cost, 0)} at cost). Avoid buying more for now.
          </li>
        );
      });
    const best = stats.slice().sort((a, b) => b.profit - a.profit)[0];
    if (best && best.profit > 0) {
      list.push(
        <li key="best">
          <b>{best.name}</b> made you the most profit: <b>{peso(best.profit, 0)}</b> from {int(best.units)} sold.
        </li>
      );
    }
    return list;
  }, [fast, slow, dead, stats, days]);

  const exportReport = () =>
    downloadText(
      `fast-slow-movers-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(
        sorted.map((s) => ({
          name: s.name, category: s.category, movement: s.move, units: s.units, revenue: s.revenue,
          profit: s.profit, per_day: s.velocity.toFixed(2), stock: s.stock ?? '', days_left: s.daysLeft == null ? '' : Math.round(s.daysLeft),
        })),
        [
          { key: 'name', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'movement', label: 'Movement' },
          { key: 'units', label: 'Units sold' }, { key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' },
          { key: 'per_day', label: 'Per day' }, { key: 'stock', label: 'In stock' }, { key: 'days_left', label: 'Days left' },
        ]
      )
    );

  const counts = { all: stats.length, [MOVE.FAST]: fast.length, [MOVE.MEDIUM]: by(MOVE.MEDIUM).length, [MOVE.SLOW]: slow.length, [MOVE.DEAD]: by(MOVE.DEAD).length };

  return (
    <>
      <PageHeader
        title="Fast & slow movers"
        subtitle="Which products sell quickly, which sit on the shelf, and how long your stock will last."
        actions={
          <>
            <Segmented label="Time range" value={range} onChange={setRange} options={RANGES} />
            <button className="admBtn" onClick={exportReport}><Icon name="download" size={16} /> Export CSV</button>
          </>
        }
      />

      {r.k.orders === 0 ? (
        <Card>
          <EmptyState
            icon="zap"
            title={`No paid orders in the last ${days} days`}
            hint="This report needs sales. Mark kiosk orders as paid on the staff screen, or load sample data in Settings to preview it."
            action={<Link className="admBtn primary" to="/admin/settings">Go to Settings</Link>}
          />
        </Card>
      ) : (
        <>
          <div className="admGrid c4">
            <StatCard label="Fast movers" value={int(fast.length)} sub="Top quarter of sellers" />
            <StatCard label="Slow movers" value={int(slow.length)} tone={slow.length ? 'warn' : undefined} sub="Bottom quarter of sellers" />
            <StatCard label="No sales" value={int(dead.length)} tone={dead.length ? 'critical' : undefined} sub={`Nothing sold in ${days} days`} />
            <StatCard
              label="Cash tied up in slow stock"
              value={peso(tiedUp, 0)}
              sub={totalStock > 0 ? `${Math.round((tiedUp / totalStock) * 100)}% of your stock value` : undefined}
            />
          </div>

          <div className="admGrid c2">
            <Card title="Fast movers" subtitle={`Units sold in the last ${days} days`}>
              <HBars
                rows={fast.slice(0, 8).map((s) => ({
                  key: s.barcode, label: s.name, category: s.category, value: s.units,
                  note: s.daysLeft == null ? '' : `${daysText(s.daysLeft)} of stock`,
                }))}
                format={(v) => `${int(v)} sold`}
                emptyText="Not enough sales to rank fast movers yet."
              />
            </Card>

            <Card title="Slow & non-moving" subtitle="Stock that is not selling">
              {[...dead, ...slow].length === 0 ? (
                <EmptyState icon="check-circle" title="Everything is moving" />
              ) : (
                <ul className="admList">
                  {[...dead.sort((a, b) => b.stock * b.cost - a.stock * a.cost), ...slow].slice(0, 8).map((s) => (
                    <li key={s.barcode} className="admListItem">
                      <div className="admListMain"><ProdCell p={s} sub={s.units ? `${int(s.units)} sold` : 'No sales'} /></div>
                      <div style={{ textAlign: 'right' }}>
                        <b>{int(s.stock)} in stock</b>
                        <div className="admMuted" style={{ fontSize: 13 }}>{peso(s.stock * s.cost, 0)} at cost</div>
                      </div>
                      <Badge tone={TONE[s.move]} icon={ICON[s.move]}>{s.move}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="What to do" subtitle="Automatic tips from your sales">
            {insights.length ? <ul className="admInsights">{insights}</ul> : <p className="admMuted">No tips yet. Keep selling.</p>}
          </Card>

          <Card title="All products" subtitle="Sorted your way">
            <div className="admToolbar" style={{ marginBottom: 12 }}>
              <Segmented
                label="Movement"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All', count: counts.all },
                  { value: MOVE.FAST, label: 'Fast', count: counts[MOVE.FAST] },
                  { value: MOVE.MEDIUM, label: 'Medium', count: counts[MOVE.MEDIUM] },
                  { value: MOVE.SLOW, label: 'Slow', count: counts[MOVE.SLOW] },
                  { value: MOVE.DEAD, label: 'No sales', count: counts[MOVE.DEAD] },
                ]}
              />
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                <option value="units">Sort: Units sold</option>
                <option value="revenue">Sort: Revenue</option>
                <option value="profit">Sort: Profit</option>
                <option value="cover">Sort: Fewest days left</option>
              </select>
            </div>

            <div className="admTableWrap">
              <table className="admTable">
                <thead>
                  <tr>
                    <th>Product</th><th>Movement</th><th className="num">Units sold</th><th className="num">Revenue</th>
                    <th className="num">Profit</th><th className="num">Per day</th><th className="num">In stock</th>
                    <th className="num">Days left</th><th>Last sold</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.barcode}>
                      <td><ProdCell p={s} /></td>
                      <td><Badge tone={TONE[s.move]} icon={ICON[s.move]}>{s.move}</Badge></td>
                      <td className="num">{int(s.units)}</td>
                      <td className="num">{peso(s.revenue, 0)}</td>
                      <td className="num">{peso(s.profit, 0)}</td>
                      <td className="num">{s.velocity > 0 ? s.velocity.toFixed(1) : '—'}</td>
                      <td className="num">{s.stock == null ? '—' : int(s.stock)}</td>
                      <td className="num">{daysText(s.daysLeft)}</td>
                      <td>{s.lastSold ? timeAgo(s.lastSold) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="admHint">
              <b>Fast</b> = the top quarter of products that sold. <b>Slow</b> = the bottom quarter. <b>Medium</b> = the rest.{' '}
              <b>No sales</b> = nothing sold in this period. With fewer than 3 selling products, everything that sold counts as Medium.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
