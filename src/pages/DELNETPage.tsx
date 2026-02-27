import { useState } from "react";
import { Search, Globe, ExternalLink, Clock, CheckCircle, Send, Library } from "lucide-react";

interface ILLRequest {
  id: string;
  title: string;
  author: string;
  sourceLibrary: string;
  requestDate: string;
  status: "pending" | "approved" | "in_transit" | "delivered" | "rejected";
}

const mockILLRequests: ILLRequest[] = [
  { id: "ILL1", title: "Advanced Quantum Mechanics", author: "J.J. Sakurai", sourceLibrary: "IISc Bangalore", requestDate: "2026-02-20", status: "in_transit" },
  { id: "ILL2", title: "Molecular Biology of the Cell", author: "Bruce Alberts", sourceLibrary: "Delhi University", requestDate: "2026-02-18", status: "approved" },
  { id: "ILL3", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", sourceLibrary: "JNU Library", requestDate: "2026-02-10", status: "delivered" },
  { id: "ILL4", title: "Principles of Compiler Design", author: "Alfred Aho", sourceLibrary: "Anna University", requestDate: "2026-02-22", status: "pending" },
];

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-secondary/10 text-secondary",
  in_transit: "bg-accent/20 text-accent-foreground",
  delivered: "bg-accent/20 text-accent-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export default function DELNETPage() {
  const [search, setSearch] = useState("");
  const [requests] = useState<ILLRequest[]>(mockILLRequests);
  const [newRequest, setNewRequest] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", sourceLibrary: "" });

  const filteredRequests = requests.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.sourceLibrary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="h-6 w-6 text-secondary" />
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">DELNET</h1>
        </div>
        <p className="text-muted-foreground mt-1">Developing Library Network — Inter-Library Loan & Resource Sharing</p>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border text-center">
          <Library className="h-6 w-6 text-secondary mx-auto mb-2" />
          <p className="font-serif font-bold text-foreground text-lg">6,500+</p>
          <p className="text-muted-foreground text-xs">Member Libraries</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border text-center">
          <Send className="h-6 w-6 text-accent mx-auto mb-2" />
          <p className="font-serif font-bold text-foreground text-lg">{requests.filter(r => r.status === "pending").length}</p>
          <p className="text-muted-foreground text-xs">Pending Requests</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border text-center">
          <CheckCircle className="h-6 w-6 text-secondary mx-auto mb-2" />
          <p className="font-serif font-bold text-foreground text-lg">{requests.filter(r => r.status === "delivered").length}</p>
          <p className="text-muted-foreground text-xs">Delivered</p>
        </div>
      </div>

      {/* Search & New Request */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search external library catalogs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
        </div>
        <button onClick={() => setNewRequest(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
          <Send className="h-4 w-4" /> New ILL Request
        </button>
      </div>

      {/* Request Tracking */}
      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-serif font-bold text-lg text-foreground">Inter-Library Loan Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-muted-foreground font-medium">Book Title</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Author</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Source Library</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Date</th>
                <th className="px-5 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{r.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.author}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {r.sourceLibrary}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.requestDate}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[r.status]}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New ILL Request Modal */}
      {newRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setNewRequest(false)} />
          <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif font-bold text-xl text-foreground">New Inter-Library Loan Request</h2>
              <button onClick={() => setNewRequest(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Book Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter the book title"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Author</label>
                <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                  placeholder="Author name"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Preferred Source Library</label>
                <select value={form.sourceLibrary} onChange={e => setForm({ ...form, sourceLibrary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50">
                  <option value="">Select library</option>
                  <option value="IISc Bangalore">IISc Bangalore</option>
                  <option value="Delhi University">Delhi University</option>
                  <option value="JNU Library">JNU Library</option>
                  <option value="Anna University">Anna University</option>
                  <option value="Mumbai University">Mumbai University</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setNewRequest(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => setNewRequest(false)} className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
