import { BarChart3, Download, FileText, Loader2, PieChart, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchBookRecordCount, fetchIssuedBooks, fetchOverdueBooks } from "@/lib/supabaseService";
import type { IssuedBook } from "@/lib/types";

type SummaryState = {
  totalCollection: number;
  currentlyIssued: number;
  overdueBooks: number;
};

type MonthlyIssuesPoint = {
  month: string;
  issues: number;
};

const chartW = 500;
const chartH = 200;
const padX = 40;
const padY = 20;
const plotW = chartW - padX * 2;
const plotH = chartH - padY * 2;

function getMonthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const parsed = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(parsed.getTime())) return monthKey;
  return parsed.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function buildMonthlyIssues(issuedBooks: IssuedBook[]): MonthlyIssuesPoint[] {
  const counts = new Map<string, number>();

  for (const row of issuedBooks) {
    const key = getMonthKey(row.issue_date);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, issues]) => ({ month, issues }));
}

function getPoint(index: number, value: number, pointCount: number, maxIssues: number) {
  const safePointCount = Math.max(1, pointCount - 1);
  const safeMaxIssues = maxIssues > 0 ? maxIssues : 1;
  const x = padX + (index / safePointCount) * plotW;
  const y = padY + plotH - (value / safeMaxIssues) * plotH;
  return { x, y };
}

function getLinePath(monthlyIssues: MonthlyIssuesPoint[], maxIssues: number) {
  if (monthlyIssues.length === 0) return "";

  const points = monthlyIssues.map((point, index) =>
    getPoint(index, point.issues, monthlyIssues.length, maxIssues),
  );

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
    const cp1y = points[i].y;
    const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
    const cp2y = points[i + 1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }

  return path;
}

function getAreaPath(monthlyIssues: MonthlyIssuesPoint[], maxIssues: number) {
  if (monthlyIssues.length === 0) return "";

  const linePath = getLinePath(monthlyIssues, maxIssues);
  const lastPoint = getPoint(
    monthlyIssues.length - 1,
    monthlyIssues[monthlyIssues.length - 1].issues,
    monthlyIssues.length,
    maxIssues,
  );
  const firstPoint = getPoint(0, monthlyIssues[0].issues, monthlyIssues.length, maxIssues);

  return `${linePath} L ${lastPoint.x} ${padY + plotH} L ${firstPoint.x} ${padY + plotH} Z`;
}

export default function ReportsPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryState>({
    totalCollection: 0,
    currentlyIssued: 0,
    overdueBooks: 0,
  });
  const [monthlyIssues, setMonthlyIssues] = useState<MonthlyIssuesPoint[]>([]);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);

      try {
        const [totalCollection, issuedBooks, overdueBooks] = await Promise.all([
          fetchBookRecordCount(),
          fetchIssuedBooks(),
          fetchOverdueBooks(),
        ]);

        if (!active) return;

        setSummary({
          totalCollection,
          currentlyIssued: issuedBooks.filter((book) => book.status === "issued").length,
          overdueBooks: overdueBooks.length,
        });
        setMonthlyIssues(buildMonthlyIssues(issuedBooks));
      } catch {
        if (!active) return;

        setSummary({
          totalCollection: 0,
          currentlyIssued: 0,
          overdueBooks: 0,
        });
        setMonthlyIssues([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();

    return () => {
      active = false;
    };
  }, []);

  const maxIssues = useMemo(() => {
    if (monthlyIssues.length === 0) return 0;
    return Math.max(...monthlyIssues.map((point) => point.issues));
  }, [monthlyIssues]);

  const linePath = useMemo(() => getLinePath(monthlyIssues, maxIssues), [monthlyIssues, maxIssues]);
  const areaPath = useMemo(() => getAreaPath(monthlyIssues, maxIssues), [monthlyIssues, maxIssues]);
  const points = useMemo(
    () => monthlyIssues.map((point, index) => getPoint(index, point.issues, monthlyIssues.length, maxIssues)),
    [monthlyIssues, maxIssues],
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Library performance overview</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Export PDF
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <FileText className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <div
                onClick={() => setExpandedCard(expandedCard === "totalCollection" ? null : "totalCollection")}
                className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow cursor-pointer"
              >
                <BarChart3 className="h-5 w-5 text-secondary mb-2" />
                <p className="text-2xl font-semibold text-foreground">{summary.totalCollection}</p>
                <p className="text-muted-foreground text-xs">Total Collection</p>
              </div>

              {expandedCard === "totalCollection" && (
                <div className="mt-3 bg-card rounded-xl p-5 shadow-card border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Collection Count</h3>
                  <p className="text-sm text-muted-foreground">
                    This value now counts book records in the library collection, not the sum of all copy totals.
                  </p>
                </div>
              )}
            </div>

            <div>
              <div
                onClick={() => setExpandedCard(expandedCard === "currentlyIssued" ? null : "currentlyIssued")}
                className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow cursor-pointer"
              >
                <TrendingUp className="h-5 w-5 text-accent mb-2" />
                <p className="text-2xl font-semibold text-foreground">{summary.currentlyIssued}</p>
                <p className="text-muted-foreground text-xs">Currently Issued</p>
              </div>

              {expandedCard === "currentlyIssued" && (
                <div className="mt-3 bg-card rounded-xl p-5 shadow-card border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Monthly Trend</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {monthlyIssues.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No issue records available yet.</p>
                    ) : (
                      monthlyIssues.map((month) => (
                        <div key={month.month} className="text-sm p-2 bg-muted rounded flex justify-between items-center">
                          <span className="text-foreground">{formatMonthLabel(month.month)}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 bg-accent rounded-full"
                              style={{ width: `${maxIssues > 0 ? (month.issues / maxIssues) * 100 : 0}px` }}
                            />
                            <span className="font-semibold text-accent">{month.issues}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div
                onClick={() => setExpandedCard(expandedCard === "overdueBooks" ? null : "overdueBooks")}
                className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow cursor-pointer"
              >
                <PieChart className="h-5 w-5 text-destructive mb-2" />
                <p className="text-2xl font-semibold text-foreground">{summary.overdueBooks}</p>
                <p className="text-muted-foreground text-xs">Overdue Books</p>
              </div>

              {expandedCard === "overdueBooks" && (
                <div className="mt-3 bg-card rounded-xl p-5 shadow-card border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Overdue Details</h3>
                  <p className="text-sm text-muted-foreground">
                    This count reflects the current overdue issue records in the library system.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border p-5">
            <h2 className="font-semibold text-lg text-foreground mb-4">Monthly Book Issues</h2>
            <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E87722" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#E87722" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction, index) => (
                <g key={index}>
                  <line
                    x1={padX}
                    y1={padY + plotH * (1 - fraction)}
                    x2={padX + plotW}
                    y2={padY + plotH * (1 - fraction)}
                    stroke="hsl(25 25% 88%)"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padX - 8}
                    y={padY + plotH * (1 - fraction) + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="hsl(15 5% 40%)"
                  >
                    {Math.round(maxIssues * fraction)}
                  </text>
                </g>
              ))}
              {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#E87722"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {points.map((point, index) => (
                <g key={monthlyIssues[index].month}>
                  <circle cx={point.x} cy={point.y} r="4" fill="#E87722" stroke="white" strokeWidth="2" />
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="hsl(0 0% 10%)"
                  >
                    {monthlyIssues[index].issues}
                  </text>
                  <text
                    x={point.x}
                    y={padY + plotH + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="hsl(15 5% 40%)"
                  >
                    {formatMonthLabel(monthlyIssues[index].month)}
                  </text>
                </g>
              ))}
            </svg>
            {monthlyIssues.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">No issue data available yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
