import { useState, useEffect } from "react";
import { AlertTriangle, Bell, Clock, IndianRupee, Loader2 } from "lucide-react";
import { fetchOverdueBooks, checkAndUpdateOverdueBooks } from "@/lib/supabaseService";
import type { IssuedBook } from "@/lib/types";

const FINE_PER_DAY = 5;

export default function OverduePage() {
  const [notified, setNotified] = useState<string[]>([]);
  const [rawOverdue, setRawOverdue] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAndUpdateOverdueBooks()
      .then(() => fetchOverdueBooks())
      .then(setRawOverdue)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const overdueBooks = rawOverdue.map(i => {
    const due = new Date(i.due_date);
    const today = new Date();
    const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return { ...i, daysOverdue, fine: daysOverdue * FINE_PER_DAY };
  });

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Overdue Management</h1>
        <p className="text-muted-foreground mt-1">{overdueBooks.length} overdue books · Fine rate: ₹{FINE_PER_DAY}/day</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">{overdueBooks.length}</p>
          <p className="text-muted-foreground text-xs">Overdue Books</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <IndianRupee className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{overdueBooks.reduce((a, b) => a + b.fine, 0)}</p>
          <p className="text-muted-foreground text-xs">Total Fine Pending</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{overdueBooks.length > 0 ? Math.max(...overdueBooks.map(o => o.daysOverdue)) : 0}</p>
          <p className="text-muted-foreground text-xs">Max Days Overdue</p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-muted-foreground font-medium">Book</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Student</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Due Date</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Days Overdue</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Fine</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {overdueBooks.map(o => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{o.book_title}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.student_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.due_date}</td>
                <td className="px-5 py-3">
                  <span className="text-destructive font-medium">{o.daysOverdue} days</span>
                </td>
                <td className="px-5 py-3 font-medium text-foreground">₹{o.fine}</td>
                <td className="px-5 py-3">
                  {notified.includes(o.id) ? (
                    <span className="text-xs text-muted-foreground">Notified ✓</span>
                  ) : (
                    <button onClick={() => setNotified(prev => [...prev, o.id])}
                      className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline">
                      <Bell className="h-3 w-3" /> Notify
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {overdueBooks.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No overdue books</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
