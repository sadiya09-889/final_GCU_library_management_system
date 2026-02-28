import { useState, useEffect } from "react";
import { BookOpen, RefreshCw, Clock, AlertTriangle, Loader2 } from "lucide-react";
import type { IssuedBook } from "@/lib/types";
import { fetchIssuedBooks } from "@/lib/supabaseService";

export default function MyBooksPage() {
  const [renewals, setRenewals] = useState<Record<string, number>>({});
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const MAX_RENEWALS = 2;

  const DEMO_STUDENT_ID = "a7d58a28-57dd-485a-aa70-fd883e85bfff";

  useEffect(() => {
    fetchIssuedBooks()
      .then(data => {
        const myBooks = data.filter(i => i.student_id === DEMO_STUDENT_ID);
        setIssuedBooks(myBooks);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleRenew = (id: string) => {
    const count = renewals[id] || 0;
    if (count >= MAX_RENEWALS) return;
    setRenewals(prev => ({ ...prev, [id]: count + 1 }));
  };

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">My Books</h1>
        <p className="text-muted-foreground mt-1">Books currently issued to you</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <BookOpen className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{issuedBooks.filter(b => b.status === "issued").length}</p>
          <p className="text-muted-foreground text-xs">Currently Issued</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{issuedBooks.filter(b => {
            if (b.status !== "issued") return false;
            const due = new Date(b.due_date);
            const today = new Date();
            const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            return diff > 0 && diff <= 3;
          }).length}</p>
          <p className="text-muted-foreground text-xs">Upcoming Due</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">{issuedBooks.filter(b => b.status === "overdue").length}</p>
          <p className="text-muted-foreground text-xs">Overdue</p>
        </div>
      </div>

      <div className="space-y-3">
        {issuedBooks.map(book => {
          const renewCount = renewals[book.id] || 0;
          const canRenew = book.status === "issued" && renewCount < MAX_RENEWALS;
          return (
            <div key={book.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{book.book_title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Issued: {book.issue_date}</span>
                      <span>Due: {book.due_date}</span>
                      {renewCount > 0 && <span className="text-secondary">Renewed {renewCount}x</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${book.status === "returned" ? "bg-accent/20 text-accent-foreground" : book.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                    {book.status}
                  </span>
                  {canRenew && (
                    <button onClick={() => handleRenew(book.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
                      <RefreshCw className="h-3 w-3" /> Renew
                    </button>
                  )}
                  {book.status === "issued" && renewCount >= MAX_RENEWALS && (
                    <span className="text-xs text-muted-foreground">Max renewals reached</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {issuedBooks.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
            No books currently issued
          </div>
        )}
      </div>
    </div>
  );
}
