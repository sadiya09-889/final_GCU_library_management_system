import { useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { fetchIssuedBooksByStudent } from "@/lib/supabaseService";
import { supabase } from "@/lib/supabase";
import type { IssuedBook } from "@/lib/types";

type NotificationType = "due" | "overdue" | "returned" | "reserved";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAt: Date;
}

const FEE_PER_DAY = 2;

const icons: Record<NotificationType, typeof Bell> = {
  due: Clock,
  overdue: AlertTriangle,
  reserved: BookOpen,
  returned: CheckCircle,
};

const iconColors: Record<NotificationType, string> = {
  due: "text-accent",
  overdue: "text-destructive",
  reserved: "text-secondary",
  returned: "text-secondary",
};

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function createNotifications(issuedBooks: IssuedBook[]): AppNotification[] {
  const now = new Date();
  const today = parseDate(now.toISOString().slice(0, 10));

  const data: AppNotification[] = [];

  for (const b of issuedBooks) {
    const dueDate = parseDate(b.due_date);
    const createdAt = b.return_date ? parseDate(b.return_date) : parseDate(b.issue_date);
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (b.status === "issued") {
      if (diffDays === 1) {
        data.push({
          id: `${b.id}-due-1`,
          type: "due",
          title: "Book Due Tomorrow",
          message: `"${b.book_title}" is due tomorrow (${b.due_date}).`,
          time: formatRelative(createdAt),
          read: false,
          createdAt,
        });
      }
      if (diffDays === 0) {
        data.push({
          id: `${b.id}-due-0`,
          type: "due",
          title: "Book Due Today",
          message: `"${b.book_title}" is due today (${b.due_date}).`,
          time: formatRelative(createdAt),
          read: false,
          createdAt,
        });
      }
    }

    if (b.status === "overdue" || diffDays < 0) {
      const daysOverdue = Math.max(1, Math.abs(diffDays));
      const penaltyFee = daysOverdue * FEE_PER_DAY;
      data.push({
        id: `${b.id}-overdue`,
        type: "overdue",
        title: "Penalty Fee Notification",
        message: `"${b.book_title}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue. You have ₹${penaltyFee} penalty fee.`,
        time: formatRelative(createdAt),
        read: false,
        createdAt,
      });
    }

    if (b.status === "returned" && b.return_date) {
      const returnedAt = parseDate(b.return_date);
      data.push({
        id: `${b.id}-returned`,
        type: "returned",
        title: "Return Confirmed",
        message: `"${b.book_title}" has been returned successfully.`,
        time: formatRelative(returnedAt),
        read: true,
        createdAt: returnedAt,
      });
    }
  }

  return data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export default function NotificationsPage() {
  const [issuedBooks, setIssuedBooks] = useState<IssuedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
    const studentId = user?.id as string | undefined;
    const studentEmail = user?.email as string | undefined;

    if (!studentId && !studentEmail) {
      setLoading(false);
      setError("Unable to load notifications for this account.");
      return;
    }

    supabase.auth.getUser()
      .then(async ({ data: { user: authUser } }) => {
        const metadataRegNo =
          typeof authUser?.user_metadata?.reg_no === "string"
            ? authUser.user_metadata.reg_no
            : "";

        const myBooks = await fetchIssuedBooksByStudent({
          id: studentId,
          email: studentEmail,
          regNo: metadataRegNo,
        });

        setIssuedBooks(myBooks);
      })
      .catch(() => setError("Failed to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  const notifications = useMemo(() => createNotifications(issuedBooks), [issuedBooks]);

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Notifications</h1>
        <p className="text-muted-foreground mt-1">{notifications.filter(n => !n.read).length} unread</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {notifications.map(n => {
          const Icon = icons[n.type] || Bell;
          return (
            <div key={n.id} className={`bg-card rounded-xl p-5 shadow-card border transition-shadow hover:shadow-elevated ${!n.read ? "border-secondary/30" : "border-border"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.read ? "bg-secondary/10" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${iconColors[n.type]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">{n.title}</h3>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />}
                  </div>
                  <p className="text-muted-foreground text-sm mt-0.5">{n.message}</p>
                  <p className="text-muted-foreground text-xs mt-2">{n.time}</p>
                </div>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && (
          <div className="bg-card rounded-xl p-6 shadow-card border border-border text-sm text-muted-foreground">
            No notifications right now.
          </div>
        )}
      </div>
    </div>
  );
}
