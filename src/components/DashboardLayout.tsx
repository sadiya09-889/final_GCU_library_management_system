import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, BookCopy, Users, User, LogOut, Menu, X, GraduationCap,
  Globe, Award, Search, BarChart3, AlertTriangle, Bell, BookMarked, IndianRupee, RotateCcw, Settings
} from "lucide-react";
import gcuLogo from "@/assets/gcu-logo.png";
import { supabase } from "@/lib/supabase";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "librarian", "student"] },
  { label: "Books", icon: BookOpen, path: "/dashboard/books", roles: ["admin", "librarian"] },
  { label: "Add / Issue Book", icon: BookCopy, path: "/dashboard/issue", roles: ["admin", "librarian"] },
  { label: "Return Books", icon: RotateCcw, path: "/dashboard/return", roles: ["admin", "librarian"] },
  { label: "Overdue Management", icon: AlertTriangle, path: "/dashboard/overdue", roles: ["admin", "librarian"] },
  { label: "My Books", icon: BookMarked, path: "/dashboard/my-books", roles: ["student"] },
  { label: "Fine Details", icon: IndianRupee, path: "/dashboard/fines", roles: ["student"] },
  { label: "Search Library", icon: Search, path: "/dashboard/opac", roles: ["admin", "librarian", "student"] },
  { label: "OPAC", icon: BookOpen, path: "/dashboard/opac", roles: ["admin", "librarian"] },
  { label: "DELNET", icon: Globe, path: "/dashboard/delnet", roles: ["admin", "librarian", "student"] },
  { label: "IRINS", icon: Award, path: "/dashboard/irins", roles: ["admin", "librarian"] },
  { label: "Reports", icon: BarChart3, path: "/dashboard/reports", roles: ["admin", "librarian"] },
  { label: "Users", icon: Users, path: "/dashboard/users", roles: ["admin"] },
  { label: "Notifications", icon: Bell, path: "/dashboard/notifications", roles: ["student"] },
  { label: "Profile", icon: User, path: "/dashboard/profile", roles: ["admin", "librarian", "student"] },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const setUserFromSession = (session: { user: { user_metadata?: Record<string, string>; email?: string; id?: string } } | null) => {
      if (!session) {
        sessionStorage.removeItem("gcu_user");
        navigate("/login");
        return;
      }
      const u = session.user;
      const userData = {
        id: u.id || "",
        name: u.user_metadata?.name || u.user_metadata?.full_name || u.email || "User",
        role: u.user_metadata?.role || "student",
        email: u.email || "",
      };
      setUser(userData);
      sessionStorage.setItem("gcu_user", JSON.stringify(userData));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserFromSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading || !user) return null;

  // Deduplicate nav items by path for the current role
  const seen = new Set<string>();
  const filteredNav = navItems.filter(n => {
    if (!n.roles.includes(user.role)) return false;
    // For student, "Search Library" replaces "OPAC"
    if (user.role === "student" && n.label === "OPAC") return false;
    if (user.role !== "student" && n.label === "Search Library") return false;
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
          <button onClick={() => navigate("/dashboard/notifications")} className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-5 w-5 text-secondary" />
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
