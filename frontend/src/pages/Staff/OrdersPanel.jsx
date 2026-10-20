import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import Icon from '../../components/Icon';
import { PageHeader, Card, StatCard, Badge, Segmented, EmptyState } from '../Admin/components/ui';
import { peso, int, timeAgo } from '../../utils/format';

const TONE = { Paid: 'good', Unpaid: 'warn', Cancelled: 'neutral' };
const ICON = { Paid: 'check', Unpaid: 'alert', Cancelled: 'x' };

export default function OrdersPanel() {
  const { orders, markPaid, cancelOrder, giveChange, removeOrder, salesToday, paidTodayCount } = useOrders();
  const [tab, setTab] = useState('todo');

  const owed = (o) => o.change > 0 && !o.changeGiven && o.status !== 'Cancelled';
  // first tab: waiting for staff = unpaid orders + paid orders that are still owed change
  const todo = orders.filter((o) => o.status === 'Unpaid' || owed(o)).slice().reverse();
  const closed = orders.filter((o) => o.status !== 'Unpaid' && !owed(o)).slice().reverse();
  const shown = tab === 'todo' ? todo : closed;
  const unpaid = orders.filter((o) => o.status === 'Unpaid').length;
  const changeOwed = orders.filter(owed).reduce((n, o) => n + o.change, 0);

  const handleCancel = (o) => {
    if (window.confirm(`Cancel order ${o.orderNumber}? The items go back into stock.`)) cancelOrder(o.orderNumber);
  };
  const handleRemove = (o) => {
    if (window.confirm(`Remove order ${o.orderNumber} from the list?`)) removeOrder(o.orderNumber);
  };

  return (
    <>
      <PageHeader title="Store orders" subtitle="Orders paid at the cash machine, and anything that still needs you." />

      <div className="admGrid c4">
        <StatCard label="Waiting to pay" value={int(unpaid)} tone={unpaid ? 'warn' : undefined} />
        <StatCard label="Change owed" value={peso(changeOwed)} tone={changeOwed ? 'warn' : undefined} sub="To hand to customers" />
        <StatCard label="Paid today" value={int(paidTodayCount)} />
        <StatCard label="Sales today" value={peso(salesToday)} />
      </div>

      <Card
        actions={
          <Segmented
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'todo', label: 'To do', count: todo.length },
              { value: 'closed', label: 'Paid / Cancelled', count: closed.length },
            ]}
          />
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title={tab === 'todo' ? 'Nothing waiting' : 'Nothing here yet'}
            hint={tab === 'todo' ? 'No unpaid orders and no change owed.' : undefined}
          />
        ) : (
          <div className="admTableWrap">
            <table className="admTable">
              <thead>
                <tr><th>Order</th><th>Items</th><th>Placed</th><th>Payment</th><th className="num">Total</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {shown.slice(0, 150).map((o) => {
                  const count = o.items.reduce((n, i) => n + i.quantity, 0);
                  return (
                    <tr key={o.id}>
                      <td><span className="stfNum">{o.orderNumber}</span></td>
                      <td>
                        <ul className="stfLines">
                          {o.items.map((i) => (
                            <li key={i.barcode}><b>{i.quantity}×</b> {i.name} <span>{peso(i.price * i.quantity)}</span></li>
                          ))}
                        </ul>
                        <span className="stfMeta">{count} item{count === 1 ? '' : 's'}</span>
                      </td>
                      <td>{timeAgo(o.createdAt)}</td>
                      <td>
                        {o.payment}
                        {o.cashReceived != null && <div className="stfMeta">Inserted {peso(o.cashReceived)}</div>}
                        {o.change > 0 && (
                          <div className="stfMeta">
                            {o.changeGiven ? `Change ${peso(o.change)} given` : <b style={{ color: 'var(--crit)' }}>Owes change {peso(o.change)}</b>}
                          </div>
                        )}
                      </td>
                      <td className="num">{peso(o.total)}</td>
                      <td><Badge tone={TONE[o.status]} icon={ICON[o.status]}>{o.status}</Badge></td>
                      <td>
                        <div className="stfActions">
                          {o.status === 'Unpaid' && (
                            <>
                              <button className="admBtn sm danger" onClick={() => handleCancel(o)}>Cancel</button>
                              <button className="admBtn sm primary" onClick={() => markPaid(o.orderNumber)}>
                                <Icon name="check" size={15} /> Mark paid
                              </button>
                            </>
                          )}
                          {owed(o) && (
                            <button className="admBtn sm primary" onClick={() => giveChange(o.orderNumber)}>
                              <Icon name="cash" size={15} /> Gave change {peso(o.change)}
                            </button>
                          )}
                          {o.status !== 'Unpaid' && !owed(o) && (
                            <button className="admBtn sm" onClick={() => handleRemove(o)} aria-label={`Remove ${o.orderNumber}`}>
                              <Icon name="trash" size={15} /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
