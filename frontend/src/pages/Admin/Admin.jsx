import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { useQueueContext } from '../../context/QueueContext';
import { useAlerts } from '../../hooks/useAlerts';
import { useStockNotifier } from '../../hooks/useStockNotifier';
import { clearDemoData } from '../../utils/demoData';
import { Field } from './components/ui';

import Overview from './sections/Overview';
import Inventory from './sections/Inventory';
import Products from './sections/Products';
import Alerts from './sections/Alerts';
import Movers from './sections/Movers';
import Sales from './sections/Sales';
import OrdersPage from './sections/Orders';
import SettingsPage from './sections/Settings';

import './Admin.css';
import Icon from '../../components/Icon';

const NAV = [
  { to: '/admin', label: 'Overview', icon: 'chart', end: true },
  { to: '/admin/inventory', label: 'Inventory', icon: 'box' },
  { to: '/admin/products', label: 'Products', icon: 'tag' },
  { to: '/admin/alerts', label: 'Alerts', icon: 'bell', count: 'alerts' },
  { to: '/admin/movers', label: 'Fast & slow movers', icon: 'zap' },
  { to: '/admin/sales', label: 'Sales analytics', icon: 'trend' },
  { to: '/admin/orders', label: 'Orders & printing', icon: 'receipt', count: 'orders' },
  { to: '/admin/settings', label: 'Settings', icon: 'sliders' },
];

// sign in
function Login({ theme }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!login(username.trim(), password)) {
      setError('Wrong username or password.');
      return;
    }
    setError('');
  };

  return (
    <div className={`adminApp ${theme}Mode`}>
      <div className="admLoginWrap">
        <form className="admLogin" onSubmit={submit}>
          <div className="admBrand" style={{ padding: 0 }}>
            <div className="admBrandMark" aria-hidden="true">J</div>
            <div>
              <div className="admBrandName">JASRAIN</div>
              <div className="admBrandSub">Admin panel</div>
            </div>
          </div>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </Field>
          <Field label="Password" error={error}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <button className="admBtn primary" type="submit" disabled={!username || !password}>Sign in</button>
          <Link className="admLinkBtn" to="/"><Icon name="arrow-left" size={14} /> Back to kiosk</Link>
        </form>
      </div>
    </div>
  );
}

// notification bell
function Bell({ alerts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="admBellWrap" ref={ref}>
      <button
        className="admIconBtn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Alerts, ${alerts.total} need attention`}
        aria-expanded={open}
      >
        <Icon name="bell" size={20} />
        {alerts.total > 0 && <span className="admBellDot">{alerts.total > 99 ? '99+' : alerts.total}</span>}
      </button>

      {open && (
        <div className="admDrop" role="dialog" aria-label="Alerts">
          <div className="admDropHead">
            <span>Alerts</span>
            <Link className="admLinkBtn" to="/admin/alerts" onClick={() => setOpen(false)}>View all</Link>
          </div>
          {alerts.items.length === 0 ? (
            <div className="admDropEmpty"><Icon name="check-circle" size={16} /> All clear. Nothing needs attention.</div>
          ) : (
            <ul className="admDropList">
              {alerts.items.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link className="admDropItem" to={a.to} onClick={() => setOpen(false)}>
                    <Icon name={a.icon} size={18} />
                    <span>
                      <strong>{a.title}</strong>
                      <span>{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// the panel
function Shell({ theme, toggleTheme }) {
  const { admin, logout } = useAuth();
  const { orders } = useOrders();
  const { queue } = useQueueContext();
  const alerts = useAlerts();

  useStockNotifier(alerts);

  const unpaid = orders.filter((o) => o.status === 'Unpaid').length;
  const hasDemo = useMemo(() => orders.some((o) => o.demo) || queue.some((j) => j.demo), [orders, queue]);
  const counts = { alerts: alerts.total, orders: unpaid };

  // one summary toast right after signing in
  useEffect(() => {
    const need = alerts.outCount + alerts.lowCount;
    if (need > 0) {
      toast.warning(
        `${need} item${need > 1 ? 's' : ''} need restocking (${alerts.outCount} out, ${alerts.lowCount} low).`,
        { toastId: 'login-stock', autoClose: 6000 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${alerts.total > 0 ? `(${alerts.total}) ` : ''}Admin · Jasrain`;
  }, [alerts.total]);

  return (
    <div className={`adminApp ${theme}Mode`}>
      <aside className="admSide">
        <div className="admBrand">
          <div className="admBrandMark" aria-hidden="true">J</div>
          <div>
            <div className="admBrandName">JASRAIN</div>
            <div className="admBrandSub">Admin panel</div>
          </div>
        </div>

        <nav aria-label="Admin sections" style={{ display: 'contents' }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `admNavLink${isActive ? ' active' : ''}`}
            >
              <span className="admNavIcon" aria-hidden="true"><Icon name={n.icon} size={18} /></span>
              {n.label}
              {n.count && counts[n.count] > 0 && <span className="admNavCount">{counts[n.count]}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admMain">
        <div className="admTopbar">
          <span className="admWho">Signed in as <b>{admin?.username}</b></span>
          <a className="admIconBtn" href="/staff" target="_blank" rel="noopener noreferrer" title="Staff screen (new tab)" aria-label="Open staff screen in a new tab">
            <Icon name="user" size={19} />
          </a>
          <a className="admIconBtn" href="/" target="_blank" rel="noopener noreferrer" title="Kiosk (new tab)" aria-label="Open kiosk in a new tab">
            <Icon name="cart" size={19} />
          </a>
          <Bell alerts={alerts} />
          <button className="admIconBtn" onClick={toggleTheme} aria-label="Switch light or dark mode">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
          <button className="admBtn" onClick={logout}>Sign out</button>
        </div>

        <main className="admContent">
          {hasDemo && (
            <div className="admBanner" role="status">
              <span><strong>Sample data is on.</strong> The sales you see include made-up demo orders and print jobs.</span>
              <button className="admBtn sm" onClick={clearDemoData}>Remove sample data</button>
            </div>
          )}

          <Routes>
            <Route index element={<Overview />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="products" element={<Products />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="movers" element={<Movers />} />
            <Route path="sales" element={<Sales />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function Admin() {
  const { theme, toggleTheme } = useKiosk();
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Shell theme={theme} toggleTheme={toggleTheme} /> : <Login theme={theme} />;
}
