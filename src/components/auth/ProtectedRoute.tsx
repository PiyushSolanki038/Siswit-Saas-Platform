import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppRole } from "@/types/roles"; // Ensure this matches your actual path
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function ProtectedRoute({ children, allowedRoles, redirectTo = "/auth" }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // 1. If not logged in, send to login page
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!allowedRoles) {
    return <>{children}</>;
  }

  if (!role) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  if (role === AppRole.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  if (role === AppRole.EMPLOYEE) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
}

// --- SPECIFIC ROUTE GUARDS ---

// 1. For Employees (Dashboard, etc.)
export function EmployeeRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[AppRole.EMPLOYEE]}>
      {children}
    </ProtectedRoute>
  );
}

// 2. For Standard Users (Clients)
export function UserRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[AppRole.USER]}>
      {children}
    </ProtectedRoute>
  );
}

// 3. For Admins (Admin Panel) - ADDED THIS
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[AppRole.ADMIN]}>
      {children}
    </ProtectedRoute>
  );
}
