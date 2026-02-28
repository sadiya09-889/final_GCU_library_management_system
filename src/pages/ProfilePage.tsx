import { useState, useEffect } from "react";
import { User, Mail, Shield, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        const role = u.user_metadata?.role || "student";
        setUser({
          name: role === "librarian" || role === "admin" ? "Murali" : (u.user_metadata?.name || u.user_metadata?.full_name || u.email || "User"),
          email: role === "librarian" || role === "admin" ? "Murali.gcu.edu.in" : (u.email || ""),
          role,
        });
      }
    });
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Your account information</p>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center text-secondary-foreground font-bold text-xl">
            {user.name?.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div>
            <h2 className="font-semibold text-xl text-foreground">{user.name}</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary capitalize mt-1">
              <Shield className="h-3 w-3" /> {user.role}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: Mail, label: "Email", value: user.email },
            { icon: User, label: "Full Name", value: user.name },
            { icon: Shield, label: "Role", value: user.role },
            { icon: Building2, label: "Department", value: user.role === "admin" ? "Administration" : user.role === "librarian" ? "Library" : "Computer Science" },
            { icon: Calendar, label: "Member Since", value: "August 2023" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <item.icon className="h-5 w-5 text-secondary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-foreground capitalize">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
