import { useMemo } from 'react';
import { useOrders } from '../context/OrderContext';
import { useQueueContext } from '../context/QueueContext';
import { useProducts } from '../context/ProductContext';
import {
  rangeFor, ordersIn, jobsIn, kpis, dailySeries, productStats,
  byCategory, byHour, byWeekday, byPayment, printStats,
} from '../utils/analytics';

// report data for one time range ('today', '7d', '30d', '90d')
export function useReport(rangeKey = '7d') {
  const { orders } = useOrders();
  const { queue } = useQueueContext();
  const { products } = useProducts();

  return useMemo(() => {
    const range = rangeFor(rangeKey);
    const costLookup = {};
    const catLookup = {};
    products.forEach((p) => {
      costLookup[p.barcode] = p.cost;
      catLookup[p.barcode] = p.category;
    });

    const cur = ordersIn(orders, range.from, range.to);
    const prev = ordersIn(orders, range.prevFrom, range.prevTo);
    const curJobs = jobsIn(queue, range.from, range.to);
    const prevJobs = jobsIn(queue, range.prevFrom, range.prevTo);

    return {
      range,
      orders: cur,
      jobs: curJobs,
      k: kpis(cur, curJobs, costLookup),
      pk: kpis(prev, prevJobs, costLookup),
      daily: dailySeries(cur, curJobs, range.from, range.to, costLookup),
      // archived items only show if they sold something
      stats: productStats(cur, products, range.days, costLookup).filter((s) => s.active || s.units > 0),
      categories: byCategory(cur, catLookup),
      hours: byHour(cur, curJobs),
      weekdays: byWeekday(cur, curJobs, range.from, range.to),
      payments: byPayment(cur),
      print: printStats(curJobs),
    };
  }, [rangeKey, orders, queue, products]);
}
