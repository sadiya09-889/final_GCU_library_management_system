import { useState, useEffect } from "react";
import { IndianRupee, CheckCircle, Clock, CreditCard, Loader2 } from "lucide-react";
import { fetchOverdueBooks } from "@/lib/supabaseService";
import type { IssuedBook } from "@/lib/types";

const FINE_PER_DAY = 5;

export default function FineDetailsPage() {
  const [rawOverdue, setRawOverdue] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverdueBooks()
      .then(setRawOverdue)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const overdueBooks = rawOverdue.map(i => {
    const due = new Date(i.due_date);
    const today = new Date();
    const days = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return { ...i, daysOverdue: days, fine: days * FINE_PER_DAY };
  });

  const totalPending = overdueBooks.reduce((a, b) => a + b.fine, 0);
  // Payment history would come from a payments table in a full implementation
  const totalPaid = 0;

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Fine Details</h1>
        <p className="text-muted-foreground mt-1">Your fine breakdown and payment history</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{totalPending}</p>
          <p className="text-muted-foreground text-xs">Pending Fine</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <CheckCircle className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{totalPaid}</p>
          <p className="text-muted-foreground text-xs">Total Paid</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <IndianRupee className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{FINE_PER_DAY}</p>
          <p className="text-muted-foreground text-xs">Per Day Rate</p>
        </div>
      </div>

      {/* Pending Fines */}
      {overdueBooks.length > 0 && (
        <div className="bg-card rounded-xl shadow-card border border-border mb-6">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-lg text-foreground">Pending Fines</h2>
          </div>
          <div className="divide-y divide-border">
            {overdueBooks.map(o => (
              <div key={o.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">{o.book_title}</p>
                  <p className="text-muted-foreground text-xs">{o.daysOverdue} days overdue</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-destructive">₹{o.fine}</span>
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
                    <CreditCard className="h-3 w-3" /> Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">Payment History</h2>
        </div>
        <div className="px-5 py-8 text-center text-muted-foreground text-sm">
          No payment history yet
        </div>
      </div>
    </div>
  );
}
