import { useState, useEffect } from "react";
import { Search, BookOpen, CheckCircle, Receipt, IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { IssuedBook } from "@/lib/types";
import { fetchIssuedBooks, returnBook } from "@/lib/supabaseService";

const FINE_PER_DAY = 5;

export default function ReturnBooksPage() {
  const [issues, setIssues] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<{ book: string; student: string; fine: number } | null>(null);

  const loadIssues = async () => {
    try {
      const data = await fetchIssuedBooks();
      setIssues(data);
    } catch {
      toast.error("Failed to load issued books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIssues(); }, []);

  const activeIssues = issues.filter(i =>
    (i.status === "issued" || i.status === "overdue") &&
    (i.book_title.toLowerCase().includes(search.toLowerCase()) ||
      i.student_name.toLowerCase().includes(search.toLowerCase()) ||
      i.student_id.toLowerCase().includes(search.toLowerCase()))
  );

  const handleReturn = async (issue: IssuedBook) => {
    const due = new Date(issue.due_date);
    const today = new Date();
    const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const fine = daysOverdue * FINE_PER_DAY;

    try {
      await returnBook(issue.id);
      setReceipt({ book: issue.book_title, student: issue.student_name, fine });
      await loadIssues();
    } catch {
      toast.error("Failed to return book");
    }
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
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Return Books</h1>
        <p className="text-muted-foreground mt-1">Process book returns and auto-calculate fines</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by ISBN, student name, or ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
      </div>

      <div className="space-y-3">
        {activeIssues.map(issue => {
          const due = new Date(issue.due_date);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          const fine = daysOverdue * FINE_PER_DAY;

          return (
            <div key={issue.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-foreground">{issue.book_title}</h3>
                    <p className="text-muted-foreground text-sm">{issue.student_name} ({issue.student_id})</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Due: {issue.due_date}</span>
                      {daysOverdue > 0 && (
                        <span className="text-destructive font-medium">{daysOverdue} days overdue · Fine: ₹{fine}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleReturn(issue)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
                  <CheckCircle className="h-4 w-4" /> Accept Return
                </button>
              </div>
            </div>
          );
        })}
        {activeIssues.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
            No pending returns
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setReceipt(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-sm p-6 border border-border text-center">
            <CheckCircle className="h-12 w-12 text-secondary mx-auto mb-4" />
            <h3 className="font-serif font-bold text-lg text-foreground mb-2">Book Returned</h3>
            <p className="text-muted-foreground text-sm mb-1">{receipt.book}</p>
            <p className="text-muted-foreground text-sm mb-4">by {receipt.student}</p>
            {receipt.fine > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 mb-4">
                <p className="text-destructive font-medium text-sm flex items-center justify-center gap-1">
                  <IndianRupee className="h-4 w-4" /> Fine: ₹{receipt.fine}
                </p>
              </div>
            )}
            <button onClick={() => setReceipt(null)}
              className="w-full px-4 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
              <Receipt className="h-4 w-4 inline mr-1" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
