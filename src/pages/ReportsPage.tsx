import { BarChart3, Download, FileText, PieChart, TrendingUp } from "lucide-react";

// Mock summary data
const summaryData = {
  totalCollection: 120,
  currentlyIssued: 34,
  overdueBooks: 6,
};

// Mock monthly issues data
const monthlyIssues = [
  { month: "Sep", issues: 18 },
  { month: "Oct", issues: 25 },
  { month: "Nov", issues: 22 },
  { month: "Dec", issues: 30 },
  { month: "Jan", issues: 41 },
  { month: "Feb", issues: 38 },
];

// Mock category data
const categoryData = [
  { category: "Computer Science", count: 40, color: "#E87722" },
  { category: "Mechanical Engineering", count: 28, color: "#D4553A" },
  { category: "Mathematics", count: 22, color: "#B8336A" },
  { category: "Management", count: 18, color: "#6B2D5B" },
  { category: "Physics", count: 12, color: "#3D1F3D" },
];

const maxIssues = Math.max(...monthlyIssues.map(d => d.issues));
const totalCategoryBooks = categoryData.reduce((a, b) => a + b.count, 0);

// SVG Area Chart helpers
const chartW = 500;
const chartH = 200;
const padX = 40;
const padY = 20;
const plotW = chartW - padX * 2;
const plotH = chartH - padY * 2;

function getPoint(i: number, val: number) {
  const x = padX + (i / (monthlyIssues.length - 1)) * plotW;
  const y = padY + plotH - (val / maxIssues) * plotH;
  return { x, y };
}

// Generate smooth curve path using cardinal spline
function getLinePath() {
  const points = monthlyIssues.map((d, i) => getPoint(i, d.issues));
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
    const cp1y = points[i].y;
    const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
    const cp2y = points[i + 1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return path;
}

function getAreaPath() {
  const linePath = getLinePath();
  const lastPoint = getPoint(monthlyIssues.length - 1, monthlyIssues[monthlyIssues.length - 1].issues);
  const firstPoint = getPoint(0, monthlyIssues[0].issues);
  return `${linePath} L ${lastPoint.x} ${padY + plotH} L ${firstPoint.x} ${padY + plotH} Z`;
}

// Donut chart helpers
function getDonutSlices() {
  const radius = 80;
  const innerRadius = 50;
  const cx = 100;
  const cy = 100;
  let startAngle = -90;
  return categoryData.map(d => {
    const angle = (d.count / totalCategoryBooks) * 360;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const ix1 = cx + innerRadius * Math.cos(startRad);
    const iy1 = cy + innerRadius * Math.sin(startRad);
    const ix2 = cx + innerRadius * Math.cos(endRad);
    const iy2 = cy + innerRadius * Math.sin(endRad);
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    startAngle = endAngle;
    return { ...d, path };
  });
}

export default function ReportsPage() {
  const linePath = getLinePath();
  const areaPath = getAreaPath();
  const points = monthlyIssues.map((d, i) => getPoint(i, d.issues));
  const donutSlices = getDonutSlices();

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <BarChart3 className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{summaryData.totalCollection}</p>
          <p className="text-muted-foreground text-xs">Total Collection</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <TrendingUp className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{summaryData.currentlyIssued}</p>
          <p className="text-muted-foreground text-xs">Currently Issued</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <PieChart className="h-5 w-5 text-destructive mb-2" />
          <p className="text-2xl font-semibold text-foreground">{summaryData.overdueBooks}</p>
          <p className="text-muted-foreground text-xs">Overdue Books</p>
        </div>
      </div>

      {/* Area/Line Chart */}
      <div className="bg-card rounded-xl shadow-card border border-border p-5 mb-6">
        <h2 className="font-semibold text-lg text-foreground mb-4">Monthly Book Issues</h2>
        <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E87722" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#E87722" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
            <g key={i}>
              <line
                x1={padX} y1={padY + plotH * (1 - frac)} x2={padX + plotW} y2={padY + plotH * (1 - frac)}
                stroke="hsl(25 25% 88%)" strokeWidth="0.5" strokeDasharray="4 4"
              />
              <text x={padX - 8} y={padY + plotH * (1 - frac) + 4} textAnchor="end" fontSize="10" fill="hsl(15 5% 40%)">
                {Math.round(maxIssues * frac)}
              </text>
            </g>
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGrad)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="#E87722" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Data points + labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#E87722" stroke="white" strokeWidth="2" />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(0 0% 10%)">
                {monthlyIssues[i].issues}
              </text>
              <text x={p.x} y={padY + plotH + 16} textAnchor="middle" fontSize="10" fill="hsl(15 5% 40%)">
                {monthlyIssues[i].month}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Donut Chart + Legend */}
      <div className="bg-card rounded-xl shadow-card border border-border p-5">
        <h2 className="font-semibold text-lg text-foreground mb-4">Books by Category</h2>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Donut */}
          <div className="relative flex-shrink-0">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {donutSlices.map((slice, i) => (
                <path
                  key={i}
                  d={slice.path}
                  fill={slice.color}
                  className="transition-opacity hover:opacity-80"
                  style={{ cursor: "pointer" }}
                />
              ))}
              <text x="100" y="95" textAnchor="middle" fontSize="24" fontWeight="700" fill="hsl(0 0% 10%)">
                {totalCategoryBooks}
              </text>
              <text x="100" y="115" textAnchor="middle" fontSize="11" fill="hsl(15 5% 40%)">
                Total Books
              </text>
            </svg>
          </div>
          {/* Legend */}
          <div className="flex-1 space-y-3 w-full">
            {categoryData.map(cat => {
              const pct = Math.round((cat.count / totalCategoryBooks) * 100);
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">{cat.category}</span>
                      <span className="text-muted-foreground">{cat.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
