
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ allowedRoles }) {
  const { user, isAuthenticated } = useAuth();

  // Allow the Staff page to display its own login screen
  if (!isAuthenticated || !user) {
    return <Outlet />;
  }

  const role = String(user.role || '').trim().toLowerCase();
  const allowed = allowedRoles.map(r => r.toLowerCase());

  if (!allowed.includes(role)) {
    if (role === 'Administrator') {
      return <Navigate to="/admin" replace />;
    }

    if (role === 'Staff') {
      return <Navigate to="/staff" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
