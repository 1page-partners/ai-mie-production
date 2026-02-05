import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsOrigin } from "@/hooks/useOrigin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOriginAccess?: boolean;
}

export function ProtectedRoute({ children, requireOriginAccess = false }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const { data: hasOriginAccess, isLoading: originLoading } = useIsOrigin();

  if (loading || (requireOriginAccess && originLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOriginAccess && !hasOriginAccess) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}
