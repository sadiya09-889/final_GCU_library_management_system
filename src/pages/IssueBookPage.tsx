import { useState, useEffect } from "react";
import { BookCopy, Search, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { IssuedBook } from "@/lib/types";
import { fetchIssuedBooks, fetchBooks, issueBook } from "@/lib/supabaseService";

export default function IssueBookPage() {
  const [issues, setIssues] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bookNumber: "", isbn: "", studentName: "", studentId: "" });

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

  const filtered = issues.filter(i =>
    i.book_title.toLowerCase().includes(search.toLowerCase()) ||
    i.student_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleIssue = async () => {
    if (!form.bookNumber || !form.studentName || !form.studentId) return;
    setSaving(true);
    try {
      const books = await fetchBooks();
      const book = books.find(b => b.book_number === form.bookNumber || b.isbn === form.isbn);
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 14);
      await issueBook({
        book_id: book?.id || "",
        book_title: book?.title || `Book #${form.bookNumber}`,
        student_name: form.studentName,
        student_id: form.studentId,
        issue_date: today.toISOString().split("T")[0],
        due_date: due.toISOString().split("T")[0],
        status: "issued",
      });
      toast.success("Book issued successfully");
      setModalOpen(false);
      setForm({ bookNumber: "", isbn: "", studentName: "", studentId: "" });
      await loadIssues();
    } catch {
      toast.error("Failed to issue book");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (id: string) => {
    try {
      const { returnBook } = await import("@/lib/supabaseService");
      await returnBook(id);
      toast.success("Book returned");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Issue Books</h1>
          <p className="text-muted-foreground mt-1">Manage book issuance and returns</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Issue Book
        </button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-muted-foreground font-medium">Book</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Student</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">ID</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Issue Date</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Due Date</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Status</th>
              <th className="px-5 py-3 text-muted-foreground font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ib => (
              <tr key={ib.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{ib.book_title}</td>
                <td className="px-5 py-3 text-muted-foreground">{ib.student_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{ib.student_id}</td>
                <td className="px-5 py-3 text-muted-foreground">{ib.issue_date}</td>
                <td className="px-5 py-3 text-muted-foreground">{ib.due_date}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${ib.status === "returned" ? "bg-accent/20 text-accent-foreground" : ib.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                    {ib.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {ib.status === "issued" || ib.status === "overdue" ? (
                    <button onClick={() => handleReturn(ib.id)} className="text-xs font-medium text-secondary hover:underline">Return</button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No issued books found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Issue Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BookCopy className="h-5 w-5 text-secondary" />
                <h2 className="font-semibold text-xl text-foreground">Issue a Book</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Book Number</label>
                <input value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })}
                  placeholder="Enter book number"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">ISBN No</label>
                <input value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })}
                  placeholder="Enter ISBN number"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Student Name</label>
                <input value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Student ID</label>
                <input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleIssue} disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Issuing..." : "Issue Book"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
