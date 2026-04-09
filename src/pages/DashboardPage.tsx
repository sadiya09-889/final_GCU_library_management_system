import { useState, useEffect, useRef } from "react";
import { BookOpen, Users, BookCopy, AlertTriangle, TrendingUp, Clock, Search, Loader2, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBooks, fetchIssuedBooks, fetchProfiles, checkAndUpdateOverdueBooks, issueBook, fetchProfile } from "@/lib/supabaseService";
import { supabase } from "@/lib/supabase";
import type { Book, IssuedBook, UserProfile } from "@/lib/types";
import { toast } from "sonner";
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

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function isMissingValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function getBookTotalCount(book: Book) {
  if (isMissingValue(book.total)) {
    return 1;
  }

  return Math.max(0, safeNumber(book.total, 0));
}

function getBookAvailableCount(book: Book) {
  if (isMissingValue(book.available)) {
    return getBookTotalCount(book);
  }

  return Math.max(0, safeNumber(book.available, 0));
}

function isBookAvailable(book: Book) {
  return getBookAvailableCount(book) > 0;
}

function toDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DashboardPage() {
  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const isStudent = user.role === "student";
  const isAdmin = user.role === "admin";
  const canViewUsersAnalytics = isAdmin;

  const [books, setBooks] = useState<Book[]>([]);
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<Book | null>(null);
  const [issueForm, setIssueForm] = useState({ studentId: "" });
  const [issuingSaving, setIssuingSaving] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadErrorShownRef = useRef(false);

  const loadDashboardData = async () => {
    try {
      try {
        await checkAndUpdateOverdueBooks();
      } catch {
        // Ignore overdue sync errors and continue with dashboard data fetch.
      }

      const [booksResult, issuedBooksResult, usersResult] = await Promise.allSettled([
        fetchBooks(),
        fetchIssuedBooks(),
        canViewUsersAnalytics ? fetchProfiles() : Promise.resolve([] as UserProfile[]),
      ]);

      let anySuccess = false;

      if (booksResult.status === "fulfilled") {
        setBooks(booksResult.value);
        anySuccess = true;
      }

      if (issuedBooksResult.status === "fulfilled") {
        setIssuedBooks(issuedBooksResult.value);
        anySuccess = true;
      }

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
        anySuccess = true;
      }

      if (!anySuccess && !loadErrorShownRef.current) {
        loadErrorShownRef.current = true;
        toast.error("Unable to fetch dashboard analytics from Supabase");
      }

      if (anySuccess && loadErrorShownRef.current) {
        loadErrorShownRef.current = false;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void loadDashboardData();
      }, 400);
    };

    const channel = supabase
      .channel("dashboard-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "issued_books" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleRefresh)
      .subscribe();

    // Fallback refresh in case realtime events are delayed/missed.
    const intervalId = setInterval(() => {
      void loadDashboardData();
    }, 10000);

    const handleWindowFocus = () => {
      void loadDashboardData();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/dashboard/opac?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const openIssue = (book: Book) => {
    if (getBookAvailableCount(book) <= 0) {
      toast.error("No copies available to issue");
      return;
    }
    setSelectedBookForIssue(book);
    setIssueForm({ studentId: "" });
    setIssueModalOpen(true);
  };

  const handleIssueBook = async () => {
    if (!issueForm.studentId.trim()) {
      toast.error("Please enter Reg No");
      return;
    }
    if (!selectedBookForIssue) return;

    setIssuingSaving(true);
    try {
      const profile = await fetchProfile(issueForm.studentId);
      const resolvedStudentName = profile?.name?.trim() || `Student (${issueForm.studentId})`;

      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 14);

      await issueBook({
        book_id: selectedBookForIssue.id,
        book_title: safeText(selectedBookForIssue.title, "Untitled Book"),
        student_name: resolvedStudentName,
        student_id: issueForm.studentId,
        issue_date: today.toISOString().split("T")[0],
        due_date: due.toISOString().split("T")[0],
        status: "issued",
      });

      toast.success(`Book issued successfully to ${resolvedStudentName}`);
      setIssueModalOpen(false);
      setSelectedBookForIssue(null);
      setIssueForm({ studentId: "" });
      await loadDashboardData();
    } catch {
      toast.error("Failed to issue book");
    } finally {
      setIssuingSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const totalBooks = books.length;
  const available = books.filter(isBookAvailable).length;
  const issued = issuedBooks.filter(i => i.status === "issued" || i.status === "overdue").length;
  const overdue = issuedBooks.filter(i => i.status === "overdue").length;

  const staffStats = [
    { label: "Total Books", value: totalBooks, icon: BookOpen, color: "text-secondary" },
    { label: "Books Available", value: available, icon: TrendingUp, color: "text-accent" },
    { label: "Books Issued", value: issued, icon: BookCopy, color: "text-secondary" },
    { label: "Overdue Books", value: overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (canViewUsersAnalytics) {
    staffStats.push({ label: "Total Users", value: users.length, icon: Users, color: "text-secondary" });
  }

  const studentId = typeof user.id === "string" ? user.id : "";
  const myIssued = issuedBooks.filter(i => i.student_id === studentId);
  const myActive = myIssued.filter(i => i.status === "issued" || i.status === "overdue");
  const myOverdue = myIssued.filter(i => i.status === "overdue").length;
  const myUpcomingDue = myIssued.filter(i => {
    if (i.status !== "issued") return false;
    const due = toDateOnly(i.due_date);
    if (!due) return false;
    const today = new Date();
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 3;
  }).length;

  const studentStats = [
    { label: "Books Issued", value: myActive.length, icon: BookOpen, color: "text-secondary" },
    { label: "Upcoming Due", value: myUpcomingDue, icon: Clock, color: "text-accent" },
    { label: "Overdue", value: myOverdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  const recommendedBooks = books
    .filter((b) => isBookAvailable(b))
    .sort((a, b) => {
      const aDate = (a as Book & { created_at?: string }).created_at || a.date_of_purchase || "";
      const bDate = (b as Book & { created_at?: string }).created_at || b.date_of_purchase || "";
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .slice(0, 3);

  const stats = isStudent ? studentStats : staffStats;

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
      const createdDate = toDateOnly(createdAt);
      if (!createdDate) return true;
      return createdDate <= day;
    });

    const totalBooksAsOfDay = booksAsOfDay.length;
    const availableBooksAsOfDay = booksAsOfDay.filter((b) => isBookAvailable(b)).length;

    const activeIssuesAsOfDay = issuedBooks.filter((i) => {
      const issueDate = toDateOnly(i.issue_date);
      if (!issueDate) return false;
      if (issueDate > day) return false;
      if (!i.return_date) return true;
      const returnDate = toDateOnly(i.return_date);
      if (!returnDate) return true;
      return returnDate > day;
    });

    const issuedAsOfDay = activeIssuesAsOfDay.length;
    const overdueAsOfDay = activeIssuesAsOfDay.filter((i) => {
      const dueDate = toDateOnly(i.due_date);
      return dueDate ? dueDate < day : false;
    }).length;
    const availableAsOfDay = Math.max(availableBooksAsOfDay, 0);

    const usersAsOfDay = canViewUsersAnalytics
      ? users.filter((u) => {
        if (!u.join_date) return true;
        const joinDate = toDateOnly(u.join_date);
        if (!joinDate) return true;
        return joinDate <= day;
      }).length
      : 0;

    return {
      day: formatDay(day),
      totalBooks: totalBooksAsOfDay,
      booksAvailable: availableAsOfDay,
      booksIssued: issuedAsOfDay,
      overdueBooks: overdueAsOfDay,
      totalUsers: usersAsOfDay,
    };
  });

  const monthlyAnalyticsData = Array.from({ length: 12 }, (_, idx) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() - (11 - idx) + 1, 1);

    const issues = issuedBooks.filter((i) => {
      const issueDate = toDateOnly(i.issue_date);
      if (!issueDate) return false;
      return issueDate >= monthStart && issueDate < nextMonthStart;
    }).length;

    const returns = issuedBooks.filter((i) => {
      if (!i.return_date) return false;
      const returnDate = toDateOnly(i.return_date);
      if (!returnDate) return false;
      return returnDate >= monthStart && returnDate < nextMonthStart;
    }).length;

    return {
      month: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      issues,
      returns,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {user.name}. Here's an overview of the library.</p>
        {!isStudent && (
          <p className="text-xs text-muted-foreground mt-2">Live data loaded from Supabase: {books.length} book records</p>
        )}
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
          <div key={s.label}>
            <div 
              onClick={() => setExpandedCard(expandedCard === s.label ? null : s.label)}
              className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              <p className="text-sm text-gray-600 mt-1">{s.label}</p>
            </div>
            
            {/* Expanded Details */}
            {expandedCard === s.label && (
              <div className="mt-3 bg-card rounded-xl p-5 shadow-card border border-border">
                {isStudent ? (
                  <>
                    {s.label === "Books Issued" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Issued Books ({myActive.length})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {myActive.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No books issued</p>
                          ) : (
                            myActive.map(b => (
                              <div key={b.id} className="text-sm p-2 bg-muted rounded">
                                <p className="font-medium text-foreground">{b.book_title}</p>
                                <p className="text-xs text-muted-foreground">Due: {b.due_date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Upcoming Due" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Books Due Soon ({myUpcomingDue})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {myUpcomingDue === 0 ? (
                            <p className="text-sm text-muted-foreground">No books due in the next 3 days</p>
                          ) : (
                            myIssued.filter(i => {
                              if (i.status !== "issued") return false;
                              const due = new Date(i.due_date);
                              const today = new Date();
                              const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
                              return diff > 0 && diff <= 3;
                            }).map(b => (
                              <div key={b.id} className="text-sm p-2 bg-muted rounded">
                                <p className="font-medium text-foreground">{b.book_title}</p>
                                <p className="text-xs text-muted-foreground">Due: {b.due_date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Overdue" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Overdue Books ({myOverdue})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {myOverdue === 0 ? (
                            <p className="text-sm text-muted-foreground">No overdue books</p>
                          ) : (
                            myIssued.filter(i => i.status === "overdue").map(b => (
                              <div key={b.id} className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                                <p className="font-medium text-foreground">{b.book_title}</p>
                                <p className="text-xs text-destructive">Due: {b.due_date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {s.label === "Total Books" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Books by Category</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {books.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No books</p>
                          ) : (
                            Object.entries(
                              books.reduce((acc, b) => {
                                const category = safeText(b.category, "Uncategorized");
                                acc[category] = (acc[category] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([category, count]) => (
                              <div key={category} className="text-sm p-2 bg-muted rounded flex justify-between">
                                <span className="text-foreground">{category}</span>
                                <span className="font-semibold text-secondary">{count}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Books Available" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Available Books Breakdown</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {books.filter((b) => isBookAvailable(b)).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No available books</p>
                          ) : (
                            books.filter((b) => isBookAvailable(b)).map(b => (
                              <div key={b.id} className="text-sm p-2 bg-accent/10 rounded">
                                <p className="font-medium text-foreground">{safeText(b.title, "Untitled Book")}</p>
                                <p className="text-xs text-muted-foreground">Available: {getBookAvailableCount(b)} / {getBookTotalCount(b)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Books Issued" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Currently Issued Books ({issued})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {issued === 0 ? (
                            <p className="text-sm text-muted-foreground">No issued books</p>
                          ) : (
                            issuedBooks.filter(i => i.status === "issued").map(b => (
                              <div key={b.id} className="text-sm p-2 bg-muted rounded">
                                <p className="font-medium text-foreground">{b.book_title}</p>
                                <p className="text-xs text-muted-foreground">{b.student_name} - Due: {b.due_date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Overdue Books" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Overdue Books ({overdue})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {overdue === 0 ? (
                            <p className="text-sm text-muted-foreground">No overdue books</p>
                          ) : (
                            issuedBooks.filter(i => i.status === "overdue").map(b => (
                              <div key={b.id} className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                                <p className="font-medium text-foreground">{b.book_title}</p>
                                <p className="text-xs text-destructive">{b.student_name} - Due: {b.due_date}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {s.label === "Total Users" && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Registered Users ({users.length})</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {users.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No registered users</p>
                          ) : (
                            users.map(u => (
                              <div key={u.id} className="text-sm p-2 bg-muted rounded">
                                <p className="font-medium text-foreground">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Issue Section - Admin only */}
      {!isStudent && (
        <div className="mb-8 p-5 bg-card rounded-xl shadow-card border border-border">
          <h2 className="font-semibold text-lg text-foreground mb-4">Quick Issue Book</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {books.filter((b) => isBookAvailable(b)).slice(0, 4).map(b => (
              <button
                key={b.id}
                onClick={() => openIssue(b)}
                className="p-3 rounded-lg border border-border hover:border-secondary hover:bg-secondary/5 transition-colors text-left"
              >
                <p className="font-medium text-foreground text-sm truncate">{safeText(b.title, "Untitled Book")}</p>
                <p className="text-xs text-muted-foreground mt-1">{safeText(b.author, "Unknown Author")}</p>
                <p className="text-xs text-accent mt-2">{getBookAvailableCount(b)} copies available</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Books - Student only */}
      {isStudent && (
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="font-semibold text-lg text-foreground">Recommended Books</h2>
            <p className="text-muted-foreground text-sm">Books you might be interested in</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendedBooks.map((book) => (
              <div key={book.id} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground leading-tight">{safeText(book.title, "Untitled Book")}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{safeText(book.author, "Unknown Author")}</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{safeText(book.category, "Uncategorized")}</span>
                  </div>
                </div>
              </div>
            ))}
            {recommendedBooks.length === 0 && (
              <div className="md:col-span-3 bg-card rounded-xl p-5 shadow-card border border-border text-sm text-muted-foreground">
                No recommendations available yet.
              </div>
            )}
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
                {canViewUsersAnalytics && (
                  <Line type="monotone" dataKey="totalUsers" name="Total Users" stroke="#7c3aed" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isStudent && user.role === "admin" && (
        <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
          <h2 className="font-semibold text-lg text-foreground mb-6">Monthly Library Analytics (Last 12 Months)</h2>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyAnalyticsData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.25)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="rgba(128,128,128,0.6)" />
                <YAxis tick={{ fontSize: 12 }} stroke="rgba(128,128,128,0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="issues" name="Books Issued" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="returns" name="Books Returned" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Issue Book Modal */}
      {issueModalOpen && selectedBookForIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setIssueModalOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-secondary" />
                <h2 className="font-semibold text-xl text-foreground">Issue Book</h2>
              </div>
              <button onClick={() => setIssueModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            
            {/* Book Details */}
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{safeText(selectedBookForIssue.title, "Untitled Book")}</h3>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Author:</span> {safeText(selectedBookForIssue.author, "Unknown Author")}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Book Number:</span> {safeText(selectedBookForIssue.book_number, "N/A")}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Category:</span> {safeText(selectedBookForIssue.category, "Uncategorized")}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Available Copies:</span> {getBookAvailableCount(selectedBookForIssue)}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Student Reg No</label>
                <input 
                  value={issueForm.studentId} 
                  onChange={e => setIssueForm({ studentId: e.target.value })}
                  placeholder="Enter student registration number"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" 
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIssueModalOpen(false)} 
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleIssueBook} 
                disabled={issuingSaving}
                className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
                {issuingSaving ? "Issuing..." : "Issue Book"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
