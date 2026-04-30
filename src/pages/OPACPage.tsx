import { useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Loader2,
  Search,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import type { AcademicProgramme, Book, BookReservation } from "@/lib/types";
import {
  createBookReservation,
  fetchAcademicProgrammes,
  fetchBookReservationsByStudent,
  fetchOpacBooksPage,
} from "@/lib/supabaseService";
import { supabase } from "@/lib/supabase";
import {
  getProgrammeRecommendationKeywords,
  getSchoolDisplayName,
  groupProgrammesBySchool,
} from "@/lib/academicProgrammes";

const OPAC_PAGE_SIZE = 12;
const QUERY_STALE_TIME = 5 * 60 * 1000;
const QUERY_CACHE_TIME = 30 * 60 * 1000;

const YEAR_FILTERS = [
  { value: "All", label: "All Years", start: null, end: null },
  { value: "2020-2025", label: "2020 - 2025", start: 2020, end: 2025 },
  { value: "2015-2019", label: "2015 - 2019", start: 2015, end: 2019 },
  { value: "Before 2015", label: "Before 2015", start: null, end: 2014 },
] as const;

type YearFilterValue = typeof YEAR_FILTERS[number]["value"];
type PaginationItem = number | "left-ellipsis" | "right-ellipsis";

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debounced;
}

function buildPagination(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: PaginationItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("left-ellipsis");
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < totalPages - 1) pages.push("right-ellipsis");

  pages.push(totalPages);
  return pages;
}

function getYearBounds(yearFilter: YearFilterValue) {
  const selected = YEAR_FILTERS.find((range) => range.value === yearFilter) ?? YEAR_FILTERS[0];
  return { yearStart: selected.start, yearEnd: selected.end };
}

function getProgrammeKeywords(
  programmes: AcademicProgramme[],
  schoolFilter: string,
  departmentFilter: string,
) {
  if (schoolFilter === "All") return [];

  const matchingProgrammes = programmes.filter((programme) => {
    if (programme.school !== schoolFilter) return false;
    return departmentFilter === "All" || programme.department === departmentFilter;
  });

  return Array.from(new Set(
    matchingProgrammes.flatMap((programme) => (
      getProgrammeRecommendationKeywords(programme.school, programme.department)
    )),
  ));
}

export default function OPACPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const urlSearch = useMemo(() => (
    new URLSearchParams(location.search).get("q")?.trim() ?? ""
  ), [location.search]);

  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [schoolFilter, setSchoolFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState<YearFilterValue>("All");
  const [availOnly, setAvailOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [reservingIds, setReservingIds] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const userId = typeof user?.id === "string" ? user.id : "";
  const canReserveBooks = user?.role === "student" || user?.role === "faculty";
  const reservationQueryKey = useMemo(() => ["book-reservations", userId], [userId]);

  const programmesQuery = useQuery({
    queryKey: ["academic-programmes"],
    queryFn: fetchAcademicProgrammes,
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
  });

  const programmes = useMemo(() => programmesQuery.data ?? [], [programmesQuery.data]);
  const schoolGroups = useMemo(() => groupProgrammesBySchool(programmes), [programmes]);
  const schoolOptions = useMemo(() => Array.from(schoolGroups.keys()), [schoolGroups]);
  const departmentOptions = useMemo(() => {
    if (schoolFilter === "All") return programmes;
    return schoolGroups.get(schoolFilter) ?? [];
  }, [programmes, schoolFilter, schoolGroups]);

  const programmeKeywords = useMemo(() => (
    getProgrammeKeywords(programmes, schoolFilter, departmentFilter)
  ), [departmentFilter, programmes, schoolFilter]);

  const yearBounds = useMemo(() => getYearBounds(yearFilter), [yearFilter]);
  const opacQueryParams = useMemo(() => ({
    page,
    perPage: OPAC_PAGE_SIZE,
    search: debouncedSearch,
    availableOnly: availOnly,
    programmeKeywords,
    yearStart: yearBounds.yearStart,
    yearEnd: yearBounds.yearEnd,
  }), [availOnly, debouncedSearch, page, programmeKeywords, yearBounds.yearEnd, yearBounds.yearStart]);

  const opacQuery = useQuery({
    queryKey: ["opac-books", opacQueryParams],
    queryFn: () => fetchOpacBooksPage(opacQueryParams),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
  });

  const reservationsQuery = useQuery({
    queryKey: reservationQueryKey,
    queryFn: () => fetchBookReservationsByStudent(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    gcTime: QUERY_CACHE_TIME,
  });

  useEffect(() => {
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    setPage(1);
  }, [availOnly, debouncedSearch, departmentFilter, schoolFilter, yearFilter]);

  useEffect(() => {
    if (opacQuery.error) {
      toast.error(getErrorMessage(opacQuery.error, "Failed to load OPAC books"));
    }
  }, [opacQuery.error]);

  useEffect(() => {
    if (reservationsQuery.error) {
      toast.error(getErrorMessage(reservationsQuery.error, "Failed to load reservations"));
    }
  }, [reservationsQuery.error]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["opac-books"] });
      }, 400);
    };

    const channel = supabase
      .channel("opac-books-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const books = opacQuery.data?.books ?? [];
  const totalResults = opacQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalResults / OPAC_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginationItems = buildPagination(currentPage, totalPages);
  const fromResult = totalResults === 0 ? 0 : (currentPage - 1) * OPAC_PAGE_SIZE + 1;
  const toResult = Math.min(currentPage * OPAC_PAGE_SIZE, totalResults);
  const isInitialLoading = opacQuery.isLoading && !opacQuery.data;
  const isUpdating = opacQuery.isFetching && Boolean(opacQuery.data);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data]);
  const activeReservationByBookId = useMemo(() => (
    reservations.reduce((acc, reservation) => {
      if (reservation.status !== "pending" && reservation.status !== "approved") return acc;
      acc[reservation.book_id] = reservation;
      return acc;
    }, {} as Record<string, BookReservation>)
  ), [reservations]);

  const handleSchoolFilterChange = (school: string) => {
    setSchoolFilter(school);
    setDepartmentFilter("All");
  };

  const handleReserve = async (book: Book) => {
    if (!canReserveBooks) {
      toast.error("Only student and faculty accounts can reserve books");
      return;
    }

    setReservingIds((prev) => Array.from(new Set([...prev, book.id])));
    try {
      const reservation = await createBookReservation(book);
      queryClient.setQueryData<BookReservation[]>(reservationQueryKey, (existing = []) => {
        const withoutDuplicate = existing.filter((item) => item.id !== reservation.id);
        return [reservation, ...withoutDuplicate];
      });
      toast.success("Reservation request sent to the library");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reserve book"));
    } finally {
      setReservingIds((prev) => prev.filter((id) => id !== book.id));
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">OPAC</h1>
        <p className="text-muted-foreground mt-1">Online Public Access Catalog - Search and discover books</p>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, author, ISBN, subject, or book number..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
            <select
              value={schoolFilter}
              onChange={(event) => handleSchoolFilterChange(event.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-secondary/50 appearance-none"
            >
              <option value="All">All Schools</option>
              {schoolOptions.map((school) => (
                <option key={school} value={school}>{getSchoolDisplayName(school)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              disabled={schoolFilter === "All"}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-secondary/50 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="All">{schoolFilter === "All" ? "Select School First" : "All Departments"}</option>
              {departmentOptions.map((programme) => (
                <option key={programme.sheet_name} value={programme.department}>{programme.department}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value as YearFilterValue)}
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-secondary/50 appearance-none"
            >
              {YEAR_FILTERS.map((range) => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer rounded-lg border border-border bg-background px-3 py-2">
            <input
              type="checkbox"
              checked={availOnly}
              onChange={(event) => setAvailOnly(event.target.checked)}
              className="rounded border-border text-secondary focus:ring-secondary"
            />
            Available only
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {totalResults.toLocaleString()} unique results found
          {totalResults > 0 && ` - showing ${fromResult.toLocaleString()}-${toResult.toLocaleString()}`}
        </p>
        {isUpdating && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary" />
            Updating catalog
          </span>
        )}
      </div>

      <div className="space-y-3">
        {books.map((book) => {
          const title = safeText(book.title, "Untitled Book");
          const author = safeText(book.author, "Unknown Author");
          const category = safeText(book.category, "Uncategorized");
          const isbn = safeText(book.isbn, "N/A");
          const available = Math.max(0, safeNumber(book.available, 0));
          const total = Math.max(available, safeNumber(book.total, 0));
          const activeReservation = activeReservationByBookId[book.id];
          const reserving = reservingIds.includes(book.id);

          return (
            <article key={book.id} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="text-muted-foreground text-sm">{author} - {book.year_of_publication || "Year not specified"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">{category}</span>
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">ISBN: {isbn}</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${available > 0 ? "bg-accent/20 text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>
                        {available > 0 ? `${available}/${total || available} Available` : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" /> Details
                  </button>
                  {available === 0 && canReserveBooks && !activeReservation && (
                    <button
                      onClick={() => handleReserve(book)}
                      disabled={reserving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {reserving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                      {reserving ? "Reserving..." : "Reserve"}
                    </button>
                  )}
                  {activeReservation && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Reserved
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {books.length === 0 && (
        <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No books found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {totalResults > OPAC_PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {paginationItems.map((item, index) => {
            if (item === "left-ellipsis" || item === "right-ellipsis") {
              return <span key={`${item}-${index}`} className="w-9 text-center text-muted-foreground">...</span>;
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

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setSelectedBook(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 border border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-6 w-6 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-xl text-foreground">{safeText(selectedBook.title, "Untitled Book")}</h2>
                  <p className="text-muted-foreground text-sm">{safeText(selectedBook.author, "Unknown Author")}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBook(null)} className="text-muted-foreground hover:text-foreground">X</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "ISBN", value: safeText(selectedBook.isbn, "N/A") },
                { label: "Category", value: safeText(selectedBook.category, "Uncategorized") },
                { label: "Subject", value: safeText(selectedBook.subject, "N/A") },
                { label: "Call No", value: safeText(selectedBook.call_no, "N/A") },
                { label: "Book Number", value: safeText(selectedBook.book_number, "N/A") },
                { label: "Accession No", value: safeText(selectedBook.accession_no, "N/A") },
                { label: "Year of Publication", value: selectedBook.year_of_publication || "N/A" },
                { label: "Total Copies", value: Math.max(safeNumber(selectedBook.total, 0), safeNumber(selectedBook.available, 0)) },
                { label: "Available Copies", value: Math.max(0, safeNumber(selectedBook.available, 0)) },
                { label: "Status", value: safeNumber(selectedBook.available, 0) > 0 ? "Available" : "All copies issued" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
