import { useState, useEffect } from "react";
import { BarChart3, Download, FileText, PieChart, TrendingUp, Loader2 } from "lucide-react";
import { fetchBooks, fetchIssuedBooks } from "@/lib/supabaseService";
import type { Book, IssuedBook } from "@/lib/types";

export default function ReportsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchBooks(), fetchIssuedBooks()])
      .then(([b, ib]) => {
        setBooks(b);
        setIssuedBooks(ib);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const totalBooks = books.reduce((a, b) => a + b.total, 0);
  const totalIssued = issuedBooks.filter(i => i.status === "issued").length;
  const totalOverdue = issuedBooks.filter(i => i.status === "overdue").length;
  const fineCollected = totalOverdue * 50;

  // Monthly data derived from issued_books
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = monthNames[d.getMonth()];
    const issued = issuedBooks.filter(ib => {
      const issueDate = new Date(ib.issue_date);
      return issueDate.getMonth() === d.getMonth() && issueDate.getFullYear() === d.getFullYear();
    }).length;
    const returned = issuedBooks.filter(ib => {
      if (!ib.return_date) return false;
      const retDate = new Date(ib.return_date);
      return retDate.getMonth() === d.getMonth() && retDate.getFullYear() === d.getFullYear();
    }).length;
    return { month, issued, returned };
  });
  const maxIssued = Math.max(...monthlyData.map(d => d.issued), 1);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Library performance overview</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Export PDF
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <FileText className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Collection", value: totalBooks, icon: BarChart3, color: "text-secondary" },
          { label: "Currently Issued", value: totalIssued, icon: TrendingUp, color: "text-accent" },
          { label: "Overdue Books", value: totalOverdue, icon: PieChart, color: "text-destructive" },
          { label: "Fine Collected", value: `₹${fineCollected}`, icon: FileText, color: "text-secondary" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className="text-2xl font-serif font-bold text-foreground">{s.value}</p>
            <p className="text-muted-foreground text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Simple Bar Chart */}
      <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
        <h2 className="font-serif font-bold text-lg text-foreground mb-6">Monthly Book Issues</h2>
        <div className="flex items-end gap-3 h-48">
          {monthlyData.map(d => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-foreground">{d.issued}</span>
              <div className="w-full rounded-t-md gradient-warm transition-all" style={{ height: `${(d.issued / maxIssued) * 100}%`, minHeight: d.issued > 0 ? '4px' : '0px' }} />
              <span className="text-xs text-muted-foreground mt-1">{d.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card rounded-xl shadow-card border border-border p-5">
        <h2 className="font-serif font-bold text-lg text-foreground mb-4">Books by Category</h2>
        {totalBooks > 0 ? (
          <div className="space-y-3">
            {[...new Set(books.map(b => b.category).filter(Boolean))].map(cat => {
              const count = books.filter(b => b.category === cat).reduce((a, b) => a + b.total, 0);
              const pct = Math.round((count / totalBooks) * 100);
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{cat}</span>
                    <span className="text-muted-foreground">{count} books ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-warm rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No books in collection yet</p>
        )}
      </div>
    </div>
  );
}
