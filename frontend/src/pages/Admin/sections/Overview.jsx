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
    let retail = 0;
    let units = 0;
    activeProducts.forEach((p) => {
      cost += p.stock * p.cost;
      retail += p.stock * p.price;
      units += p.stock;
    });
    return { cost, retail, units };
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

  // if no product has a cost yet, "at cost" would say 0, so show the selling price value and say so
  const noCosts = stock.units > 0 && stock.cost === 0;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${admin?.username || 'admin'}`}
        subtitle={`${dateLong(new Date())} · here is how the store is doing`}
      />

      <p className="admMuted">
        Total today: <b>{peso(today.k.revenue)}</b> · {peso(today.k.storeRevenue, 0)} store · {peso(today.k.printRevenue, 0)} printing
      </p>

      {/* store */}
      <h2 className="admGroupTitle">Store</h2>
      <div className="admGrid c3">
        <StatCard
          hero
          label="Store revenue today"
          value={peso(today.k.storeRevenue)}
          delta={change(today.k.storeRevenue, today.pk.storeRevenue)}
          deltaLabel="vs yesterday"
          sub={`${int(today.k.orders)} paid order${today.k.orders === 1 ? '' : 's'}`}
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
          label="Waiting for payment"
          value={int(unpaid.length)}
          sub={unpaid.length ? `${peso(unpaidTotal, 0)} to collect` : 'Nothing to collect'}
        />
        <StatCard
          label="Items to restock"
          value={int(needRestock)}
          tone={alerts.outCount > 0 ? 'critical' : needRestock > 0 ? 'warn' : undefined}
          sub={`${alerts.outCount} out of stock · ${alerts.lowCount} low`}
        />
        <StatCard
          label="Stock value"
          value={peso(noCosts ? stock.retail : stock.cost, 0)}
          sub={
            noCosts
              ? `At selling price · ${int(stock.units)} units. Add product costs to see it at cost.`
              : `At cost · ${int(stock.units)} units on hand`
          }
        />
      </div>

      {/* printing, with a gap below the store cards */}
      <h2 className="admGroupTitle gap rule">Printing service</h2>
      <div className="admGrid c3">
        <StatCard
          hero
          label="Printing revenue today"
          value={peso(today.k.printRevenue)}
          delta={change(today.k.printRevenue, today.pk.printRevenue)}
          deltaLabel="vs yesterday"
          sub={`${int(today.k.sheets)} sheets printed`}
        />
        <StatCard
          label="Print jobs finished"
          value={int(today.k.printJobs)}
          delta={change(today.k.printJobs, today.pk.printJobs)}
          deltaLabel="vs yesterday"
          sub={today.k.printJobs ? 'Done today' : 'None yet today'}
        />
        <StatCard
          label="Print queue"
          value={int(waitingJobs)}
          sub={printingJob ? `Now printing ${printingJob.queueNumber}` : waitingJobs ? 'Waiting to be printed' : 'Printer idle'}
        />
      </div>

      {/* one chart for both, with its own separator */}
      <h2 className="admGroupTitle gap rule">Sales and alerts</h2>
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
            <div className="admAlertList">
              {alerts.items.slice(0, 5).map((a) => (
                <Link key={a.id} to={a.to} className={`admAlertRow ${a.level}`}>
                  <Icon name={a.icon} size={20} />
                  <div>
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

      <div className="admGrid main2 flip">
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
