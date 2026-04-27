import { useState, useEffect } from "react";
import { AlertTriangle, Bell, Clock, IndianRupee, Loader2, Send, X } from "lucide-react";
import { fetchOverdueBooks, checkAndUpdateOverdueBooks, fetchBooks, issueBook, fetchProfile } from "@/lib/supabaseService";
import type { IssuedBook, Book } from "@/lib/types";

const FEE_PER_DAY = 2;

export default function OverduePage() {
  const [notified, setNotified] = useState<string[]>([]);
  const [rawOverdue, setRawOverdue] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<Book | null>(null);
  const [issueForm, setIssueForm] = useState({ studentId: "" });
  const [issuingSaving, setIssuingSaving] = useState(false);

  useEffect(() => {
    checkAndUpdateOverdueBooks()
      .then(() => Promise.all([fetchOverdueBooks(), fetchBooks()]))
      .then(([overdueData, booksData]) => {
        setRawOverdue(overdueData);
        setBooks(booksData);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const overdueBooks = rawOverdue.map(i => {
    const due = new Date(i.due_date);
    const today = new Date();
    const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return { ...i, daysOverdue, penaltyFee: daysOverdue * FEE_PER_DAY };
  });

  const openIssue = (book: Book) => {
    if (book.available <= 0) {
      alert("No copies available to issue");
      return;
    }
    setSelectedBookForIssue(book);
    setIssueForm({ studentId: "" });
    setIssueModalOpen(true);
  };

  const handleIssueBook = async () => {
    if (!issueForm.studentId.trim()) {
      alert("Please enter Student Reg No or Faculty Email");
      return;
    }
    if (!selectedBookForIssue) return;

    setIssuingSaving(true);
    try {
      const profile = await fetchProfile(issueForm.studentId);
      const resolvedStudentName = profile?.name?.trim() || `Member (${issueForm.studentId})`;

      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 14);

      await issueBook({
        book_id: selectedBookForIssue.id,
        book_title: selectedBookForIssue.title,
        student_name: resolvedStudentName,
        student_id: issueForm.studentId,
        issue_date: today.toISOString().split("T")[0],
        due_date: due.toISOString().split("T")[0],
        status: "issued",
      });

      alert(`Book issued successfully to ${resolvedStudentName}`);
      setIssueModalOpen(false);
      setSelectedBookForIssue(null);
      setIssueForm({ studentId: "" });
      window.location.reload();
    } catch (error) {
      alert("Failed to issue book");
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Overdue Management</h1>
        <p className="text-muted-foreground mt-1">{overdueBooks.length} overdue books · Penalty fee rate: ₹{FEE_PER_DAY}/day</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">{overdueBooks.length}</p>
          <p className="text-muted-foreground text-xs">Overdue Books</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <IndianRupee className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">₹{overdueBooks.reduce((a, b) => a + b.penaltyFee, 0)}</p>
          <p className="text-muted-foreground text-xs">Total Penalty Fee Pending</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{overdueBooks.length > 0 ? Math.max(...overdueBooks.map(o => o.daysOverdue)) : 0}</p>
          <p className="text-muted-foreground text-xs">Max Days Overdue</p>
        </div>
      </div>

      {/* Quick Issue Section */}
      <div className="mb-8 p-5 bg-card rounded-xl shadow-card border border-border">
        <h2 className="font-semibold text-lg text-foreground mb-4">Quick Issue Book</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {books.filter(b => b.available > 0).slice(0, 3).map(b => (
            <button
              key={b.id}
              onClick={() => openIssue(b)}
              className="p-3 rounded-lg border border-border hover:border-secondary hover:bg-secondary/5 transition-colors text-left"
            >
              <p className="font-medium text-foreground text-sm truncate">{b.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{b.author}</p>
              <p className="text-xs text-accent mt-2">{b.available} copies available</p>
            </button>
          ))}
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
              <th className="px-5 py-3 text-muted-foreground font-medium">Penalty Fee</th>
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
                <td className="px-5 py-3 font-medium text-foreground">₹{o.penaltyFee}</td>
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
              <h3 className="font-semibold text-foreground mb-2">{selectedBookForIssue.title}</h3>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Author:</span> {selectedBookForIssue.author}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Book Number:</span> {selectedBookForIssue.book_number}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Category:</span> {selectedBookForIssue.category}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Available Copies:</span> {selectedBookForIssue.available}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Student Reg No / Faculty Email</label>
                <input 
                  value={issueForm.studentId} 
                  onChange={e => setIssueForm({ studentId: e.target.value })}
                  placeholder="Enter student reg no or faculty email"
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
