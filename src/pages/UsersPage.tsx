import { useState, useEffect } from "react";
import { Search, Shield, BookOpen, GraduationCap, Loader2 } from "lucide-react";
import type { UserProfile } from "@/lib/types";
import { fetchProfiles } from "@/lib/supabaseService";

const roleIcons = { admin: Shield, librarian: BookOpen, student: GraduationCap };

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProfiles()
      .then(setUsers)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Users Management</h1>
        <p className="text-muted-foreground mt-1">{users.length} registered users</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(u => {
          const RoleIcon = roleIcons[u.role] || GraduationCap;
          return (
            <div key={u.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-secondary-foreground font-bold text-sm">
                  {u.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{u.name}</p>
                  <p className="text-muted-foreground text-xs truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground capitalize">
                  <RoleIcon className="h-3 w-3" /> {u.role}
                </span>
                <span className="text-muted-foreground">{u.department}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">No users found</div>
        )}
      </div>
    </div>
  );
}
