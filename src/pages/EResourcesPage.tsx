import { useState } from "react";
import { FileText, Newspaper } from "lucide-react";
import MagazinesSection from "@/components/e-resources/MagazinesSection";
import NewspapersSection from "@/components/e-resources/NewspapersSection";

type EResourceTab = "newspapers" | "magazines";

const tabs: Array<{ id: EResourceTab; label: string; icon: typeof Newspaper }> = [
  { id: "newspapers", label: "Newspapers", icon: Newspaper },
  { id: "magazines", label: "Magazines", icon: FileText },
];

export default function EResourcesPage() {
  const [activeTab, setActiveTab] = useState<EResourceTab>("newspapers");

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="h-6 w-6 text-secondary" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">E-Resources</h1>
        </div>
        <p className="text-muted-foreground mt-1">Access latest newspapers and uploaded magazines</p>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1 shadow-card">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "gradient-warm text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "newspapers" ? <NewspapersSection /> : <MagazinesSection />}
    </div>
  );
}
