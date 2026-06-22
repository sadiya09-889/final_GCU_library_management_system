import { useEffect, useState } from "react";
import DashboardPage from "./DashboardPage";
import FacultyPage from "./FacultyPage";
import { resolveCurrentUserContext, type AppRole } from "@/lib/accountRole";

export default function RoleHomePage() {
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let mounted = true;

    resolveCurrentUserContext().then((resolved) => {
      if (mounted) {
        setRole(resolved?.role ?? null);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (role === null) {
    return null;
  }

  if (role === "faculty") {
    return <FacultyPage />;
  }

  if (role === "student") {
    return <DashboardPage />;
  }

  if (role === "admin" || role === "librarian") {
    return <DashboardPage />;
  }

  return <DashboardPage />;
}
