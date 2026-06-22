import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, BookCopy, Users, User, LogOut, Menu, X, GraduationCap,
  Globe, Award, Search, BarChart3, AlertTriangle, Bell, BookMarked, RotateCcw, Briefcase, BookmarkCheck, Newspaper
} from "lucide-react";
import gcuLogo from "@/assets/gcu-logo.png";
import { supabase } from "@/lib/supabase";
import { inferUserRole, syncCurrentUserContext } from "@/lib/accountRole";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "librarian", "student", "faculty"] },
  { label: "Books", icon: BookOpen, path: "/dashboard/books", roles: ["admin", "librarian"] },
  { label: "Book Management", icon: BookCopy, path: "/dashboard/book-management", roles: ["admin", "librarian"] },
  { label: "Reservations", icon: BookmarkCheck, path: "/dashboard/reservations", roles: ["admin", "librarian"] },
  { label: "My Books", icon: BookMarked, path: "/dashboard/my-books", roles: ["student", "faculty"] },
  { label: "OPAC", icon: Search, path: "/dashboard/opac", roles: ["admin", "librarian", "student", "faculty"] },
  { label: "OPAC", icon: BookOpen, path: "/dashboard/opac", roles: ["admin", "librarian"] },
  { label: "DELNET", icon: Globe, path: "/dashboard/delnet", roles: ["admin", "librarian", "student", "faculty"] },
  { label: "E-Resources", icon: Newspaper, path: "/dashboard/e-resources", roles: ["admin", "librarian", "student", "faculty"] },
  { label: "IRINS", icon: Award, path: "/dashboard/irins", roles: ["admin", "librarian", "faculty"] },
  { label: "Reports", icon: BarChart3, path: "/dashboard/reports", roles: ["admin", "librarian"] },
  { label: "Users", icon: Users, path: "/dashboard/users", roles: ["admin"] },
  { label: "Notifications", icon: Bell, path: "/dashboard/notifications", roles: ["student", "faculty"] },
  { label: "Profile", icon: User, path: "/dashboard/profile", roles: ["admin", "librarian", "student", "faculty"] },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string; email: string; school?: string; department?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const setUserFromSession = (session: { user: { user_metadata?: Record<string, string>; app_metadata?: Record<string, any>; email?: string; id?: string } } | null) => {
      if (!session) {
        sessionStorage.removeItem("gcu_user");
        navigate("/login");
        return;
      }

      syncCurrentUserContext(session.user as import("@supabase/supabase-js").User)
        .then((resolved) => {
          const u = session.user;
          const fallbackRole = inferUserRole({
            requestedRole: u.user_metadata?.role,
            email: u.email,
            regNo: u.user_metadata?.reg_no,
            appMetadataRole: u.app_metadata?.library_role ?? u.app_metadata?.role,
            currentRole: u.app_metadata?.library_role ?? u.app_metadata?.role,
          });
          const userData = {
            id: u.id || "",
            name: resolved?.name || u.user_metadata?.name || u.user_metadata?.full_name || u.email || "User",
            role: resolved?.role || fallbackRole,
            email: resolved?.email || u.email || "",
            school: resolved?.school || u.user_metadata?.school || "",
            department: resolved?.department || u.user_metadata?.department || "",
          };
          setUser(userData);
          sessionStorage.setItem("gcu_user", JSON.stringify(userData));

          if (userData.role === "student" && (!userData.school || !userData.department)) {
            navigate("/academic-profile", { replace: true });
          }
        })
        .catch(() => {
          const u = session.user;
          const fallbackUserData = {
            id: u.id || "",
            name: u.user_metadata?.name || u.user_metadata?.full_name || u.email || "User",
            role: inferUserRole({
              requestedRole: u.user_metadata?.role,
              email: u.email,
              regNo: u.user_metadata?.reg_no,
              appMetadataRole: u.app_metadata?.library_role ?? u.app_metadata?.role,
              currentRole: u.app_metadata?.library_role ?? u.app_metadata?.role,
            }),
            email: u.email || "",
            school: u.user_metadata?.school || "",
            department: u.user_metadata?.department || "",
          };
          setUser(fallbackUserData);
          sessionStorage.setItem("gcu_user", JSON.stringify(fallbackUserData));

          if (fallbackUserData.role === "student" && (!fallbackUserData.school || !fallbackUserData.department)) {
            navigate("/academic-profile", { replace: true });
          }
        })
        .finally(() => setLoading(false));
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("DashboardLayout session retrieval error, signing out:", error);
        supabase.auth.signOut().then(() => {
          setUserFromSession(null);
        });
      } else {
        setUserFromSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading || !user) return null;

  if (user.role === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Verification Pending</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account registration is complete, but it is currently in a <strong>pending</strong> state.
            </p>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground text-left space-y-2 leading-relaxed">
            <p>
              <strong>Students:</strong> A valid registration/roll number is required. Unregistered profiles must be approved by the librarian before accessing library catalog and services.
            </p>
            <p>
              <strong>Faculty:</strong> If your account has not been activated yet, please contact the library coordinator to approve your access.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity"
            >
              <LogOut className="h-4 w-4" />
              Sign Out / Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Deduplicate nav items by path for the current role
  const seen = new Set<string>();
  const filteredNav = navItems.filter(n => {
    if (!n.roles.includes(user.role)) return false;
    if (seen.has(n.path)) return false;
    seen.add(n.path);
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 gradient-maroon transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
            <img src={gcuLogo} alt="GCU Logo" className="h-10 w-10 rounded-lg object-cover" />
            <div className="text-sidebar-foreground">
              <p className="font-serif font-bold text-sm leading-tight">Garden City</p>
              <p className="text-xs opacity-70">Library System</p>
            </div>
            <button className="lg:hidden ml-auto text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {filteredNav.map(item => {
              const active = location.pathname === item.path;
              return (
                <button key={item.label}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="w-8 h-8 rounded-full gradient-warm flex items-center justify-center text-secondary-foreground text-xs font-bold">
                {user.name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div className="text-sidebar-foreground">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-xs opacity-60 capitalize">{user.role}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 h-14 bg-card border-b border-border flex items-center px-4 sm:px-6 gap-4">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          {(user.role === "student" || user.role === "faculty") && (
            <button onClick={() => navigate("/dashboard/notifications")} className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
            </button>
          )}
          <div className="flex items-center gap-2 text-sm">
            {user.role === "faculty" ? <Briefcase className="h-5 w-5 text-secondary" /> : <GraduationCap className="h-5 w-5 text-secondary" />}
            <span className="font-medium text-foreground hidden sm:inline">{user.name}</span>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground border-t border-border">
          © 2026 Garden City University. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
