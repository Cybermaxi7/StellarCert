import { lazy, Suspense } from "react";
import ProtectedRoute from "../guard/ProtectedRoute";
import { UserRole } from "../api/types";

const AdminUsersPage = lazy(
  () => import("../components/admin/users/UserManagement"),
);

function PageLoader() {
  return (
    <div
      className="flex min-h-[200px] items-center justify-center"
      role="status"
      aria-label="Loading user management page"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <span className="sr-only">Loading user management...</span>
    </div>
  );
}

export default function AdminUsers() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
      <Suspense fallback={<PageLoader />}>
        <AdminUsersPage />
      </Suspense>
    </ProtectedRoute>
  );
}
