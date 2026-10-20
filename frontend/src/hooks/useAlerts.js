import { useEffect, useMemo, useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { useOrders } from '../context/OrderContext';
import { useQueueContext } from '../context/QueueContext';

const STALE_MIN = 10; // unpaid orders and waiting print jobs older than this raise an alert

// Alerts for the admin, worst first.
// critical = out of stock, warning = low stock or waiting too long
export function useAlerts() {
  const { activeProducts } = useProducts();
  const { orders } = useOrders();
  const { queue } = useQueueContext();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    const items = [];
    let outCount = 0;
    let lowCount = 0;

    activeProducts.forEach((p) => {
      if (p.stock <= 0) {
        outCount += 1;
        items.push({
          id: `out-${p.barcode}`, level: 'critical', kind: 'stock', icon: 'box',
          title: `${p.name} is out of stock`,
          detail: 'Customers cannot buy it. Restock now.',
          to: '/admin/inventory?filter=critical',
        });
      } else if (p.stock <= p.critical) {
        lowCount += 1;
        items.push({
          id: `low-${p.barcode}`, level: 'warning', kind: 'stock', icon: 'box',
          title: `${p.name} is running low`,
          detail: `${p.stock} left · critical level is ${p.critical}`,
          to: '/admin/inventory?filter=critical',
        });
      }
    });

    const now = Date.now();
    const staleUnpaid = orders.filter(
      (o) => o.status === 'Unpaid' && now - new Date(o.createdAt).getTime() > STALE_MIN * 60000
    ).length;
    if (staleUnpaid) {
      items.push({
        id: 'unpaid', level: 'warning', kind: 'orders', icon: 'receipt',
        title: `${staleUnpaid} order${staleUnpaid > 1 ? 's' : ''} waiting for payment over ${STALE_MIN} min`,
        detail: 'Check the staff screen.',
        to: '/staff',
      });
    }
    const owed = [...orders, ...queue].filter((x) => x.change > 0 && !x.changeGiven && x.status !== 'Cancelled');
    if (owed.length) {
      const sum = owed.reduce((n, x) => n + x.change, 0);
      items.push({
        id: 'change', level: 'warning', kind: 'orders', icon: 'cash',
        title: `${owed.length} customer${owed.length > 1 ? 's are' : ' is'} owed change (₱${sum.toFixed(2)})`,
        detail: 'The cash machine does not give change. Hand it over from the staff screen.',
        to: '/staff',
      });
    }
    const staleJobs = queue.filter(
      (j) => j.status === 'Waiting' && now - new Date(j.createdAt).getTime() > STALE_MIN * 60000
    ).length;
    if (staleJobs) {
      items.push({
        id: 'jobs', level: 'warning', kind: 'print', icon: 'printer',
        title: `${staleJobs} print job${staleJobs > 1 ? 's' : ''} waiting over ${STALE_MIN} min`,
        detail: 'Customers are waiting in the print queue.',
        to: '/staff',
      });
    }

    const rank = { critical: 0, warning: 1 };
    items.sort((a, b) => rank[a.level] - rank[b.level]);
    return {
      items,
      outCount,
      lowCount,
      criticalCount: items.filter((i) => i.level === 'critical').length,
      total: items.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProducts, orders, queue, tick]);
}
