import { useState, useEffect } from "react";
import { Search, Filter, BookOpen, Eye, BookmarkPlus, Loader2 } from "lucide-react";
import type { Book } from "@/lib/types";
import { fetchBooks } from "@/lib/supabaseService";

export default function OPACPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [availOnly, setAvailOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [reserved, setReserved] = useState<string[]>([]);

  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...new Set(books.map(b => b.category).filter(Boolean))];
  const years = ["All", ...new Set(books.map(b => b.year_of_publication.toString()))].sort();

  const filtered = books.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn.includes(search);
    const matchCat = catFilter === "All" || b.category === catFilter;
    const matchYear = yearFilter === "All" || b.year_of_publication.toString() === yearFilter;
    const matchAvail = !availOnly || b.available > 0;
    return matchSearch && matchCat && matchYear && matchAvail;
  });

  const handleReserve = (bookId: string) => {
    setReserved(prev => [...prev, bookId]);
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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">OPAC</h1>
        <p className="text-muted-foreground mt-1">Online Public Access Catalog — Search and discover books</p>
      </div>

      {/* Search Bar */}
      <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, author, or ISBN..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-secondary/50 appearance-none">
              <option value="All">All Categories</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Management">Management</option>
            </select>
          </div>
          <div className="relative">
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-secondary/50 appearance-none">
              <option value="All">All Years</option>
              {years.filter(y => y !== "All").map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)}
              className="rounded border-border text-secondary focus:ring-secondary" />
            Available only
          </label>
        </div>
      </div>

      {/* Results */}
      <p className="text-sm text-muted-foreground mb-4">{filtered.length} results found</p>
      <div className="space-y-3">
        {filtered.map(b => (
          <div key={b.id} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{b.title}</h3>
                  <p className="text-muted-foreground text-sm">{b.author} · {b.year_of_publication}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">{b.category}</span>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">ISBN: {b.isbn}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${b.available > 0 ? "bg-accent/20 text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>
                      {b.available > 0 ? `${b.available} Available` : "Unavailable"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <button onClick={() => setSelectedBook(b)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
                  <Eye className="h-3.5 w-3.5" /> Details
                </button>
                {b.available === 0 && !reserved.includes(b.id) && (
                  <button onClick={() => handleReserve(b.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
                    <BookmarkPlus className="h-3.5 w-3.5" /> Reserve
                  </button>
                )}
                {reserved.includes(b.id) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent-foreground">
                    ✓ Reserved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setSelectedBook(null)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 border border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h2 className="font-semibold text-xl text-foreground">{selectedBook.title}</h2>
                  <p className="text-muted-foreground text-sm">{selectedBook.author}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBook(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "ISBN", value: selectedBook.isbn },
                { label: "Category", value: selectedBook.category },
                { label: "Year of Publication", value: selectedBook.year_of_publication },
                { label: "Total Copies", value: selectedBook.total },
                { label: "Available", value: selectedBook.available },
                { label: "Status", value: selectedBook.available > 0 ? "Available" : "All copies issued" },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
