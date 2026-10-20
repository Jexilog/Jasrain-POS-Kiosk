import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useProducts } from '../../../context/ProductContext';
import { useOrders } from '../../../context/OrderContext';
import { useQueueContext } from '../../../context/QueueContext';
import { useAlerts } from '../../../hooks/useAlerts';
import { useReport } from '../../../hooks/useReport';
import { change, stockStatus, STOCK } from '../../../utils/analytics';
import { dailyBars, STORE_PRINT_SERIES } from '../../../utils/chartData';
import { peso, pesoShort, int, pct, dateLong } from '../../../utils/format';
import { PageHeader, Card, StatCard, Badge, EmptyState } from '../components/ui';
import { BarChart, HBars, StockMeter } from '../components/charts';
import ProdCell from '../components/ProdCell';
import Icon from '../../../components/Icon';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Overview() {
  const { admin } = useAuth();
  const { activeProducts } = useProducts();
  const { orders } = useOrders();
  const { queue } = useQueueContext();
  const alerts = useAlerts();
  const today = useReport('today');
  const week = useReport('7d');

  const stock = useMemo(() => {
    let cost = 0;
    let units = 0;
    activeProducts.forEach((p) => {
      cost += p.stock * p.cost;
      units += p.stock;
    });
    return { cost, units };
  }, [activeProducts]);

  const unpaid = orders.filter((o) => o.status === 'Unpaid');
  const unpaidTotal = unpaid.reduce((s, o) => s + Number(o.total), 0);
  const waitingJobs = queue.filter((j) => j.status === 'Waiting').length;
  const printingJob = queue.find((j) => j.status === 'Printing');

  const topSellers = week.stats
    .filter((s) => s.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, 6)
    .map((s) => ({ key: s.barcode, label: s.name, category: s.category, value: s.units, note: peso(s.revenue, 0) }));

  const running = activeProducts
    .filter((p) => stockStatus(p) !== STOCK.OK)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);

  const hasSales = week.k.orders > 0 || week.k.printJobs > 0;
  const needRestock = alerts.outCount + alerts.lowCount;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${admin?.username || 'admin'}`}
        subtitle={`${dateLong(new Date())} · here is how the store is doing`}
        actions={
          <>
            <Link className="admBtn" to="/staff">Staff screen</Link>
            <Link className="admBtn primary" to="/">Open kiosk</Link>
          </>
        }
      />

      <div className="admGrid c4">
        <StatCard
          hero
          label="Today's revenue"
          value={peso(today.k.revenue)}
          delta={change(today.k.revenue, today.pk.revenue)}
          deltaLabel="vs yesterday"
          sub={`${peso(today.k.storeRevenue, 0)} store · ${peso(today.k.printRevenue, 0)} printing`}
        />
        <StatCard
          label="Store orders today"
          value={int(today.k.orders)}
          delta={change(today.k.orders, today.pk.orders)}
          deltaLabel="vs yesterday"
          sub={today.k.orders ? `Average ${peso(today.k.avgOrder)} per order` : 'Paid orders only'}
        />
        <StatCard
          label="Store profit today"
          value={peso(today.k.profit)}
          sub={today.k.margin == null ? 'No sales yet' : `${pct(today.k.margin)} margin`}
        />
        <StatCard
          label="Print jobs finished"
          value={int(today.k.printJobs)}
          delta={change(today.k.printJobs, today.pk.printJobs)}
          deltaLabel="vs yesterday"
          sub={`${int(today.k.sheets)} sheets printed`}
        />
      </div>

      <div className="admGrid c4">
        <StatCard
          label="Items to restock"
          value={int(needRestock)}
          tone={alerts.outCount > 0 ? 'critical' : needRestock > 0 ? 'warn' : undefined}
          sub={`${alerts.outCount} out of stock · ${alerts.lowCount} low`}
        />
        <StatCard label="Stock value" value={peso(stock.cost, 0)} sub={`At cost · ${int(stock.units)} units on hand`} />
        <StatCard
          label="Waiting for payment"
          value={int(unpaid.length)}
          sub={unpaid.length ? `${peso(unpaidTotal, 0)} to collect` : 'Nothing to collect'}
        />
        <StatCard
          label="Print queue"
          value={int(waitingJobs)}
          sub={printingJob ? `Now printing ${printingJob.queueNumber}` : 'Printer idle'}
        />
      </div>

      <div className="admGrid main2">
        <Card title="Sales, last 7 days" subtitle="Paid store orders and finished print jobs">
          {hasSales ? (
            <BarChart
              data={dailyBars(week.daily)}
              series={STORE_PRINT_SERIES}
              tickFormat={pesoShort}
              valueFormat={(v) => peso(v)}
              ariaLabel="Revenue per day for the last 7 days, store sales and printing"
              tableTitle="Day"
            />
          ) : (
            <EmptyState
              icon="trend"
              title="No sales yet"
              hint="Place an order on the kiosk and mark it paid on the staff screen, or load sample data to preview the dashboard."
              action={<Link className="admBtn primary" to="/admin/settings">Go to Settings</Link>}
            />
          )}
        </Card>

        <Card
          title="Needs attention"
          subtitle={alerts.total ? `${alerts.total} alert${alerts.total > 1 ? 's' : ''}` : 'Nothing right now'}
          actions={<Link className="admLinkBtn" to="/admin/alerts">View all</Link>}
        >
          {alerts.items.length === 0 ? (
            <EmptyState icon="check-circle" title="All clear" hint="Stock levels are healthy and nothing is waiting too long." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.items.slice(0, 5).map((a) => (
                <Link key={a.id} to={a.to} className={`admAlertRow ${a.level}`}>
                  <Icon name={a.icon} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </div>
                  <Badge tone={a.level === 'critical' ? 'critical' : 'warn'}>
                    {a.level === 'critical' ? 'Critical' : 'Warning'}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="admGrid c2">
        <Card
          title="Top sellers, last 7 days"
          subtitle="By units sold"
          actions={<Link className="admLinkBtn" to="/admin/movers">Fast & slow movers</Link>}
        >
          <HBars
            rows={topSellers}
            format={(v) => `${int(v)} sold`}
            emptyText="Sell something to see your best sellers here."
          />
        </Card>

        <Card
          title="Running low"
          subtitle="Lowest stock first"
          actions={<Link className="admLinkBtn" to="/admin/inventory?filter=critical">Open inventory</Link>}
        >
          {running.length === 0 ? (
            <EmptyState icon="box" title="Every item is above its critical level" />
          ) : (
            <ul className="admList">
              {running.map((p) => {
                const out = p.stock <= 0;
                return (
                  <li key={p.barcode} className="admListItem">
                    <div className="admListMain"><ProdCell p={p} sub={`Critical level ${p.critical}`} /></div>
                    <span style={{ fontWeight: 700 }}>{int(p.stock)} left</span>
                    <StockMeter stock={p.stock} critical={p.critical} />
                    <Badge tone={out ? 'critical' : 'warn'}>{out ? 'Out' : 'Low'}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
