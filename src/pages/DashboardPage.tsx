import { useState, useEffect } from "react";
import { BookOpen, Users, BookCopy, AlertTriangle, TrendingUp, Clock, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBooks, fetchIssuedBooks, fetchProfiles, checkAndUpdateOverdueBooks } from "@/lib/supabaseService";
import type { Book, IssuedBook, UserProfile } from "@/lib/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const FEE_PER_DAY = 2;

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
    checkAndUpdateOverdueBooks().then(() =>
      Promise.all([fetchBooks(), fetchIssuedBooks(), fetchProfiles()])
        .then(([b, ib, u]) => {
          setBooks(b);
          setIssuedBooks(ib);
          setUsers(u);
        })
        .catch(() => { })
        .finally(() => setLoading(false))
    );
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

  const adminStats = [
    { label: "Total Books", value: totalBooks, icon: BookOpen, color: "text-secondary" },
    { label: "Books Available", value: available, icon: TrendingUp, color: "text-accent" },
    { label: "Books Issued", value: issued, icon: BookCopy, color: "text-secondary" },
    { label: "Overdue Books", value: overdue, icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Users", value: users.length, icon: Users, color: "text-secondary" },
  ];

  const DEMO_STUDENT_ID = "a7d58a28-57dd-485a-aa70-fd883e85bfff";
  const myIssued = issuedBooks.filter(i => i.student_id === DEMO_STUDENT_ID);
  const myActive = myIssued.filter(i => i.status === "issued" || i.status === "overdue");
  const myOverdue = myIssued.filter(i => i.status === "overdue").length;
  const myUpcomingDue = myIssued.filter(i => {
    if (i.status !== "issued") return false;
    const due = new Date(i.due_date);
    const today = new Date();
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 3;
  }).length;

  const studentStats = [
    { label: "Books Issued", value: myActive.length, icon: BookOpen, color: "text-secondary" },
    { label: "Upcoming Due", value: myUpcomingDue, icon: Clock, color: "text-accent" },
    { label: "Overdue", value: myOverdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  const stats = isStudent ? studentStats : adminStats;

  const toDateOnly = (value: string) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatDay = (value: Date) =>
    value.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const analyticsData = Array.from({ length: 14 }, (_, idx) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (13 - idx));

    const booksAsOfDay = books.filter((b) => {
      const createdAt = (b as Book & { created_at?: string }).created_at || b.date_of_purchase;
      if (!createdAt) return true;
      return toDateOnly(createdAt) <= day;
    });

    const totalBooksAsOfDay = booksAsOfDay.reduce((sum, b) => sum + b.total, 0);

    const activeIssuesAsOfDay = issuedBooks.filter((i) => {
      const issueDate = toDateOnly(i.issue_date);
      if (issueDate > day) return false;
      if (!i.return_date) return true;
      return toDateOnly(i.return_date) > day;
    });

    const issuedAsOfDay = activeIssuesAsOfDay.length;
    const overdueAsOfDay = activeIssuesAsOfDay.filter((i) => toDateOnly(i.due_date) < day).length;
    const availableAsOfDay = Math.max(totalBooksAsOfDay - issuedAsOfDay, 0);

    const usersAsOfDay = users.filter((u) => {
      if (!u.join_date) return true;
      return toDateOnly(u.join_date) <= day;
    }).length;

    return {
      day: formatDay(day),
      totalBooks: totalBooksAsOfDay,
      booksAvailable: availableAsOfDay,
      booksIssued: issuedAsOfDay,
      overdueBooks: overdueAsOfDay,
      totalUsers: usersAsOfDay,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Dashboard</h1>
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

      <div className={`grid ${isStudent ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-3"} gap-4 sm:gap-5 mb-8`}>
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-3xl font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
            <p className="text-sm text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recommended Books - Student only */}
      {isStudent && (
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="font-semibold text-lg text-foreground">Recommended Books</h2>
            <p className="text-muted-foreground text-sm">Books you might be interested in</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Clean Code", author: "Robert C. Martin", category: "Computer Science" },
              { title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Computer Science" },
              { title: "The Psychology of Money", author: "Morgan Housel", category: "Management" },
            ].map((book, i) => (
              <div key={i} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground leading-tight">{book.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{book.author}</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{book.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Analytics - Admin/Librarian only */}
      {!isStudent && (
        <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
          <h2 className="font-semibold text-lg text-foreground mb-6">Daily Library Analytics (Last 14 Days)</h2>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.25)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="rgba(128,128,128,0.6)" />
                <YAxis tick={{ fontSize: 12 }} stroke="rgba(128,128,128,0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="totalBooks" name="Total Books" stroke="#E87722" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="booksAvailable" name="Books Available" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="booksIssued" name="Books Issued" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="overdueBooks" name="Overdue Books" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalUsers" name="Total Users" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


    </div>
  );
}
