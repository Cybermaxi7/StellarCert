import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../api/types";

// Define allowed routes based on user roles
const roleRoutes: Record<UserRole, string[]> = {
  [UserRole.RECIPIENT]: ["/wallet"],
  [UserRole.VERIFIER]: ["/wallet", "/verify"],
  [UserRole.ISSUER]: ["/issue", "/wallet", "/revoke", "/verify"],
  [UserRole.ADMIN]: ["/issue", "/wallet", "/revoke", "/verify"],
};

// Define props type for ProtectedRoute
interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const currentPath: string = window.location.pathname;

  // Allow public access to /verify
  if (currentPath === "/verify") return <Outlet />;

  // Use centralized auth context instead of localStorage
  const { user } = useAuth();

  // If no user is logged in, redirect to login page
  if (!user) return <Navigate to="/login" replace />;

  // Get user role
  const userRole: UserRole = (user as any).role;

  // If a caller provided an explicit list of allowed roles, use that check first
  if (allowedRoles) {
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  } else {
    // Fallback: use hard-coded route map for backwards compatibility
    const allowedRoutes: string[] = roleRoutes[userRole] || [];
    if (!allowedRoutes.includes(currentPath)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
