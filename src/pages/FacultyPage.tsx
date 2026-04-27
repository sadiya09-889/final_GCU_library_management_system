import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Award, Bell, BookMarked, BookOpen, Briefcase, Clock, Globe, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchIssuedBooksByStudent } from "@/lib/supabaseService";
import type { IssuedBook } from "@/lib/types";

function toDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function FacultyPage() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data: { user: authUser } }) => {
        const regNo =
          typeof authUser?.user_metadata?.reg_no === "string"
            ? authUser.user_metadata.reg_no
            : "";

        const books = await fetchIssuedBooksByStudent({
          id: typeof user?.id === "string" ? user.id : "",
          email: typeof user?.email === "string" ? user.email : "",
          regNo,
        });

        setIssuedBooks(books);
      })
      .finally(() => setLoading(false));
  }, [user?.email, user?.id]);

  const activeBooks = useMemo(
    () => issuedBooks.filter((book) => book.status === "issued" || book.status === "overdue"),
    [issuedBooks],
  );

  const upcomingDue = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activeBooks.filter((book) => {
      if (book.status !== "issued") return false;
      const dueDate = toDateOnly(book.due_date);
      if (!dueDate) return false;
      const diffDays = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    }).length;
  }, [activeBooks]);

  const overdueCount = activeBooks.filter((book) => book.status === "overdue").length;

  const quickLinks = [
    { label: "My Books", icon: BookMarked, path: "/dashboard/my-books", desc: "View borrowed books and due dates" },
    { label: "Notifications", icon: Bell, path: "/dashboard/notifications", desc: "Check due soon and overdue alerts" },
    { label: "OPAC", icon: BookOpen, path: "/dashboard/opac", desc: "Search books and discover new arrivals" },
    { label: "DELNET", icon: Globe, path: "/dashboard/delnet", desc: "Browse connected library resources" },
    { label: "IRINS", icon: Award, path: "/dashboard/irins", desc: "Open faculty research profiles" },
    { label: "Profile", icon: User, path: "/dashboard/profile", desc: "Update your faculty details" },
  ];

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
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary mb-3">
          <Briefcase className="h-3.5 w-3.5" /> Faculty Portal
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Welcome, {user?.name || "Faculty Member"}</h1>
        <p className="text-muted-foreground mt-1">Access your library activity, research tools, and faculty resources in one place.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <BookOpen className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{activeBooks.length}</p>
          <p className="text-muted-foreground text-xs">Books On Loan</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{upcomingDue}</p>
          <p className="text-muted-foreground text-xs">Due In 3 Days</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">{overdueCount}</p>
          <p className="text-muted-foreground text-xs">Overdue Books</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="rounded-xl border border-border bg-card p-5 text-left shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                  <link.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="font-semibold text-foreground">{link.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{link.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Current Borrowed Books</h2>
        </div>
        <div className="divide-y divide-border">
          {activeBooks.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">No books are currently issued to this faculty account.</div>
          ) : (
            activeBooks.map((book) => (
              <div key={book.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{book.book_title}</p>
                  <p className="text-sm text-muted-foreground mt-1">Issued: {book.issue_date} · Due: {book.due_date}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${book.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                  {book.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
