import { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, X, BookOpen, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Book } from "@/lib/types";
import { fetchBooks, addBook, updateBook, deleteBook } from "@/lib/supabaseService";

const emptyForm = {
  title: "", sub_title: "", author: "", author2: "", isbn: "", category: "",
  available: 0, total: 0, class_number: "", book_number: "", edition: "",
  place_of_publication: "", name_of_publication: "", year_of_publication: 2024,
  phy_desc: "", volume: "", general_note: "", subject: "",
  permanent_location: "", current_library: "", location: "",
  date_of_purchase: "", vendor: "", bill_number: "", price: 0,
  call_no: "", accession_no: "", item_type: "",
};

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;

  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const canEdit = user.role === "admin" || user.role === "librarian";

  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadBooks = async () => {
    try {
      const data = await fetchBooks();
      setBooks(data);
    } catch {
      toast.error("Failed to load books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBooks(); }, []);

  const categories = ["All", ...new Set(books.map(b => b.category).filter(Boolean))];

  const filtered = books.filter(b => {
    // Search filter
    const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase());
    // Category filter
    const matchesCategory = catFilter === "All" || b.category === catFilter;
    // Status filter
    let matchesStatus = true;
    if (statusFilter === "Available") matchesStatus = b.available > 0;
    else if (statusFilter === "Issued") matchesStatus = b.total - b.available > 0;
    else if (statusFilter === "Out of Stock") matchesStatus = b.available === 0;
    // Year filter
    let matchesYear = true;
    if (yearFilter === "2020-2025") matchesYear = b.year_of_publication >= 2020 && b.year_of_publication <= 2025;
    else if (yearFilter === "2015-2019") matchesYear = b.year_of_publication >= 2015 && b.year_of_publication <= 2019;
    else if (yearFilter === "Before 2015") matchesYear = b.year_of_publication < 2015;
    // Date filter (using date_of_purchase as proxy for added date)
    let matchesDate = true;
    if (dateFilter !== "All" && b.date_of_purchase) {
      const purchaseDate = new Date(b.date_of_purchase);
      const now = new Date();
      const diffDays = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dateFilter === "Last 30 Days") matchesDate = diffDays <= 30;
      else if (dateFilter === "Last 6 Months") matchesDate = diffDays <= 180;
    }
    return matchesSearch && matchesCategory && matchesStatus && matchesYear && matchesDate;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditingBook(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditingBook(b);
    setForm({
      title: b.title, sub_title: b.sub_title, author: b.author, author2: b.author2,
      isbn: b.isbn, category: b.category, available: b.available, total: b.total,
      class_number: b.class_number, book_number: b.book_number, edition: b.edition,
      place_of_publication: b.place_of_publication, name_of_publication: b.name_of_publication,
      year_of_publication: b.year_of_publication, phy_desc: b.phy_desc, volume: b.volume,
      general_note: b.general_note, subject: b.subject, permanent_location: b.permanent_location,
      current_library: b.current_library, location: b.location, date_of_purchase: b.date_of_purchase,
      vendor: b.vendor, bill_number: b.bill_number, price: b.price,
      call_no: b.call_no, accession_no: b.accession_no, item_type: b.item_type,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.author.trim()) errors.author = "Author is required";
    if (!form.year_of_publication) errors.year_of_publication = "Year of Publication is required";
    if (form.total < 0) errors.total = "Total must be 0 or more";
    if (form.available < 0) errors.available = "Available must be 0 or more";
    if (form.available > form.total) errors.available = "Available cannot exceed Total";
    if (form.price < 0) errors.price = "Price must be 0 or more";
    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    try {
      if (editingBook) {
        await updateBook(editingBook.id, form);
        toast.success("Book updated successfully");
      } else {
        await addBook(form);
        toast.success("Book added successfully");
      }
      setModalOpen(false);
      await loadBooks();
    } catch {
      toast.error("Failed to save book");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormErrors({});
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBook(id);
      setDeleteOpen(null);
      toast.success("Book deleted successfully");
      await loadBooks();
    } catch {
      toast.error("Failed to delete book");
    }
  };

  const textFields: { label: string; key: keyof typeof emptyForm }[] = [
    { label: "Title", key: "title" },
    { label: "Sub Title", key: "sub_title" },
    { label: "Author", key: "author" },
    { label: "Author 2", key: "author2" },
    { label: "ISBN", key: "isbn" },
    { label: "Category", key: "category" },
    { label: "Subject", key: "subject" },
    { label: "Class Number", key: "class_number" },
    { label: "Book Number", key: "book_number" },
    { label: "Edition", key: "edition" },
    { label: "Place of Publication", key: "place_of_publication" },
    { label: "Name of Publication", key: "name_of_publication" },
    { label: "Phy.Desc", key: "phy_desc" },
    { label: "Volume", key: "volume" },
    { label: "General Note", key: "general_note" },
    { label: "Permanent Location", key: "permanent_location" },
    { label: "Current Library", key: "current_library" },
    { label: "Location", key: "location" },
    { label: "Vendor", key: "vendor" },
    { label: "Bill Number", key: "bill_number" },
    { label: "Call No", key: "call_no" },
    { label: "Accession No", key: "accession_no" },
    { label: "Item Type", key: "item_type" },
  ];

  const numberFields: { label: string; key: keyof typeof emptyForm }[] = [
    { label: "Available", key: "available" },
    { label: "Total", key: "total" },
    { label: "Price", key: "price" },
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1970 + 1 }, (_, i) => currentYear - i);

  const requiredKeys = ["title", "author", "year_of_publication"];

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
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Books Management</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} books in collection</p>
        </div>
        {canEdit && (
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Add Book
          </button>
        )}
      </div>



      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {paginated.map(b => (
          <div key={b.id} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <BookOpen className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteOpen(b.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-foreground mb-1 leading-tight">{b.title}</h3>
            <p className="text-muted-foreground text-sm mb-3">{b.author}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">{b.category}</span>
              <span className={`font-medium ${b.available > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                {b.available}/{b.total} available
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {paginated.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No books found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? "gradient-warm text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={closeModal} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 border border-border">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-card pb-2">
              <h2 className="font-semibold text-xl text-foreground">{editingBook ? "Edit Book" : "Add New Book"}</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {textFields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {f.label}
                      {requiredKeys.includes(f.key) && <span className="text-destructive ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={form[f.key] as string}
                      onChange={e => {
                        setForm({ ...form, [f.key]: e.target.value });
                        if (formErrors[f.key]) setFormErrors(prev => ({ ...prev, [f.key]: "" }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${formErrors[f.key] ? "border-destructive focus:ring-destructive/50" : "border-border focus:ring-secondary/50"}`}
                    />
                    {formErrors[f.key] && <p className="text-destructive text-xs mt-1">{formErrors[f.key]}</p>}
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date of Purchase</label>
                  <input type="date" value={form.date_of_purchase} onChange={e => setForm({ ...form, date_of_purchase: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Year of Publication<span className="text-destructive ml-1">*</span>
                  </label>
                  <select
                    value={form.year_of_publication}
                    onChange={e => {
                      setForm({ ...form, year_of_publication: parseInt(e.target.value) || 0 });
                      if (formErrors.year_of_publication) setFormErrors(prev => ({ ...prev, year_of_publication: "" }));
                    }}
                    className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${formErrors.year_of_publication ? "border-destructive focus:ring-destructive/50" : "border-border focus:ring-secondary/50"}`}>
                    <option value="">Select Year</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {formErrors.year_of_publication && <p className="text-destructive text-xs mt-1">{formErrors.year_of_publication}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {numberFields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form[f.key] === 0 ? "" : form[f.key]}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        setForm({ ...form, [f.key]: val === "" ? 0 : parseInt(val, 10) });
                        if (formErrors[f.key]) setFormErrors(prev => ({ ...prev, [f.key]: "" }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${formErrors[f.key] ? "border-destructive focus:ring-destructive/50" : "border-border focus:ring-secondary/50"}`}
                    />
                    {formErrors[f.key] && <p className="text-destructive text-xs mt-1">{formErrors[f.key]}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Saving..." : editingBook ? "Update" : "Add Book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setDeleteOpen(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-sm p-6 border border-border text-center">
            <Trash2 className="h-10 w-10 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-foreground mb-2">Delete Book?</h3>
            <p className="text-muted-foreground text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteOpen(null)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteOpen)} className="px-5 py-2 rounded-lg font-semibold text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
