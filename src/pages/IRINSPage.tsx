import { useState } from "react";
import { Search, FileText, ExternalLink, Award, Users, BarChart3, TrendingUp } from "lucide-react";

interface ResearchProfile {
  id: string;
  name: string;
  department: string;
  publications: number;
  citations: number;
  hIndex: number;
  recentPaper: string;
}

const mockProfiles: ResearchProfile[] = [
  { id: "R1", name: "Dr. Ananya Krishnan", department: "Computer Science", publications: 45, citations: 820, hIndex: 14, recentPaper: "Deep Learning Approaches for Natural Language Understanding" },
  { id: "R2", name: "Dr. Rajesh Iyer", department: "Biotechnology", publications: 62, citations: 1540, hIndex: 22, recentPaper: "CRISPR-based Gene Editing in Agricultural Applications" },
  { id: "R3", name: "Dr. Meera Desai", department: "Economics", publications: 28, citations: 410, hIndex: 11, recentPaper: "Impact of Digital Payments on Rural Indian Economy" },
  { id: "R4", name: "Dr. Suresh Babu", department: "Mechanical Engineering", publications: 38, citations: 650, hIndex: 16, recentPaper: "Sustainable Manufacturing Processes for Industry 5.0" },
  { id: "R5", name: "Dr. Priya Nair", department: "Chemistry", publications: 55, citations: 1200, hIndex: 19, recentPaper: "Novel Catalytic Systems for Green Chemistry Applications" },
];

export default function IRINSPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const departments = ["All", ...new Set(mockProfiles.map(p => p.department))];

  const filtered = mockProfiles.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.recentPaper.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "All" || p.department === deptFilter;
    return matchSearch && matchDept;
  });

  const totalPubs = mockProfiles.reduce((a, p) => a + p.publications, 0);
  const totalCitations = mockProfiles.reduce((a, p) => a + p.citations, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Award className="h-6 w-6 text-secondary" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">IRINS</h1>
        </div>
        <p className="text-muted-foreground mt-1">Indian Research Information Network System — Faculty Research Profiles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Users className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{mockProfiles.length}</p>
          <p className="text-muted-foreground text-xs">Researchers</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <FileText className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{totalPubs}</p>
          <p className="text-muted-foreground text-xs">Publications</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <BarChart3 className="h-5 w-5 text-secondary mb-2" />
          <p className="text-2xl font-semibold text-foreground">{totalCitations.toLocaleString()}</p>
          <p className="text-muted-foreground text-xs">Total Citations</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <TrendingUp className="h-5 w-5 text-accent mb-2" />
          <p className="text-2xl font-semibold text-foreground">{Math.max(...mockProfiles.map(p => p.hIndex))}</p>
          <p className="text-muted-foreground text-xs">Highest h-Index</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search researchers or papers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50">
          {departments.map(d => <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>)}
        </select>
      </div>

      {/* Profiles */}
      <div className="space-y-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full gradient-warm flex items-center justify-center text-secondary-foreground font-bold text-sm flex-shrink-0">
                  {p.name.split(" ").slice(-2).map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-muted-foreground text-sm">{p.department}</p>
                  <p className="text-muted-foreground text-xs mt-2 italic">Latest: "{p.recentPaper}"</p>
                </div>
              </div>
              <div className="flex gap-4 sm:gap-6 text-center flex-shrink-0">
                <div>
                  <p className="text-lg font-semibold text-foreground">{p.publications}</p>
                  <p className="text-muted-foreground text-xs">Papers</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{p.citations}</p>
                  <p className="text-muted-foreground text-xs">Citations</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-secondary">{p.hIndex}</p>
                  <p className="text-muted-foreground text-xs">h-Index</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
