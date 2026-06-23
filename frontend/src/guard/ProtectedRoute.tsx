import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../api/types";

const roleRoutes: Record<UserRole, string[]> = {
  [UserRole.RECIPIENT]: ["/wallet"],
  [UserRole.VERIFIER]: ["/wallet", "/verify"],
  [UserRole.ISSUER]: ["/issue", "/wallet", "/revoke", "/verify", "/certificates"],
  [UserRole.ADMIN]: ["/issue", "/wallet", "/revoke", "/verify", "/certificates"],
  [UserRole.AUDITOR]: ["/verify", "/certificates"],
  [UserRole.USER]: ["/wallet"],
};

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Public path — no auth required
  if (location.pathname === "/verify") return <Outlet />;

  // Not logged in — redirect to login and preserve destination
  if (!user) {
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const userRole = user.role as UserRole;

  if (allowedRoles) {
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  } else {
    const allowedPaths: string[] = roleRoutes[userRole] ?? [];
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
