import { useState, useEffect } from "react";
import { BookOpen, Users, BookCopy, AlertTriangle, TrendingUp, Clock, IndianRupee, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBooks, fetchIssuedBooks, fetchProfiles } from "@/lib/supabaseService";
import type { Book, IssuedBook, UserProfile } from "@/lib/types";

const FINE_PER_DAY = 5;

export default function DashboardPage() {
  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const isStudent = user.role === "student";

  const [books, setBooks] = useState<Book[]>([]);
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchBooks(), fetchIssuedBooks(), fetchProfiles()])
      .then(([b, ib, u]) => {
        setBooks(b);
        setIssuedBooks(ib);
        setUsers(u);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/dashboard/opac?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const totalBooks = books.reduce((a, b) => a + b.total, 0);
  const available = books.reduce((a, b) => a + b.available, 0);
  const issued = issuedBooks.filter(i => i.status === "issued").length;
  const overdue = issuedBooks.filter(i => i.status === "overdue").length;
  const fineCollected = overdue * FINE_PER_DAY * 10;

  const adminStats = [
    { label: "Total Books", value: totalBooks, icon: BookOpen, color: "text-secondary" },
    { label: "Books Available", value: available, icon: TrendingUp, color: "text-accent" },
    { label: "Books Issued", value: issued, icon: BookCopy, color: "text-secondary" },
    { label: "Overdue Books", value: overdue, icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Users", value: users.length, icon: Users, color: "text-secondary" },
    { label: "Fine Collected", value: `₹${fineCollected}`, icon: IndianRupee, color: "text-accent" },
  ];

  const myIssued = issuedBooks.filter(i => i.student_id === user.id || i.student_name === user.name);
  const studentStats = [
    { label: "Books Issued", value: myIssued.filter(i => i.status === "issued").length, icon: BookOpen, color: "text-secondary" },
    { label: "Upcoming Due", value: myIssued.filter(i => i.status === "issued").length, icon: Clock, color: "text-accent" },
    { label: "Overdue", value: myIssued.filter(i => i.status === "overdue").length, icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Fine", value: "₹0", icon: IndianRupee, color: "text-secondary" },
  ];

  const stats = isStudent ? studentStats : adminStats;

  // Monthly data for chart (derived from issued_books)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = monthNames[d.getMonth()];
    const count = issuedBooks.filter(ib => {
      const issueDate = new Date(ib.issue_date);
      return issueDate.getMonth() === d.getMonth() && issueDate.getFullYear() === d.getFullYear();
    }).length;
    return { month, issued: count };
  });
  const maxIssued = Math.max(...monthlyData.map(d => d.issued), 1);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {user.name}. Here's an overview of the library.</p>
      </div>

      {isStudent && (
        <form onSubmit={handleSearch} className="relative mb-6 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search books by title, author, or ISBN..."
            className="w-full pl-12 pr-24 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm shadow-card"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg text-xs font-semibold gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
            Search
          </button>
        </form>
      )}

      <div className={`grid ${isStudent ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"} gap-4 sm:gap-5 mb-8`}>
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{s.value}</p>
            <p className="text-muted-foreground text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Chart - Admin/Librarian only */}
      {!isStudent && (
        <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
          <h2 className="font-serif font-bold text-lg text-foreground mb-6">Monthly Book Issues</h2>
          <div className="flex items-end gap-3 h-40">
            {monthlyData.map(d => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-foreground">{d.issued}</span>
                <div className="w-full rounded-t-md gradient-warm transition-all" style={{ height: `${(d.issued / maxIssued) * 100}%`, minHeight: d.issued > 0 ? '4px' : '0px' }} />
                <span className="text-xs text-muted-foreground mt-1">{d.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-serif font-bold text-lg text-foreground">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-muted-foreground font-medium">Book</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Student</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Issue Date</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Due Date</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {issuedBooks.slice(0, 10).map(ib => (
                <tr key={ib.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{ib.book_title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ib.student_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ib.issue_date}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ib.due_date}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${ib.status === "returned" ? "bg-accent/20 text-accent-foreground" : ib.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                      {ib.status}
                    </span>
                  </td>
                </tr>
              ))}
              {issuedBooks.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
