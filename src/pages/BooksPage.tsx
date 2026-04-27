import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Edit2, Trash2, X, BookOpen, Filter, Loader2, Download, Upload, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Book } from "@/lib/types";
import { fetchBooksPage, fetchBookRecordCount, fetchBookCategories, fetchAllBooks, addBook, updateBook, deleteBook, issueBook, fetchProfile } from "@/lib/supabaseService";
import { exportRowsAsExcelCsv } from "@/lib/excelExport";
import UploadExcelModal from "@/components/UploadExcelModal";
import { supabase } from "@/lib/supabase";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchesBookFilters(
  book: Book,
  filters: {
    search: string;
    category: string;
    status: string;
    yearFilter: string;
    dateFilter: string;
  },
) {
  const q = filters.search.toLowerCase().trim();
  const title = safeText(book.title).toLowerCase();
  const author = safeText(book.author).toLowerCase();
  const isbn = safeText(book.isbn).toLowerCase();
  const bookNumber = safeText(book.book_number).toLowerCase();
  const category = safeText(book.category).toLowerCase();
  const available = safeNumber(book.available, 0);
  const total = safeNumber(book.total, 0);
  const publicationYear = safeNumber(book.year_of_publication, 0);

  const matchesSearch =
    q === "" ||
    title.includes(q) ||
    author.includes(q) ||
    isbn.includes(q) ||
    bookNumber.includes(q) ||
    category.includes(q);

  const matchesCategory = filters.category === "All" || safeText(book.category) === filters.category;

  let matchesStatus = true;
  if (filters.status === "Available") matchesStatus = available > 0;
  else if (filters.status === "Issued") matchesStatus = total - available > 0;
  else if (filters.status === "Out of Stock") matchesStatus = available === 0;

  let matchesYear = true;
  if (filters.yearFilter === "2020-2025") matchesYear = publicationYear >= 2020 && publicationYear <= 2025;
  else if (filters.yearFilter === "2015-2019") matchesYear = publicationYear >= 2015 && publicationYear <= 2019;
  else if (filters.yearFilter === "Before 2015") matchesYear = publicationYear < 2015;

  let matchesDate = true;
  const purchaseDateText = safeText(book.date_of_purchase);
  if (filters.dateFilter !== "All" && purchaseDateText) {
    const purchaseDate = new Date(purchaseDateText);
    if (Number.isNaN(purchaseDate.getTime())) return false;
    const now = new Date();
    const diffDays = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    if (filters.dateFilter === "Last 30 Days") matchesDate = diffDays <= 30;
    else if (filters.dateFilter === "Last 6 Months") matchesDate = diffDays <= 180;
  }

  return matchesSearch && matchesCategory && matchesStatus && matchesYear && matchesDate;
}

type PaginationItem = number | "left-ellipsis" | "right-ellipsis";

function buildPagination(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: PaginationItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push("left-ellipsis");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push("right-ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

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
  const [uploadExcelOpen, setUploadExcelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState<Book | null>(null);
  const [issueForm, setIssueForm] = useState({ studentId: "" });
  const [issuingSaving, setIssuingSaving] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [totalBookRecords, setTotalBookRecords] = useState(0);
  const [matchingBookRecords, setMatchingBookRecords] = useState(0);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadErrorShownRef = useRef(false);

  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const canEdit = user.role === "admin" || user.role === "librarian";

  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadBooks = useCallback(async () => {
    if (!loading) {
      setTableLoading(true);
    }

    try {
      const filters = {
        search,
        category: catFilter,
        status: statusFilter,
        yearFilter,
        dateFilter,
      };

      if (statusFilter === "Issued") {
        const allBooks = await fetchAllBooks();
        const filteredBooks = allBooks.filter((book) => matchesBookFilters(book, filters));
        const totalPagesForResults = Math.max(1, Math.ceil(filteredBooks.length / perPage));
        const safePage = Math.min(page, totalPagesForResults);

        setTotalBookRecords(allBooks.length);
        setMatchingBookRecords(filteredBooks.length);
        setBooks(filteredBooks.slice((safePage - 1) * perPage, safePage * perPage));

        if (safePage !== page) {
          setPage(safePage);
        }
      } else {
        const [bookCount, pageResult] = await Promise.all([
          fetchBookRecordCount(),
          fetchBooksPage({
            page,
            perPage,
            search,
            category: catFilter,
            status: statusFilter as "All" | "Available" | "Issued" | "Out of Stock",
            yearFilter: yearFilter as "All" | "2020-2025" | "2015-2019" | "Before 2015",
            dateFilter: dateFilter as "All" | "Last 30 Days" | "Last 6 Months",
          }),
        ]);

        const totalPagesForResults = Math.max(1, Math.ceil(pageResult.total / perPage));
        const safePage = Math.min(page, totalPagesForResults);

        setTotalBookRecords(bookCount);
        setMatchingBookRecords(pageResult.total);
        setBooks(pageResult.books);

        if (safePage !== page) {
          setPage(safePage);
        }
      }

      if (loadErrorShownRef.current) {
        loadErrorShownRef.current = false;
      }
    } catch (error) {
      if (!loadErrorShownRef.current) {
        loadErrorShownRef.current = true;
        toast.error(getErrorMessage(error, "Failed to load books"));
      }
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [loading, search, catFilter, statusFilter, yearFilter, dateFilter, page, perPage]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    const loadCategoryOptions = async () => {
      try {
        const options = await fetchBookCategories();
        setCategories(options);
      } catch {
        // Keep a safe fallback if categories cannot be loaded.
      }
    };

    void loadCategoryOptions();
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void loadBooks();
      }, 400);
    };

    const channel = supabase
      .channel("books-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleRefresh)
      .subscribe();

    const intervalId = setInterval(() => {
      void loadBooks();
    }, 30000);

    const handleWindowFocus = () => {
      void loadBooks();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadBooks]);

  const filtered = books;
  const totalPages = Math.max(1, Math.ceil(matchingBookRecords / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = books;
  const totalCopies = paginated.reduce((sum, b) => sum + Math.max(0, safeNumber(b.total, 0)), 0);
  const availableCopies = paginated.reduce((sum, b) => sum + Math.max(0, safeNumber(b.available, 0)), 0);
  const issuedCopies = Math.max(totalCopies - availableCopies, 0);
  const paginationItems = buildPagination(currentPage, totalPages);
  const hasActiveFilters =
    Boolean(search.trim()) ||
    catFilter !== "All" ||
    statusFilter !== "All" ||
    yearFilter !== "All" ||
    dateFilter !== "All";

  const openAdd = () => {
    setEditingBook(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditingBook(b);
    setForm({
      title: safeText(b.title), sub_title: safeText(b.sub_title), author: safeText(b.author), author2: safeText(b.author2),
      isbn: safeText(b.isbn), category: safeText(b.category), available: safeNumber(b.available, 0), total: safeNumber(b.total, 0),
      class_number: safeText(b.class_number), book_number: safeText(b.book_number), edition: safeText(b.edition),
      place_of_publication: safeText(b.place_of_publication), name_of_publication: safeText(b.name_of_publication),
      year_of_publication: safeNumber(b.year_of_publication, new Date().getFullYear()), phy_desc: safeText(b.phy_desc), volume: safeText(b.volume),
      general_note: safeText(b.general_note), subject: safeText(b.subject), permanent_location: safeText(b.permanent_location),
      current_library: safeText(b.current_library), location: safeText(b.location), date_of_purchase: safeText(b.date_of_purchase),
      vendor: safeText(b.vendor), bill_number: safeText(b.bill_number), price: safeNumber(b.price, 0),
      call_no: safeText(b.call_no), accession_no: safeText(b.accession_no), item_type: safeText(b.item_type),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.author.trim()) errors.author = "Author is required";
    if (!form.book_number.trim()) errors.book_number = "Book number is required";
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
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save book"));
    } finally {
      setSaving(false);
    }
  };

  const openIssue = (b: Book) => {
    if (safeNumber(b.available, 0) <= 0) {
      toast.error("No copies available to issue");
      return;
    }
    setSelectedBookForIssue(b);
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
        book_title: safeText(selectedBookForIssue.title, "Untitled Book"),
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
      await loadBooks();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to issue book"));
    } finally {
      setIssuingSaving(false);
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
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete book"));
    }
  };

  const handleDownloadBooks = () => {
    const filters = {
      search,
      category: catFilter,
      status: statusFilter,
      yearFilter,
      dateFilter,
    };

    void (async () => {
      try {
        const allBooks = await fetchAllBooks();
        const rows = allBooks
          .filter((book) => matchesBookFilters(book, filters))
          .map((b) => ({
            title: safeText(b.title),
            sub_title: safeText(b.sub_title),
            author: safeText(b.author),
            author2: safeText(b.author2),
            isbn: safeText(b.isbn),
            category: safeText(b.category),
            available: safeNumber(b.available, 0),
            total: safeNumber(b.total, 0),
            class_number: safeText(b.class_number),
            book_number: safeText(b.book_number),
            edition: safeText(b.edition),
            year_of_publication: safeNumber(b.year_of_publication, 0),
            subject: safeText(b.subject),
            date_of_purchase: safeText(b.date_of_purchase),
            vendor: safeText(b.vendor),
            price: safeNumber(b.price, 0),
            item_type: safeText(b.item_type),
          }));

        if (rows.length === 0) {
          toast.info("No books to export");
          return;
        }

        exportRowsAsExcelCsv(rows, "books_export");
        toast.success("Books Excel sheet downloaded");
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to export books"));
      }
    })();
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

  const requiredKeys = ["title", "author", "book_number", "year_of_publication"];

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
          <p className="text-muted-foreground mt-1">{totalBookRecords} books in collection</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadBooks}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card font-semibold text-sm text-foreground hover:bg-muted transition-colors">
              <Download className="h-4 w-4" /> Download Excel
            </button>
            <button onClick={() => setUploadExcelOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card font-semibold text-sm text-foreground hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" /> Upload Excel
            </button>
            <button onClick={openAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4" /> Add Book
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 mb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, author, ISBN, book number, or category"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
          />
        </div>
        <button
          onClick={() => {
            setSearch("");
            setCatFilter("All");
            setStatusFilter("All");
            setYearFilter("All");
            setDateFilter("All");
            setPage(1);
          }}
          disabled={!hasActiveFilters}
          className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Filters
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 shadow-card mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-secondary" />
          Quick Filters
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
          >
            <option value="All">All Status</option>
            <option value="Available">Available</option>
            <option value="Issued">Issued</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
          >
            <option value="All">All Years</option>
            <option value="2020-2025">2020 - 2025</option>
            <option value="2015-2019">2015 - 2019</option>
            <option value="Before 2015">Before 2015</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
          >
            <option value="All">All Added Dates</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="Last 6 Months">Last 6 Months</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
          <p className="text-xs text-muted-foreground">Total Book Records</p>
          <p className="text-xl font-semibold text-foreground mt-1">{totalBookRecords}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
          <p className="text-xs text-muted-foreground">Matching Records</p>
          <p className="text-xl font-semibold text-foreground mt-1">{matchingBookRecords}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
          <p className="text-xs text-muted-foreground">Visible Available Copies</p>
          <p className="text-xl font-semibold text-accent-foreground mt-1">{availableCopies}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
          <p className="text-xs text-muted-foreground">Visible Issued Copies</p>
          <p className="text-xl font-semibold text-secondary mt-1">{issuedCopies}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {tableLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-secondary" />
            Updating books...
          </div>
        )}
        {paginated.map((b) => {
          const title = safeText(b.title, "Untitled Book");
          const author = safeText(b.author, "Unknown Author");
          const category = safeText(b.category, "Uncategorized");
          const bookNumber = safeText(b.book_number, "N/A");
          const isbn = safeText(b.isbn);
          const available = Math.max(0, safeNumber(b.available, 0));
          const total = Math.max(Math.max(0, safeNumber(b.total, 0)), available);
          const yearOfPublication = safeNumber(b.year_of_publication, 0);

          return (
            <article
              key={b.id}
              className="bg-card rounded-xl border border-border px-4 py-4 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{title}</h3>
                    <p className="text-sm text-muted-foreground truncate">{author}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">{category}</span>
                      <span className="px-2 py-1 rounded-md border border-border text-muted-foreground">Book No: {bookNumber}</span>
                      {isbn && <span className="px-2 py-1 rounded-md border border-border text-muted-foreground">ISBN: {isbn}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 lg:justify-end">
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${available > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                      {available}/{total} available
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {yearOfPublication > 0 ? `Published ${yearOfPublication}` : "Year not specified"}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openIssue(b)}
                        title="Issue Book"
                        className="p-1.5 rounded-md hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        title="Edit Book"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteOpen(b.id)}
                        title="Delete Book"
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
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
      {matchingBookRecords > perPage && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {paginationItems.map((item, index) => {
            if (item === "left-ellipsis" || item === "right-ellipsis") {
              return (
                <span key={`${item}-${index}`} className="w-9 text-center text-muted-foreground">...</span>
              );
            }

            return (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${currentPage === item ? "gradient-warm text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {item}
              </button>
            );
          })}

          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
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
              <h3 className="font-semibold text-foreground mb-2">{safeText(selectedBookForIssue.title, "Untitled Book")}</h3>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Author:</span> {safeText(selectedBookForIssue.author, "Unknown Author")}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Book Number:</span> {safeText(selectedBookForIssue.book_number, "N/A")}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Category:</span> {safeText(selectedBookForIssue.category, "Uncategorized")}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Available Copies:</span> {safeNumber(selectedBookForIssue.available, 0)}
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

      <UploadExcelModal
        isOpen={uploadExcelOpen}
        onClose={() => setUploadExcelOpen(false)}
        onSuccess={async () => {
          setUploadExcelOpen(false);
          await loadBooks();
        }}
      />

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
