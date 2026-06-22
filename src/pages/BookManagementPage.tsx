import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, Plus, Edit2, Trash2, X, BookOpen, Filter, Loader2, Download, Upload, 
  Send, ChevronLeft, ChevronRight, BookCopy, RotateCcw, AlertTriangle, Bell, 
  CheckCircle, Receipt, IndianRupee, RefreshCw, BookmarkCheck, User, Calendar
} from "lucide-react";
import { toast } from "sonner";
import type { Book, IssuedBook, UserProfile } from "@/lib/types";
import { 
  fetchBooksPage, fetchBookRecordCount, fetchBookCategories, fetchAllBooks, 
  addBook, updateBook, deleteBook, issueBook, returnBook, renewBook, 
  fetchIssuedBooks, fetchProfile, type ReturnQualityCheck, checkAndUpdateOverdueBooks,
  sendOverdueNotificationForIssue, fetchIssuedBooksByStudent, searchStudents,
  searchBooksForIssue
} from "@/lib/supabaseService";
import { exportRowsAsExcelCsv } from "@/lib/excelExport";
import UploadExcelModal from "@/components/UploadExcelModal";
import { supabase } from "@/lib/supabase";

const FEE_PER_DAY = 2;

const emptyForm = {
  title: "", sub_title: "", author: "", author2: "", isbn: "", category: "",
  available: 0, total: 0, class_number: "", book_number: "", edition: "",
  place_of_publication: "", name_of_publication: "", year_of_publication: 2024,
  phy_desc: "", volume: "", general_note: "", subject: "",
  permanent_location: "", current_library: "", location: "",
  date_of_purchase: "", vendor: "", bill_number: "", price: 0,
  call_no: "", accession_no: "", item_type: "",
};

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

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function BookManagementPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "issue" | "return" | "renew">("catalog");
  const [loading, setLoading] = useState(true);

  // --- Catalog Tab State ---
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [totalBookRecords, setTotalBookRecords] = useState(0);
  const [matchingBookRecords, setMatchingBookRecords] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  // Book Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  // Excel Upload
  const [uploadExcelOpen, setUploadExcelOpen] = useState(false);

  // Delete Confirmation
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);

  // --- Global Loans State (For issue, return, renew, loans tabs) ---
  const [loans, setLoans] = useState<IssuedBook[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansSearch, setLoansSearch] = useState("");
  
  // --- Issue Tab State ---
  const [borrowerSearchText, setBorrowerSearchText] = useState("");
  const [borrowerProfile, setBorrowerProfile] = useState<UserProfile | null>(null);
  const [borrowerProfileLoading, setBorrowerProfileLoading] = useState(false);
  const [borrowerActiveLoans, setBorrowerActiveLoans] = useState<IssuedBook[]>([]);
  const [studentSearchResults, setStudentSearchResults] = useState<UserProfile[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [hasSearchedStudents, setHasSearchedStudents] = useState(false);
  
  const [bookSearchText, setBookSearchText] = useState("");
  const [issueBookRecord, setIssueBookRecord] = useState<Book | null>(null);
  const [issueBookLoading, setIssueBookLoading] = useState(false);
  const [bookSearchResults, setBookSearchResults] = useState<Book[]>([]);
  const [hasSearchedBooks, setHasSearchedBooks] = useState(false);
  
  const [issuingSaving, setIssuingSaving] = useState(false);

  // --- Return Tab State ---
  const [qualityCheckOpen, setQualityCheckOpen] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState<IssuedBook | null>(null);
  const [qualityForm, setQualityForm] = useState<ReturnQualityCheck>(defaultQualityForm);
  const [returnSaving, setReturnSaving] = useState(false);
  const [receipt, setReceipt] = useState<{ book: string; student: string; penaltyFee: number; qualityStatus: ReturnQualityCheck["status"] } | null>(null);

  // --- Renew Tab State ---
  const [renewingId, setRenewingId] = useState<string | null>(null);

  // --- Notification states ---
  const [notified, setNotified] = useState<string[]>([]);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
  const canEdit = user.role === "admin" || user.role === "librarian";

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Load Books Catalog ---
  const loadBooks = useCallback(async () => {
    setTableLoading(true);
    try {
      const filters = {
        search,
        category: catFilter,
        status: statusFilter,
        yearFilter,
        dateFilter,
      };

      // Since statusFilter === "Issued" isn't fully supported in supabaseService.ts fetchBooksPage, we fetch and page in JS or use fallback
      if (statusFilter === "Issued") {
        const allBooks = await fetchAllBooks();
        const filteredBooks = allBooks.filter((book) => {
          const q = search.toLowerCase().trim();
          const title = (book.title || "").toLowerCase();
          const author = (book.author || "").toLowerCase();
          const isbn = (book.isbn || "").toLowerCase();
          const bookNumber = (book.book_number || "").toLowerCase();
          const category = (book.category || "").toLowerCase();
          const available = book.available || 0;
          const total = book.total || 0;
          const publicationYear = book.year_of_publication || 0;

          const matchesSearch =
            q === "" ||
            title.includes(q) ||
            author.includes(q) ||
            isbn.includes(q) ||
            bookNumber.includes(q) ||
            category.includes(q);

          const matchesCategory = catFilter === "All" || book.category === catFilter;
          const matchesStatus = total - available > 0;

          let matchesYear = true;
          if (yearFilter === "2020-2025") matchesYear = publicationYear >= 2020 && publicationYear <= 2025;
          else if (yearFilter === "2015-2019") matchesYear = publicationYear >= 2015 && publicationYear <= 2019;
          else if (yearFilter === "Before 2015") matchesYear = publicationYear < 2015;

          let matchesDate = true;
          if (dateFilter !== "All" && book.date_of_purchase) {
            const purchaseDate = new Date(book.date_of_purchase);
            if (!isNaN(purchaseDate.getTime())) {
              const diffDays = (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
              if (dateFilter === "Last 30 Days") matchesDate = diffDays <= 30;
              else if (dateFilter === "Last 6 Months") matchesDate = diffDays <= 180;
            }
          }

          return matchesSearch && matchesCategory && matchesStatus && matchesYear && matchesDate;
        });

        const totalPagesForResults = Math.max(1, Math.ceil(filteredBooks.length / perPage));
        const safePage = Math.min(page, totalPagesForResults);

        setTotalBookRecords(allBooks.length);
        setMatchingBookRecords(filteredBooks.length);
        setBooks(filteredBooks.slice((safePage - 1) * perPage, safePage * perPage));
        if (safePage !== page) setPage(safePage);
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
        if (safePage !== page) setPage(safePage);
      }
    } catch (error) {
      toast.error("Failed to load books catalog");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [search, catFilter, statusFilter, yearFilter, dateFilter, page, perPage]);

  // --- Load Loans / Issues Transactions ---
  const loadLoans = async () => {
    setLoansLoading(true);
    try {
      await checkAndUpdateOverdueBooks().catch(() => {});
      const data = await fetchIssuedBooks();
      setLoans(data);
    } catch {
      toast.error("Failed to load loan records");
    } finally {
      setLoansLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    void loadBooks();
    void loadLoans();
    
    // Load categories
    fetchBookCategories()
      .then((options) => setCategories(options))
      .catch(() => {});
  }, [loadBooks]);

  // Supabase live updates for books catalog
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void loadBooks();
      }, 500);
    };

    const channel = supabase
      .channel("book-mgmt-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "issued_books" }, () => { void loadLoans(); })
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadBooks]);

  // --- Actions ---

  // Perform student search from Supabase
  const performStudentSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setStudentSearchResults([]);
      setHasSearchedStudents(false);
      return;
    }

    setSearchingStudents(true);
    try {
      const results = await searchStudents(trimmed);
      setStudentSearchResults(results);
      setHasSearchedStudents(true);
    } catch (err) {
      console.error("Error searching students:", err);
      toast.error("Failed to search students");
    } finally {
      setSearchingStudents(false);
    }
  };

  // Debounce search effect
  useEffect(() => {
    if (borrowerProfile) return;
    const term = borrowerSearchText.trim();
    if (!term) {
      setStudentSearchResults([]);
      setHasSearchedStudents(false);
      setSearchingStudents(false);
      return;
    }

    const timer = setTimeout(() => {
      void performStudentSearch(term);
    }, 300);

    return () => clearTimeout(timer);
  }, [borrowerSearchText, borrowerProfile]);

  // Search Borrower
  const handleSearchBorrower = async () => {
    const term = borrowerSearchText.trim();
    if (!term) return;
    await performStudentSearch(term);
  };

  // Select a student
  const handleSelectStudent = async (student: UserProfile) => {
    setBorrowerProfile(student);
    setStudentSearchResults([]);
    setBorrowerSearchText("");
    setBorrowerProfileLoading(true);
    try {
      const userLoans = await fetchIssuedBooksByStudent(student.id);
      setBorrowerActiveLoans(userLoans.filter(l => l.status === "issued" || l.status === "overdue"));
    } catch (err) {
      console.error("Error loading student loans:", err);
      toast.error("Failed to load student's active loans");
    } finally {
      setBorrowerProfileLoading(false);
    }
  };

  // Clear selected student
  const handleClearSelectedStudent = () => {
    setBorrowerProfile(null);
    setBorrowerActiveLoans([]);
    setBorrowerSearchText("");
    setStudentSearchResults([]);
    setHasSearchedStudents(false);
  };

  // Search Book (Issue Tab)
  const handleSearchBookForIssue = async () => {
    const term = bookSearchText.trim();
    if (!term) {
      setBookSearchResults([]);
      setHasSearchedBooks(false);
      return;
    }

    setIssueBookLoading(true);
    setHasSearchedBooks(true);
    setIssueBookRecord(null);

    try {
      const records = await searchBooksForIssue(term);
      setBookSearchResults(records);
      if (records.length === 0) {
        toast.error("No book found matching that query");
      } else if (records.length === 1) {
        const singleBook = records[0];
        setIssueBookRecord(singleBook);
        if (singleBook.available <= 0) {
          toast.warning("Book exists but no copies available");
        }
      }
    } catch {
      toast.error("Error looking up book");
    } finally {
      setIssueBookLoading(false);
    }
  };

  // Quick Issue Setup from Catalog Tab
  const handleQuickIssueSetup = (book: Book) => {
    setIssueBookRecord(book);
    setBookSearchText(book.book_number || "");
    setBookSearchResults([book]);
    setHasSearchedBooks(true);
    setActiveTab("issue");
  };

  // Issue Book Submit
  const handleIssueBookSubmit = async () => {
    if (!borrowerProfile) {
      toast.error("Please look up and select a borrower first");
      return;
    }
    if (!issueBookRecord) {
      toast.error("Please look up and select a book first");
      return;
    }
    if (issueBookRecord.available <= 0) {
      toast.error("No copies of this book are currently available");
      return;
    }

    setIssuingSaving(true);
    try {
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 15); // 15-day checkout

      await issueBook({
        book_id: issueBookRecord.id,
        book_title: issueBookRecord.title,
        student_name: borrowerProfile.name,
        student_id: borrowerProfile.id,
        student_email: borrowerProfile.email,
        issue_date: today.toISOString().split("T")[0],
        due_date: due.toISOString().split("T")[0],
        status: "issued",
      });

      toast.success(`Book issued successfully to ${borrowerProfile.name}`);
      
      // Reset forms/state
      setBookSearchText("");
      setIssueBookRecord(null);
      
      // Refresh borrower active loans
      const userLoans = await fetchIssuedBooksByStudent(borrowerProfile.id);
      setBorrowerActiveLoans(userLoans.filter(l => l.status === "issued" || l.status === "overdue"));
      
      // Reload lists
      void loadBooks();
      void loadLoans();
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue book");
    } finally {
      setIssuingSaving(false);
    }
  };

  // Return Book Quality Check Modal Trigger
  const triggerReturnQualityCheck = (issue: IssuedBook) => {
    setSelectedIssueForReturn(issue);
    setQualityForm(defaultQualityForm);
    setQualityCheckOpen(true);
  };

  // Return Book Submit
  const handleReturnBookSubmit = async () => {
    if (!selectedIssueForReturn) return;

    setReturnSaving(true);
    try {
      const issue = selectedIssueForReturn;
      const due = new Date(issue.due_date);
      const today = new Date();
      const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      const penaltyFee = daysOverdue * FEE_PER_DAY;

      await returnBook(issue.id, qualityForm);
      setReceipt({ 
        book: issue.book_title, 
        student: issue.student_name, 
        penaltyFee, 
        qualityStatus: qualityForm.status 
      });

      setQualityCheckOpen(false);
      setSelectedIssueForReturn(null);
      toast.success("Book returned successfully");
      
      // Refresh active borrower loans if search matched
      if (borrowerProfile) {
        const userLoans = await fetchIssuedBooksByStudent(borrowerProfile.id);
        setBorrowerActiveLoans(userLoans.filter(l => l.status === "issued" || l.status === "overdue"));
      }

      void loadBooks();
      void loadLoans();
    } catch {
      toast.error("Failed to return book");
    } finally {
      setReturnSaving(false);
    }
  };

  // Renew / Re-issue Book Submit
  const handleRenewBookSubmit = async (issue: IssuedBook) => {
    setRenewingId(issue.id);
    try {
      const updated = await renewBook(issue.id);
      toast.success(`Book renewed! New due date: ${updated.due_date}`);
      
      if (borrowerProfile) {
        const userLoans = await fetchIssuedBooksByStudent(borrowerProfile.id);
        setBorrowerActiveLoans(userLoans.filter(l => l.status === "issued" || l.status === "overdue"));
      }

      void loadLoans();
    } catch (err: any) {
      toast.error(err?.message || "Failed to renew book");
    } finally {
      setRenewingId(null);
    }
  };

  // Notify Student of Overdue Book
  const handleNotifyOverdue = async (issue: IssuedBook) => {
    setNotifyingId(issue.id);
    try {
      const didSend = await sendOverdueNotificationForIssue(issue);
      if (didSend) {
        toast.success("Overdue notification sent to student");
        setNotified((prev) => (prev.includes(issue.id) ? prev : [...prev, issue.id]));
      } else {
        toast.message("Notification already sent for this overdue item");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to send notification");
    } finally {
      setNotifyingId(null);
    }
  };

  // Add / Edit Book save handler
  const handleSaveBook = async () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.author.trim()) errors.author = "Author is required";
    if (!form.book_number.trim()) errors.book_number = "Book number is required";
    if (!form.year_of_publication) errors.year_of_publication = "Year of Publication is required";
    if (form.total < 0) errors.total = "Total must be 0 or more";
    if (form.available < 0) errors.available = "Available must be 0 or more";
    if (form.available > form.total) errors.available = "Available cannot exceed Total";
    if (form.price < 0) errors.price = "Price must be 0 or more";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingBook) {
        await updateBook(editingBook.id, { ...form, no_of_copies: form.total });
        toast.success("Book updated successfully");
      } else {
        await addBook({ ...form, no_of_copies: form.total });
        toast.success("Book added successfully");
      }
      setModalOpen(false);
      await loadBooks();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save book");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditingBook(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditingBook(b);
    setForm({
      title: b.title || "", sub_title: b.sub_title || "", author: b.author || "", author2: b.author2 || "",
      isbn: b.isbn || "", category: b.category || "", available: b.available || 0, total: b.total || 0,
      class_number: b.class_number || "", book_number: b.book_number || "", edition: b.edition || "",
      place_of_publication: b.place_of_publication || "", name_of_publication: b.name_of_publication || "",
      year_of_publication: b.year_of_publication || new Date().getFullYear(), phy_desc: b.phy_desc || "", volume: b.volume || "",
      general_note: b.general_note || "", subject: b.subject || "", permanent_location: b.permanent_location || "",
      current_library: b.current_library || "", location: b.location || "", date_of_purchase: b.date_of_purchase || "",
      vendor: b.vendor || "", bill_number: b.bill_number || "", price: b.price || 0,
      call_no: b.call_no || "", accession_no: b.accession_no || "", item_type: b.item_type || "",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleDeleteBook = async (id: string) => {
    try {
      await deleteBook(id);
      setDeleteOpen(null);
      toast.success("Book deleted successfully");
      await loadBooks();
    } catch {
      toast.error("Failed to delete book");
    }
  };

  // Download Catalog
  const handleDownloadCatalog = async () => {
    try {
      const allBooks = await fetchAllBooks();
      const rows = allBooks.map((b) => ({
        title: b.title || "",
        sub_title: b.sub_title || "",
        author: b.author || "",
        isbn: b.isbn || "",
        category: b.category || "",
        available: b.available || 0,
        total: b.total || 0,
        book_number: b.book_number || "",
        year_of_publication: b.year_of_publication || 0,
        price: b.price || 0,
        accession_no: b.accession_no || "",
      }));

      if (rows.length === 0) {
        toast.info("No books to export");
        return;
      }

      exportRowsAsExcelCsv(rows, "library_catalog");
      toast.success("Catalog Excel file downloaded");
    } catch {
      toast.error("Failed to export catalog");
    }
  };

  // Download Issues/Transactions
  // Filter loans list
  const filteredLoans = loans.filter((l) => {
    const matchesSearch = 
      l.book_title.toLowerCase().includes(loansSearch.toLowerCase()) ||
      l.student_name.toLowerCase().includes(loansSearch.toLowerCase()) ||
      l.student_id.toLowerCase().includes(loansSearch.toLowerCase());
      
    return matchesSearch;
  });

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

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1970 + 1 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      {/* Title section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Book Management</h1>
          <p className="text-muted-foreground mt-1">Consolidated library catalog & loan operations dashboard</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-border mb-6">
        <div className="flex flex-wrap -mb-px text-sm font-medium text-center">
          {[
            { id: "catalog", label: "Add/Search Books", icon: BookOpen },
            { id: "issue", label: "Issue Book", icon: Send },
            { id: "return", label: "Return Book", icon: RotateCcw },
            { id: "renew", label: "Re-issue / Renew", icon: RefreshCw },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 p-4 border-b-2 rounded-t-lg transition-colors
                  ${active 
                    ? "border-secondary text-secondary" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div>
        
        {/* --- CATALOG TAB --- */}
        {activeTab === "catalog" && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by title, author, ISBN, book number..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <button onClick={handleDownloadCatalog}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card font-semibold text-sm text-foreground hover:bg-muted transition-colors">
                      <Download className="h-4 w-4" /> Export
                    </button>
                    <button onClick={() => setUploadExcelOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card font-semibold text-sm text-foreground hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" /> Import Excel
                    </button>
                    <button onClick={openAdd}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
                      <Plus className="h-4 w-4" /> Add Book
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-card mb-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
                <Filter className="h-4 w-4 text-secondary" />
                Quick Filters
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  value={catFilter}
                  onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                >
                  <option value="All">All Status</option>
                  <option value="Available">Available</option>
                  <option value="Issued">Issued</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>

                <select
                  value={yearFilter}
                  onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                >
                  <option value="All">All Years</option>
                  <option value="2020-2025">2020 - 2025</option>
                  <option value="2015-2019">2015 - 2019</option>
                  <option value="Before 2015">Before 2015</option>
                </select>

                <select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                >
                  <option value="All">All Added Dates</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 6 Months">Last 6 Months</option>
                </select>
              </div>
            </div>

            {/* Counts */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
                <p className="text-xs text-muted-foreground">Total Book Titles</p>
                <p className="text-xl font-semibold text-foreground mt-1">{totalBookRecords}</p>
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
                <p className="text-xs text-muted-foreground">Matching Books</p>
                <p className="text-xl font-semibold text-foreground mt-1">{matchingBookRecords}</p>
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-card">
                <p className="text-xs text-muted-foreground">Copies Count (Returned Batch)</p>
                <p className="text-xl font-semibold text-accent-foreground mt-1">
                  {books.reduce((acc, b) => acc + (b.available || 0), 0)} / {books.reduce((acc, b) => acc + (b.total || 0), 0)} copies
                </p>
              </div>
            </div>

            {/* Books List */}
            <div className="space-y-3 mb-6">
              {tableLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                  Updating books catalog...
                </div>
              )}
              {books.map((b) => (
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
                        <h3 className="font-semibold text-foreground truncate">{b.title || "Untitled"}</h3>
                        <p className="text-sm text-muted-foreground truncate">{b.author || "Unknown Author"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {b.category && <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">{b.category}</span>}
                          <span className="px-2 py-1 rounded-md border border-border text-muted-foreground">Book No: {b.book_number || "N/A"}</span>
                          {b.isbn && <span className="px-2 py-1 rounded-md border border-border text-muted-foreground">ISBN: {b.isbn}</span>}
                          {b.accession_no && <span className="px-2 py-1 rounded-md border border-border text-muted-foreground">Accession: {b.accession_no.split(',')[0]}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 lg:justify-end">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${(b.available || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                          {b.available || 0} / {b.total || 0} copies available
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {b.year_of_publication ? `Published ${b.year_of_publication}` : "Year not specified"}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleQuickIssueSetup(b)}
                            title="Issue Book"
                            disabled={(b.available || 0) <= 0}
                            className="p-1.5 rounded-md hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors disabled:opacity-30"
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
              ))}

              {books.length === 0 && (
                <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No books found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                </div>
              )}
            </div>

            {/* Catalog Pagination */}
            {matchingBookRecords > perPage && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(matchingBookRecords / perPage)}
                </span>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(matchingBookRecords / perPage), page + 1))}
                  disabled={page === Math.ceil(matchingBookRecords / perPage)}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- ISSUE TAB --- */}
        {activeTab === "issue" && (
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Borrower Lookup Card */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-card flex flex-col justify-between">
              <div>
                <h2 className="font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-secondary" />
                  1. Look up Borrower
                </h2>
                
                <div className="relative mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        value={borrowerSearchText}
                        onChange={(e) => setBorrowerSearchText(e.target.value)}
                        placeholder="Search student by name, email, reg no..."
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                      />
                      {borrowerSearchText && (
                        <button 
                          onClick={() => setBorrowerSearchText("")} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => void performStudentSearch(borrowerSearchText)}
                      disabled={searchingStudents}
                      className="px-4 py-2 bg-secondary text-secondary-foreground font-medium text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>

                  {/* Autocomplete / Results dropdown */}
                  {borrowerSearchText.trim() !== "" && !borrowerProfile && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-border">
                      {searchingStudents && (
                        <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                          Searching students...
                        </div>
                      )}
                      
                      {!searchingStudents && studentSearchResults.length === 0 && hasSearchedStudents && (
                        <div className="p-4 text-center text-sm text-destructive font-medium">
                          Student not registered in portal. <span className="block text-xs text-muted-foreground font-normal mt-1">No registered student found.</span>
                        </div>
                      )}

                      {!searchingStudents && studentSearchResults.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => void handleSelectStudent(student)}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between text-sm group"
                        >
                          <div>
                            <p className="font-semibold text-foreground group-hover:text-secondary transition-colors">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                          {student.reg_no && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded text-foreground font-medium">
                              {student.reg_no}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Student Details Panel */}
                {borrowerProfile ? (
                  <div className="border border-border rounded-xl p-4 bg-muted/20 relative mt-4">
                    <button
                      onClick={handleClearSelectedStudent}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-colors"
                      title="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Avatar Photo or Initials */}
                      <div className="flex-shrink-0">
                        {borrowerProfile.avatar_url ? (
                          <img
                            src={borrowerProfile.avatar_url}
                            alt={borrowerProfile.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-secondary/35"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white font-semibold text-lg flex items-center justify-center shadow-sm">
                            {getInitials(borrowerProfile.name)}
                          </div>
                        )}
                      </div>

                      {/* Detail fields */}
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <h3 className="font-bold text-base text-foreground truncate">{borrowerProfile.name}</h3>
                        <p className="text-xs text-muted-foreground truncate mb-2">{borrowerProfile.email}</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {borrowerProfile.reg_no && (
                            <p className="truncate"><strong className="text-foreground">Reg No:</strong> {borrowerProfile.reg_no}</p>
                          )}
                          {borrowerProfile.contact_number && (
                            <p className="truncate"><strong className="text-foreground">Contact:</strong> {borrowerProfile.contact_number}</p>
                          )}
                          {borrowerProfile.school && (
                            <p className="truncate sm:col-span-2"><strong className="text-foreground">School:</strong> {borrowerProfile.school}</p>
                          )}
                          {borrowerProfile.department && (
                            <p className="truncate sm:col-span-2"><strong className="text-foreground">Dept:</strong> {borrowerProfile.department}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Borrower Current Active Loans */}
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Currently Issued Books ({borrowerActiveLoans.length})
                      </p>
                      {borrowerProfileLoading ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3 w-3 animate-spin text-secondary" />
                          Loading loans...
                        </div>
                      ) : borrowerActiveLoans.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {borrowerActiveLoans.map((l) => (
                            <div key={l.id} className="text-xs border border-border bg-card rounded p-2 flex justify-between items-center shadow-sm">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-foreground truncate">{l.book_title}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Due: {l.due_date} {l.status === "overdue" && <span className="text-destructive font-bold ml-1">(Overdue)</span>}
                                </p>
                              </div>
                              <span className="text-[10px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded capitalize flex-shrink-0 font-medium">{l.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-1">No active issues</p>
                      )}
                    </div>
                  </div>
                ) : (
                  (!borrowerSearchText.trim() || (!searchingStudents && studentSearchResults.length === 0 && !hasSearchedStudents)) && (
                    <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground mt-4">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium">Search registered students to issue a book.</p>
                      <p className="text-xs mt-1 opacity-70">Enter student name, email, or registration number above.</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Book Lookup & Issue Actions */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-card flex flex-col justify-between">
              <div>
                <h2 className="font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-secondary" />
                  2. Select Book
                </h2>
                <div className="flex gap-2 mb-4">
                  <input
                    value={bookSearchText}
                    onChange={(e) => {
                      setBookSearchText(e.target.value);
                      if (issueBookRecord) {
                        setIssueBookRecord(null);
                        setBookSearchResults([]);
                        setHasSearchedBooks(false);
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void handleSearchBookForIssue()}
                    placeholder="Search by Book No, Accession, ISBN, or Title"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  />
                  <button
                    onClick={handleSearchBookForIssue}
                    disabled={issueBookLoading}
                    className="px-4 py-2 bg-secondary text-secondary-foreground font-medium text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {issueBookLoading ? "Searching..." : "Search"}
                  </button>
                </div>

                {/* Autocomplete / Results dropdown */}
                {!issueBookRecord && bookSearchText.trim() !== "" && hasSearchedBooks && (
                  <div className="mb-4 border border-border rounded-lg bg-card max-h-60 overflow-y-auto divide-y divide-border shadow-md">
                    {issueBookLoading && (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                        Searching books...
                      </div>
                    )}
                    {!issueBookLoading && bookSearchResults.length === 0 && (
                      <div className="p-4 text-center text-sm text-destructive font-medium">
                        No book found
                      </div>
                    )}
                    {!issueBookLoading && bookSearchResults.map((b) => {
                      const isOutOfStock = (b.available || 0) <= 0;
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            setIssueBookRecord(b);
                            if (isOutOfStock) {
                              toast.warning("Book exists but no copies available");
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between text-sm group"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-foreground group-hover:text-secondary truncate">{b.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Book No: {b.book_number} {b.accession_no ? `· Acc: ${b.accession_no}` : ""}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${isOutOfStock ? "bg-destructive/10 text-destructive" : "bg-accent/20 text-accent-foreground"}`}>
                            {isOutOfStock ? "Out of Stock" : `${b.available} available`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {issueBookRecord && (
                  <div className="border border-border rounded-xl p-4 bg-muted/20 relative mt-4">
                    <button
                      onClick={() => {
                        setIssueBookRecord(null);
                        setBookSearchResults([]);
                        setHasSearchedBooks(false);
                      }}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-colors"
                      title="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-foreground text-base mb-1">{issueBookRecord.title}</p>
                      <p><strong className="text-foreground">Author:</strong> {issueBookRecord.author}</p>
                      <p><strong className="text-foreground">Book No:</strong> {issueBookRecord.book_number}</p>
                      {issueBookRecord.accession_no && <p><strong className="text-foreground">Accession No:</strong> {issueBookRecord.accession_no}</p>}
                      <p><strong className="text-foreground">Category:</strong> {issueBookRecord.category || "General"}</p>
                      <p><strong className="text-foreground">Stock:</strong> 
                        <span className={`ml-1 font-semibold ${(issueBookRecord.available || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                          {issueBookRecord.available || 0} / {issueBookRecord.total || 0} copies available
                        </span>
                      </p>
                      {(issueBookRecord.available || 0) <= 0 && (
                        <p className="text-xs text-destructive font-medium mt-1">Book exists but no copies available.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout Trigger */}
              <div className="border-t border-border pt-4 mt-6">
                <button
                  onClick={handleIssueBookSubmit}
                  disabled={issuingSaving || !borrowerProfile || !issueBookRecord || (issueBookRecord.available || 0) <= 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {issuingSaving ? "Issuing book..." : "Confirm & Checkout Book"}
                </button>
                {(!borrowerProfile || !issueBookRecord) && (
                  <p className="text-center text-xs text-muted-foreground mt-2">Look up both borrower and book to proceed</p>
                )}
                {issueBookRecord && (issueBookRecord.available || 0) <= 0 && (
                  <p className="text-center text-xs text-destructive mt-2">Selected book is out of stock</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- RETURN TAB --- */}
        {activeTab === "return" && (
          <div>
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                value={loansSearch} 
                onChange={e => setLoansSearch(e.target.value)}
                placeholder="Search return queue by title, borrower name, or ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" 
              />
            </div>

            <div className="space-y-3">
              {loansLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                  Loading loans queue...
                </div>
              )}
              
              {filteredLoans.filter(l => l.status === "issued" || l.status === "overdue").map((loan) => {
                const due = new Date(loan.due_date);
                const today = new Date();
                const daysOverdue = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
                const penaltyFee = daysOverdue * FEE_PER_DAY;

                return (
                  <div key={loan.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <BookOpen className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{loan.book_title}</h3>
                          <p className="text-muted-foreground text-sm">{loan.student_name} ({loan.student_id})</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Issued: {loan.issue_date}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due: {loan.due_date}</span>
                            {daysOverdue > 0 && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded">
                                  {daysOverdue} days overdue · Penalty: ₹{penaltyFee}
                                </span>
                                {notified.includes(loan.id) ? (
                                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-accent-foreground" /> Notified student</span>
                                ) : (
                                  <button
                                    onClick={() => void handleNotifyOverdue(loan)}
                                    disabled={notifyingId === loan.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-secondary text-xs font-semibold text-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50"
                                  >
                                    <Bell className="h-3 w-3" />
                                    {notifyingId === loan.id ? "Notifying..." : "Notify Student"}
                                  </button>
                                )}
                              </div>
                            )}
                            {loan.renewal_count && loan.renewal_count > 0 ? (
                              <span className="text-accent-foreground bg-accent/20 px-2 py-0.5 rounded">
                                Renewed {loan.renewal_count} times
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => triggerReturnQualityCheck(loan)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity"
                      >
                        <CheckCircle className="h-4 w-4" /> Accept Return
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loansLoading && filteredLoans.filter(l => l.status === "issued" || l.status === "overdue").length === 0 && (
                <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40 text-accent-foreground" />
                  <p className="font-semibold text-foreground">All books returned!</p>
                  <p className="text-sm mt-1">No pending active loans matching search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- RENEW TAB --- */}
        {activeTab === "renew" && (
          <div>
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                value={loansSearch} 
                onChange={e => setLoansSearch(e.target.value)}
                placeholder="Search loans to renew by title or borrower..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" 
              />
            </div>

            <div className="space-y-3">
              {loansLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                  Loading loan list...
                </div>
              )}

              {filteredLoans.filter(l => l.status === "issued" || l.status === "overdue").map((loan) => {
                const isOverdue = loan.status === "overdue";
                return (
                  <div key={loan.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <RefreshCw className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{loan.book_title}</h3>
                          <p className="text-muted-foreground text-sm">{loan.student_name} ({loan.student_id})</p>
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Current Due: <strong className={isOverdue ? "text-destructive" : "text-foreground"}>{loan.due_date}</strong></span>
                            <span>Renewal Count: {loan.renewal_count || 0}</span>
                            {loan.last_renewed_at && (
                              <span>Last Renewed: {new Date(loan.last_renewed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => void handleRenewBookSubmit(loan)}
                        disabled={renewingId === loan.id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border border-secondary text-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50"
                      >
                        {renewingId === loan.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Renewing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Renew +15 Days
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loansLoading && filteredLoans.filter(l => l.status === "issued" || l.status === "overdue").length === 0 && (
                <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center text-muted-foreground">
                  <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-40 text-secondary" />
                  <p className="font-semibold text-foreground">No active loans</p>
                  <p className="text-sm mt-1">There are no active checkouts eligible for renewal.</p>
                </div>
              )}
            </div>
          </div>
        )}



      </div>

      {/* --- ADD/EDIT BOOK MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={closeModal} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-4xl p-6 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-secondary" />
                <h2 className="font-semibold text-xl text-foreground">
                  {editingBook ? "Edit Book" : "Add Book"}
                </h2>
              </div>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {textFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {field.label} {["title", "author", "book_number"].includes(field.key) && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    value={form[field.key] as string}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50
                      ${formErrors[field.key] ? "border-destructive focus:ring-destructive/50" : "border-border"}`}
                  />
                  {formErrors[field.key] && (
                    <p className="text-xs text-destructive mt-0.5">{formErrors[field.key]}</p>
                  )}
                </div>
              ))}

              {/* Number fields */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Copies</label>
                <input
                  type="number"
                  min="0"
                  value={form.total}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    // If creating new book, auto-set available to match total
                    setForm({ 
                      ...form, 
                      total: val, 
                      available: editingBook ? form.available : val 
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available Copies</label>
                <input
                  type="number"
                  min="0"
                  max={form.total}
                  value={form.available}
                  onChange={(e) => setForm({ ...form, available: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none"
                />
              </div>

              {/* Year of Publication Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Year of Publication <span className="text-destructive">*</span></label>
                <select
                  value={form.year_of_publication}
                  onChange={(e) => setForm({ ...form, year_of_publication: parseInt(e.target.value) || currentYear })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Date of Purchase */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Purchase</label>
                <input
                  type="date"
                  value={form.date_of_purchase}
                  onChange={(e) => setForm({ ...form, date_of_purchase: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-border pt-4">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveBook} disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-65">
                {saving ? "Saving..." : "Save Book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RETURN QUALITY CHECK MODAL --- */}
      {qualityCheckOpen && selectedIssueForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => !returnSaving && setQualityCheckOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-semibold text-xl text-foreground">Return Quality Check</h2>
                <p className="text-sm text-muted-foreground mt-1">Assess the book condition before checking it back in.</p>
              </div>
              <button onClick={() => !returnSaving && setQualityCheckOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 rounded-lg bg-muted p-4 text-sm">
              <p><strong className="text-foreground">Book:</strong> {selectedIssueForReturn.book_title}</p>
              <p className="text-muted-foreground mt-1">Borrower: {selectedIssueForReturn.student_name} ({selectedIssueForReturn.student_id})</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Overall Condition</label>
                <select
                  value={qualityForm.status}
                  onChange={(e) => setQualityForm((prev) => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none"
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
                <label className="block text-sm font-medium text-foreground mb-2">Check Notes</label>
                <textarea
                  value={qualityForm.notes || ""}
                  onChange={(e) => setQualityForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional details about loose pages, binding tears, marks, etc."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setQualityCheckOpen(false)}
                disabled={returnSaving}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReturnWithQualityCheck}
                disabled={returnSaving}
                className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                {returnSaving ? "Checking in..." : "Complete Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIPT MODAL --- */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setReceipt(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-sm p-6 border border-border text-center">
            <CheckCircle className="h-12 w-12 text-accent-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-foreground mb-2">Book Check-in Complete</h3>
            <p className="text-muted-foreground text-sm mb-1">{receipt.book}</p>
            <p className="text-muted-foreground text-sm mb-4">by {receipt.student}</p>
            <div className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground capitalize">
              Condition: {receipt.qualityStatus.replace("_", " ")}
            </div>
            {receipt.penaltyFee > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 mb-4">
                <p className="text-destructive font-medium text-sm flex items-center justify-center gap-1">
                  <IndianRupee className="h-4 w-4" /> Overdue Fine: ₹{receipt.penaltyFee}
                </p>
              </div>
            )}
            <button onClick={() => setReceipt(null)}
              className="w-full px-4 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION --- */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setDeleteOpen(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-md p-6 border border-border text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4 animate-bounce" />
            <h2 className="font-semibold text-xl text-foreground mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone. This book will be permanently deleted from the catalog.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteOpen(null)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDeleteBook(deleteOpen)} className="px-5 py-2 rounded-lg font-semibold text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">
                Delete Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EXCEL UPLOAD MODAL --- */}
      <UploadExcelModal
        isOpen={uploadExcelOpen}
        onClose={() => setUploadExcelOpen(false)}
        onSuccess={() => {
          setUploadExcelOpen(false);
          void loadBooks();
        }}
      />
    </div>
  );

  function confirmReturnWithQualityCheck() {
    void handleReturnBookSubmit();
  }
}
