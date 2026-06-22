import { useState, useEffect } from "react";
import { IndianRupee, CheckCircle, Clock, CreditCard, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchIssuedBooksByStudent, fetchStudentPenalties, payPenalty } from "@/lib/supabaseService";
import type { IssuedBook } from "@/lib/types";
import { resolveCurrentUserContext } from "@/lib/accountRole";

const FEE_PER_DAY = 2;

export default function FineDetailsPage() {
  const [rawOverdue, setRawOverdue] = useState<IssuedBook[]>([]);
  const [persistentPenalties, setPersistentPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string>("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const resolved = await resolveCurrentUserContext();
      if (!resolved) return;

      setStudentId(resolved.user.id);

      const [books, penalties] = await Promise.all([
        fetchIssuedBooksByStudent({
          id: resolved.user.id,
          email: resolved.email,
          regNo: resolved.regNo,
        }),
        fetchStudentPenalties(resolved.user.id),
      ]);

      setRawOverdue(books.filter((book) => book.status === "overdue"));
      setPersistentPenalties(penalties);
    } catch (error) {
      console.error("Error loading fine details:", error);
      toast.error("Failed to load fine records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handlePayPenalty = async (penaltyId: string) => {
    setPayingId(penaltyId);
    try {
      await payPenalty(penaltyId);
      toast.success("Fine paid successfully!");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to process payment");
    } finally {
      setPayingId(null);
    }
  };

  // 1. Dynamic Active Overdue Fines
  const activeOverdueFines = rawOverdue.map((i) => {
    const due = new Date(i.due_date);
    const today = new Date();
    const days = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      id: i.id,
      bookTitle: i.book_title,
      daysOverdue: days,
      penaltyFee: days * FEE_PER_DAY,
      dueDate: i.due_date,
      type: "active" as const,
    };
  });

  // 2. Persistent Unpaid Penalties (Book returned but fine not paid)
  const pendingPersistent = persistentPenalties.filter((p) => p.status === "pending").map((p) => ({
    id: p.id,
    bookTitle: p.issued_books?.book_title || "Overdue Book",
    daysOverdue: p.days_overdue || 0,
    penaltyFee: Number(p.total_fine || 0),
    dueDate: p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "",
    type: "persistent" as const,
  }));

  // 3. Payment History (Paid penalties)
  const paidPenalties = persistentPenalties.filter((p) => p.status === "paid");

  // Summary Metrics
  const totalPending = activeOverdueFines.reduce((a, b) => a + b.penaltyFee, 0) + pendingPersistent.reduce((a, b) => a + b.penaltyFee, 0);
  const totalPaid = paidPenalties.reduce((a, b) => a + Number(b.total_fine || 0), 0);

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Penalty Fee Details</h1>
        <p className="text-muted-foreground mt-1">Your penalty fee breakdown and payment history</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{totalPending}</p>
          <p className="text-muted-foreground text-xs">Pending Penalty Fee</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <CheckCircle className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{totalPaid}</p>
          <p className="text-muted-foreground text-xs">Total Paid</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <IndianRupee className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{FEE_PER_DAY}</p>
          <p className="text-muted-foreground text-xs">Per Day Rate</p>
        </div>
      </div>

      {/* Pending Fines Section */}
      {(activeOverdueFines.length > 0 || pendingPersistent.length > 0) ? (
        <div className="bg-card rounded-xl shadow-card border border-border mb-6">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-lg text-foreground">Pending Penalty Fees</h2>
          </div>
          <div className="divide-y divide-border">
            {/* 1. Active Fines (Return first) */}
            {activeOverdueFines.map((o) => (
              <div key={o.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-destructive/5">
                <div>
                  <p className="font-medium text-foreground text-sm">{o.bookTitle}</p>
                  <p className="text-xs text-destructive font-medium flex items-center gap-1.5 mt-0.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {o.daysOverdue} days overdue · Return book to pay fine
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Due Date: {o.dueDate}</p>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="font-bold text-destructive">₹{o.penaltyFee}</span>
                  <button
                    disabled
                    title="Please return the book to the library before paying."
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  >
                    Return Book First
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Persistent Fines (Payable) */}
            {pendingPersistent.map((o) => (
              <div key={o.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{o.bookTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.daysOverdue} days overdue · Book returned (unpaid)
                  </p>
                  {o.dueDate && <p className="text-[10px] text-muted-foreground mt-0.5">Returned/Calculated: {o.dueDate}</p>}
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="font-bold text-destructive">₹{o.penaltyFee}</span>
                  <button
                    onClick={() => void handlePayPenalty(o.id)}
                    disabled={payingId === o.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {payingId === o.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CreditCard className="h-3 w-3" />
                    )}
                    Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card border border-border p-8 text-center text-muted-foreground mb-6">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40 text-accent-foreground" />
          <p className="font-semibold text-foreground">No pending fines</p>
          <p className="text-sm mt-1">You are all clear! No overdue books or outstanding balances.</p>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">Payment History</h2>
        </div>
        {paidPenalties.length > 0 ? (
          <div className="divide-y divide-border">
            {paidPenalties.map((p) => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {p.issued_books?.book_title || "Overdue Book"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {p.days_overdue} days overdue · Paid on {p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-IN") : "N/A"}
                  </p>
                </div>
                <span className="font-bold text-accent-foreground">₹{p.total_fine}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            No payment history yet
          </div>
        )}
      </div>
    </div>
  );
}
