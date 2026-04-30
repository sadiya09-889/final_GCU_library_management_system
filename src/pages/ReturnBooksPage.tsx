import { useState, useEffect } from "react";
import { Search, BookOpen, CheckCircle, Receipt, IndianRupee, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { IssuedBook, Book } from "@/lib/types";
import { fetchIssuedBooks, returnBook, fetchAvailableBooks, issueBook, fetchProfile, type ReturnQualityCheck } from "@/lib/supabaseService";

const FEE_PER_DAY = 2;

const defaultQualityForm: ReturnQualityCheck = {
  status: "good",
  notes: "",
  checklist: {
    coverIntact: true,
    pagesIntact: true,
    bindingIntact: true,
    cleanPages: true,
  },
};

export default function ReturnBooksPage() {
  const [issues, setIssues] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<{ book: string; student: string; penaltyFee: number; qualityStatus: ReturnQualityCheck["status"] } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<Book | null>(null);
  const [issueForm, setIssueForm] = useState({ studentId: "" });
  const [issuingSaving, setIssuingSaving] = useState(false);
  const [qualityCheckOpen, setQualityCheckOpen] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState<IssuedBook | null>(null);
  const [qualityForm, setQualityForm] = useState<ReturnQualityCheck>(defaultQualityForm);
  const [returnSaving, setReturnSaving] = useState(false);

  const loadIssues = async () => {
    try {
      const [data, booksData] = await Promise.all([fetchIssuedBooks(), fetchAvailableBooks(3)]);
      setIssues(data);
      setBooks(booksData);
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

  const openReturnQualityCheck = (issue: IssuedBook) => {
    setSelectedIssueForReturn(issue);
    setQualityForm(defaultQualityForm);
    setQualityCheckOpen(true);
  };

  const handleReturn = async (issue: IssuedBook, qualityCheck: ReturnQualityCheck) => {
    const due = new Date(issue.due_date);
    const today = new Date();
    const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const penaltyFee = daysOverdue * FEE_PER_DAY;

    try {
      await returnBook(issue.id, qualityCheck);
      setReceipt({ book: issue.book_title, student: issue.student_name, penaltyFee, qualityStatus: qualityCheck.status });
      setQualityCheckOpen(false);
      setSelectedIssueForReturn(null);
      await loadIssues();
    } catch {
      toast.error("Failed to return book");
    }
  };

  const confirmReturnWithQualityCheck = async () => {
    if (!selectedIssueForReturn) return;

    setReturnSaving(true);
    try {
      await handleReturn(selectedIssueForReturn, qualityForm);
    } finally {
      setReturnSaving(false);
    }
  };

  const openIssue = (book: Book) => {
    if (book.available <= 0) {
      toast.error("No copies available to issue");
      return;
    }
    setSelectedBookForIssue(book);
    setIssueForm({ studentId: "" });
    setIssueModalOpen(true);
  };

  const handleIssueBook = async () => {
    if (!issueForm.studentId.trim()) {
      toast.error("Please enter Student Reg No or Faculty Email");
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

      toast.success(`Book issued successfully to ${resolvedStudentName}`);
      setIssueModalOpen(false);
      setSelectedBookForIssue(null);
      setIssueForm({ studentId: "" });
      await loadIssues();
    } catch (error) {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Return Books</h1>
        <p className="text-muted-foreground mt-1">Process book returns and auto-calculate penalty fees</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by ISBN, student name, or ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
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

      <div className="space-y-3">
        {activeIssues.map(issue => {
          const due = new Date(issue.due_date);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          const penaltyFee = daysOverdue * FEE_PER_DAY;

          return (
            <div key={issue.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{issue.book_title}</h3>
                    <p className="text-muted-foreground text-sm">{issue.student_name} ({issue.student_id})</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Due: {issue.due_date}</span>
                      {daysOverdue > 0 && (
                        <span className="text-destructive font-medium">{daysOverdue} days overdue · Penalty Fee: ₹{penaltyFee}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => openReturnQualityCheck(issue)}
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

      {/* Return Quality Check Modal */}
      {qualityCheckOpen && selectedIssueForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => !returnSaving && setQualityCheckOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-semibold text-xl text-foreground">Book Quality Check</h2>
                <p className="text-sm text-muted-foreground mt-1">Inspect the returned book before accepting it.</p>
              </div>
              <button onClick={() => !returnSaving && setQualityCheckOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 rounded-lg bg-muted p-4">
              <p className="font-medium text-foreground">{selectedIssueForReturn.book_title}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedIssueForReturn.student_name} ({selectedIssueForReturn.student_id})</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Overall Condition</label>
                <select
                  value={qualityForm.status}
                  onChange={(e) => setQualityForm((prev) => ({ ...prev, status: e.target.value as ReturnQualityCheck["status"] }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="minor_damage">Minor Damage</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>

              <div>
                <p className="block text-sm font-medium text-foreground mb-2">Checklist</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "coverIntact", label: "Cover intact" },
                    { key: "pagesIntact", label: "Pages intact" },
                    { key: "bindingIntact", label: "Binding intact" },
                    { key: "cleanPages", label: "Pages clean" },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={qualityForm.checklist[item.key as keyof ReturnQualityCheck["checklist"]]}
                        onChange={(e) =>
                          setQualityForm((prev) => ({
                            ...prev,
                            checklist: {
                              ...prev.checklist,
                              [item.key]: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border text-secondary focus:ring-secondary/50"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
                <textarea
                  value={qualityForm.notes || ""}
                  onChange={(e) => setQualityForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  placeholder="Add notes about stains, tears, missing pages, loose binding, or repairs needed"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setQualityCheckOpen(false)}
                disabled={returnSaving}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmReturnWithQualityCheck}
                disabled={returnSaving}
                className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {returnSaving ? "Saving Check..." : "Complete Return"}
              </button>
            </div>
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

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setReceipt(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-sm p-6 border border-border text-center">
            <CheckCircle className="h-12 w-12 text-secondary mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-foreground mb-2">Book Returned</h3>
            <p className="text-muted-foreground text-sm mb-1">{receipt.book}</p>
            <p className="text-muted-foreground text-sm mb-4">by {receipt.student}</p>
            <div className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground capitalize">
              Quality Check: {receipt.qualityStatus.replace("_", " ")}
            </div>
            {receipt.penaltyFee > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 mb-4">
                <p className="text-destructive font-medium text-sm flex items-center justify-center gap-1">
                  <IndianRupee className="h-4 w-4" /> Penalty Fee: ₹{receipt.penaltyFee}
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
