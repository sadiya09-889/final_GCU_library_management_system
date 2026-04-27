import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { isAppRole, type AppRole, resolveCurrentUserContext } from "@/lib/accountRole";

interface GuardState {
  loading: boolean;
  isAuthenticated: boolean;
  role: AppRole | null;
}

interface RequireAuthProps {
  children: ReactNode;
}

interface RequireRoleProps {
  allowedRoles: AppRole[];
  children: ReactNode;
}

function useGuardState(): GuardState {
  const [state, setState] = useState<GuardState>({
    loading: true,
    isAuthenticated: false,
    role: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadGuardState() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.user) {
        if (isMounted) {
          setState({ loading: false, isAuthenticated: false, role: null });
        }
        return;
      }

      const resolved = await resolveCurrentUserContext(session.user);
      const fallbackRole = isAppRole(resolved?.role) ? resolved.role : "student";

      if (isMounted) {
        setState({
          loading: false,
          isAuthenticated: true,
          role: fallbackRole,
        });
      }
    }

    loadGuardState();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { loading, isAuthenticated } = useGuardState();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { loading, isAuthenticated, role } = useGuardState();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!role || !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
