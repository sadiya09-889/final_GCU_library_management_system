import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkCheck, CheckCircle, Clock, Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { BookReservation, BookReservationStatus } from "@/lib/types";
import { fetchBookReservations, updateBookReservationStatus } from "@/lib/supabaseService";
import { supabase } from "@/lib/supabase";

function formatDateTime(value?: string) {
  if (!value) return "Not processed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClass(status: BookReservationStatus) {
  if (status === "pending") return "bg-secondary/10 text-secondary";
  if (status === "approved") return "bg-accent/20 text-accent-foreground";
  if (status === "fulfilled") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<BookReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const loadReservations = useCallback(async () => {
    try {
      const data = await fetchBookReservations();
      setReservations(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load reservations";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations();

    const channel = supabase
      .channel("book-reservations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "book_reservations" }, () => {
        void loadReservations();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadReservations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reservations;

    return reservations.filter((reservation) => [
      reservation.book_title,
      reservation.book_author,
      reservation.book_number,
      reservation.accession_no,
      reservation.student_name,
      reservation.student_email,
      reservation.student_reg_no,
      reservation.status,
    ].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [reservations, search]);

  const stats = useMemo(() => ({
    pending: reservations.filter((reservation) => reservation.status === "pending").length,
    approved: reservations.filter((reservation) => reservation.status === "approved").length,
    completed: reservations.filter((reservation) => reservation.status === "fulfilled").length,
  }), [reservations]);

  const handleStatusUpdate = async (
    reservation: BookReservation,
    status: Exclude<BookReservationStatus, "pending">,
  ) => {
    setUpdatingIds((prev) => Array.from(new Set([...prev, reservation.id])));
    try {
      const updated = await updateBookReservationStatus(reservation.id, status);
      setReservations((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Reservation ${status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update reservation";
      toast.error(message);
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== reservation.id));
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
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Reservations</h1>
          <p className="text-muted-foreground mt-1">Review student reservation requests from OPAC</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Clock className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{stats.pending}</p>
          <p className="text-muted-foreground text-xs">Pending</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <BookmarkCheck className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{stats.approved}</p>
          <p className="text-muted-foreground text-xs">Ready for Pickup</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <CheckCircle className="h-5 w-5 text-green-600 mb-2" />
          <p className="text-2xl font-semibold text-foreground">{stats.completed}</p>
          <p className="text-muted-foreground text-xs">Fulfilled</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reservations..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((reservation) => {
          const updating = updatingIds.includes(reservation.id);

          return (
            <div key={reservation.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h2 className="font-semibold text-foreground">{reservation.book_title}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusClass(reservation.status)}`}>
                      {reservation.status === "approved" ? "ready" : reservation.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{reservation.book_author || "Unknown Author"}</p>
                  <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>Student: {reservation.student_name}</span>
                    <span>Email: {reservation.student_email}</span>
                    <span>Reg No: {reservation.student_reg_no || "N/A"}</span>
                    <span>Requested: {formatDateTime(reservation.requested_at)}</span>
                    <span>Book No: {reservation.book_number || "N/A"}</span>
                    <span>Accession: {reservation.accession_no || "N/A"}</span>
                    <span>Processed: {formatDateTime(reservation.processed_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {reservation.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(reservation, "approved")}
                        disabled={updating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                      >
                        {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkCheck className="h-3.5 w-3.5" />}
                        Mark Ready
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(reservation, "rejected")}
                        disabled={updating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  {reservation.status === "approved" && (
                    <button
                      onClick={() => handleStatusUpdate(reservation, "fulfilled")}
                      disabled={updating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                    >
                      {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Fulfilled
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
            No reservations found
          </div>
        )}
      </div>
    </div>
  );
}
