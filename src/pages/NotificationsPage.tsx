import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BookOpen, Clock, Loader2 } from "lucide-react";
import { fetchNotificationsForStudent, markNotificationsAsRead } from "@/lib/supabaseService";
import { supabase } from "@/lib/supabase";
import { resolveCurrentUserContext } from "@/lib/accountRole";
import type { LibraryNotification, LibraryNotificationType } from "@/lib/types";

type NotificationItem = LibraryNotification & {
  read: boolean;
  createdAt: Date;
  time: string;
};

const icons: Record<LibraryNotificationType, typeof Bell> = {
  due_soon: Clock,
  overdue: AlertTriangle,
  penalty: BookOpen,
  custom: Bell,
};

const iconColors: Record<LibraryNotificationType, string> = {
  due_soon: "text-accent",
  overdue: "text-destructive",
  penalty: "text-secondary",
  custom: "text-secondary",
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

function toNotificationItem(notification: LibraryNotification): NotificationItem {
  const createdAt = new Date(notification.created_at);

  return {
    ...notification,
    read: Boolean(notification.read_at),
    createdAt,
    time: formatRelative(createdAt),
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    const resolved = await resolveCurrentUserContext();
    const profileId = resolved?.profile?.id || resolved?.user.id;

    if (!profileId) {
      throw new Error("Unable to load notifications for this account.");
    }

    const data = await fetchNotificationsForStudent({
      id: profileId,
      regNo: resolved?.regNo || undefined,
      email: resolved?.email || undefined,
    });

    setNotifications(data.map(toNotificationItem));
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (active) setError("");
        await loadNotifications();
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load notifications.";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void refresh();

    const channel = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleMarkAsRead = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    await markNotificationsAsRead(uniqueIds);
    setNotifications((current) => current.map((notification) => (
      uniqueIds.includes(notification.id)
        ? { ...notification, read_at: notification.read_at || new Date().toISOString(), read: true }
        : notification
    )));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAsRead(notifications.filter((n) => !n.read).map((n) => n.id))}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = icons[notification.type] || Bell;
          const unread = !notification.read;
          return (
            <div key={notification.id} className={`bg-card rounded-xl p-5 shadow-card border transition-shadow hover:shadow-elevated ${unread ? "border-secondary/30" : "border-border"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${unread ? "bg-secondary/10" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${iconColors[notification.type]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-foreground">{notification.title}</h3>
                      {unread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />}
                    </div>
                    {unread && (
                      <button
                        type="button"
                        onClick={() => void handleMarkAsRead([notification.id])}
                        className="text-xs font-medium text-secondary hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{notification.time}</p>
                </div>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && !error && (
          <div className="bg-card rounded-xl p-6 shadow-card border border-border text-sm text-muted-foreground">
            No notifications right now.
          </div>
        )}
      </div>
    </div>
  );
}
