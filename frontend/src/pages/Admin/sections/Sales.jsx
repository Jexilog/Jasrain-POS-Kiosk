import React, { useMemo, useState } from 'react';
import { useReport } from '../../../hooks/useReport';
import { RANGE_OPTIONS, change } from '../../../utils/analytics';
import { STORE_PRINT_SERIES, ONE_SERIES, dailyBars, hourBars, weekdayBars, peakIndex } from '../../../utils/chartData';
import { toCSV, downloadText } from '../../../utils/csv';
import { peso, pesoShort, int, pct, dateLong } from '../../../utils/format';
import { PageHeader, Card, StatCard, Segmented, EmptyState } from '../components/ui';
import { BarChart, HBars } from '../components/charts';
import Icon from '../../../components/Icon';

export default function Sales() {
  const [range, setRange] = useState('7d');
  const r = useReport(range);
  const { k, pk, range: rg } = r;
  const empty = k.orders === 0 && k.printJobs === 0;

  const hourRows = useMemo(() => hourBars(r.hours, 'orders'), [r.hours]);
  const weekRows = useMemo(() => weekdayBars(r.weekdays), [r.weekdays]);
  const dayRows = useMemo(() => dailyBars(r.daily), [r.daily]);

  const bestDay = useMemo(
    () => r.daily.filter((d) => d.store + d.print > 0).sort((a, b) => b.store + b.print - (a.store + a.print))[0],
    [r.daily]
  );
  const worstDay = useMemo(() => {
    const list = r.daily.filter((d) => d.date <= new Date());
    return list.length > 1 ? list.slice().sort((a, b) => a.store + a.print - (b.store + b.print))[0] : null;
  }, [r.daily]);

  const hourPeak = peakIndex(hourRows, 'orders');
  const weekPeak = peakIndex(weekRows, 'avg');

  const exportCSV = () =>
    downloadText(
      `sales-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(
        r.daily.map((d) => ({
          date: d.date.toISOString().slice(0, 10), store: d.store, print: d.print,
          total: d.store + d.print, orders: d.orders, jobs: d.jobs, profit: d.profit,
        })),
        [
          { key: 'date', label: 'Date' }, { key: 'store', label: 'Store sales' }, { key: 'print', label: 'Printing' },
          { key: 'total', label: 'Total' }, { key: 'orders', label: 'Store orders' }, { key: 'jobs', label: 'Print jobs' },
          { key: 'profit', label: 'Store profit' },
        ]
      )
    );

  const p = r.print;
  const paperRows = Object.entries(p.paper).map(([name, v]) => ({ key: name, label: name, value: v }));

  return (
    <>
      <PageHeader
        title="Sales analytics"
        subtitle="Money in, what sells, and when your customers come."
        actions={
          <>
            <Segmented label="Time range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <button className="admBtn" onClick={exportCSV} disabled={empty}><Icon name="download" size={16} /> Export CSV</button>
          </>
        }
      />

      {empty ? (
        <Card>
          <EmptyState
            icon="trend"
            title="No sales in this period"
            hint="Paid store orders and completed print jobs show up here. Try a longer range, or load sample data in Settings."
          />
        </Card>
      ) : (
        <>
          <div className="admGrid c4">
            <StatCard hero label="Total revenue" value={peso(k.revenue, 0)} delta={change(k.revenue, pk.revenue)} deltaLabel={rg.compareLabel}
              sub={`${peso(k.storeRevenue, 0)} store · ${peso(k.printRevenue, 0)} printing`} />
            <StatCard label="Store profit" value={peso(k.profit, 0)} delta={change(k.profit, pk.profit)} deltaLabel={rg.compareLabel}
              sub={k.margin == null ? 'No store sales' : `${pct(k.margin, 0)} margin`} />
            <StatCard label="Store orders" value={int(k.orders)} delta={change(k.orders, pk.orders)} deltaLabel={rg.compareLabel}
              sub={`${int(k.units)} items sold`} />
            <StatCard label="Average order" value={peso(k.avgOrder, 0)} delta={change(k.avgOrder, pk.avgOrder)} deltaLabel={rg.compareLabel}
              sub={`${int(k.printJobs)} print job${k.printJobs === 1 ? '' : 's'}`} />
          </div>

          {range !== 'today' && (
            <Card title="Revenue per day" subtitle="Store sales and printing">
              <BarChart data={dayRows} series={STORE_PRINT_SERIES} valueFormat={(v) => peso(v, 0)} tickFormat={pesoShort}
                ariaLabel="Revenue per day, store sales and printing" tableTitle="Day" />
            </Card>
          )}

          <div className="admGrid c2">
            <Card title="Busiest hours" subtitle="Orders and print jobs by time of day">
              <BarChart data={hourRows} series={ONE_SERIES('orders', 'Orders')} height={220} valueFormat={(v) => `${int(v)} orders`}
                tickFormat={(v) => int(v)} emphasisIndex={hourPeak} ariaLabel="Orders by hour" tableTitle="Hour" />
              {hourPeak != null && <p className="admHint">Peak: <b>{hourRows[hourPeak].title}</b>. Have enough stock and staff ready then.</p>}
            </Card>
            <Card title="Average by weekday" subtitle="Typical revenue for each day of the week">
              <BarChart data={weekRows} series={ONE_SERIES('avg', 'Average revenue')} height={220} valueFormat={(v) => peso(v, 0)}
                tickFormat={pesoShort} emphasisIndex={weekPeak} ariaLabel="Average revenue by weekday" tableTitle="Weekday" />
              {rg.days < 14 && <p className="admHint">Choose 30 or 90 days for a more reliable weekday pattern.</p>}
            </Card>
          </div>

          <div className="admGrid c2">
            <Card title="Sales by category" subtitle="Store sales only">
              <HBars rows={r.categories.slice(0, 8).map((c) => ({ key: c.name, label: c.name, value: c.value }))}
                format={(v) => peso(v, 0)} emptyText="No store sales yet." />
            </Card>
            <Card title="Top products" subtitle="By revenue">
              <HBars rows={r.stats.filter((s) => s.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
                .map((s) => ({ key: s.barcode, label: s.name, category: s.category, value: s.revenue, note: `${int(s.units)} sold` }))}
                format={(v) => peso(v, 0)} emptyText="No store sales yet." />
            </Card>
          </div>

          <div className="admGrid c2">
            <Card title="Payment methods" subtitle="Share of store sales">
              <HBars rows={r.payments.map((x) => ({ key: x.name, label: x.name, value: x.value }))}
                format={(v) => `${peso(v, 0)} · ${k.storeRevenue ? Math.round((v / k.storeRevenue) * 100) : 0}%`}
                emptyText="No store sales yet." />
            </Card>
            <Card title="Printing" subtitle={`${int(p.jobs)} completed job${p.jobs === 1 ? '' : 's'} · ${peso(p.revenue, 0)}`}>
              {p.jobs === 0 ? (
                <EmptyState icon="printer" title="No completed print jobs" />
              ) : (
                <>
                  <HBars rows={[
                    { key: 'bw', label: 'Black & white sheets', value: p.bwSheets },
                    { key: 'color', label: 'Color sheets', value: p.colorSheets },
                  ]} format={(v) => `${int(v)} sheets`} />
                  <div style={{ height: 12 }} />
                  <HBars rows={paperRows} format={(v) => `${int(v)} sheets`} />
                  <p className="admHint">Average job: <b>{peso(p.avgJob, 0)}</b> · {int(p.sheets)} sheets printed</p>
                </>
              )}
            </Card>
          </div>

          <Card title="Highlights">
            <ul className="admInsights">
              {bestDay && <li>Best day: <b>{dateLong(bestDay.date)}</b> with <b>{peso(bestDay.store + bestDay.print, 0)}</b>.</li>}
              {worstDay && <li>Slowest day: <b>{dateLong(worstDay.date)}</b> with <b>{peso(worstDay.store + worstDay.print, 0)}</b>.</li>}
              {k.margin != null && <li>Your store margin is <b>{pct(k.margin, 0)}</b>. {k.margin < 15 ? 'That is thin. Check your prices against cost.' : 'That is healthy.'}</li>}
              {k.revenue > 0 && <li>Printing brings in <b>{Math.round((k.printRevenue / k.revenue) * 100)}%</b> of your revenue.</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
