import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "librarian" | "student";

interface GuardState {
  loading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
}

interface RequireAuthProps {
  children: ReactNode;
}

interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

function isValidRole(value: unknown): value is Role {
  return value === "admin" || value === "librarian" || value === "student";
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

      const metadataRole = session.user.user_metadata?.role;
      if (isValidRole(metadataRole)) {
        if (isMounted) {
          setState({ loading: false, isAuthenticated: true, role: metadataRole });
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (isMounted) {
        setState({
          loading: false,
          isAuthenticated: true,
          role: isValidRole(profile?.role) ? profile.role : "student",
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
