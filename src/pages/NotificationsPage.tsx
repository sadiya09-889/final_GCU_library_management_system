import { Bell, BookOpen, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const notifications = [
  { id: "N1", type: "due", title: "Book Due Tomorrow", message: "\"Introduction to Algorithms\" is due on Feb 24, 2026", time: "2 hours ago", read: false },
  { id: "N2", type: "overdue", title: "Overdue Notice", message: "\"Organic Chemistry\" is 21 days overdue. Fine: ₹105", time: "1 day ago", read: false },
  { id: "N3", type: "reserved", title: "Reservation Ready", message: "\"Design Patterns\" is now available for pickup", time: "2 days ago", read: true },
  { id: "N4", type: "returned", title: "Return Confirmed", message: "\"Clean Code\" has been returned successfully", time: "1 week ago", read: true },
];

const icons: Record<string, typeof Bell> = {
  due: Clock,
  overdue: AlertTriangle,
  reserved: BookOpen,
  returned: CheckCircle,
};

const iconColors: Record<string, string> = {
  due: "text-accent",
  overdue: "text-destructive",
  reserved: "text-secondary",
  returned: "text-secondary",
};

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Notifications</h1>
        <p className="text-muted-foreground mt-1">{notifications.filter(n => !n.read).length} unread</p>
      </div>

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
      </div>
    </div>
  );
}
