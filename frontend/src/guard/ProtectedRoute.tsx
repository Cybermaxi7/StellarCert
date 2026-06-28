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

/**
 * Returns true when `pathname` equals one of the allowed base paths or is a
 * sub-route of one. A path matches when it equals an allowed path exactly, or
 * begins with that path followed by a `/` segment boundary.
 *
 * The `/` boundary prevents false positives: `/certificates/abc-123` matches
 * `/certificates`, but `/certificatesfoo` does not.
 */
const isPathAllowed = (pathname: string, allowedPaths: string[]): boolean =>
  allowedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

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
    if (!isPathAllowed(location.pathname, allowedPaths)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
