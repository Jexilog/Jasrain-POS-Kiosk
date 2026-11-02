
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ allowedRoles }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'Administrator') {
      return <Navigate to="/admin" replace />;
    }

    if (user.role === 'Staff') {
      return <Navigate to="/staff" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
