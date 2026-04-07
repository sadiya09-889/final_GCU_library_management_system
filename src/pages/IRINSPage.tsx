import { Award, ExternalLink } from "lucide-react";

export default function IRINSPage() {
  const openIrins = () => {
    window.open("https://gardencity.irins.org/", "_blank");
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Award className="h-6 w-6 text-secondary" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">IRINS</h1>
        </div>
        <p className="text-muted-foreground mt-1">Indian Research Information Network System — Faculty Research Profiles</p>
      </div>

      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-center max-w-md">
          <Award className="h-16 w-16 text-secondary mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-3">Access IRINS</h2>
          <p className="text-muted-foreground mb-6">View faculty research profiles and publication records on the IRINS portal</p>
          <button 
            onClick={openIrins}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity">
            <ExternalLink className="h-4 w-4" />
            Open IRINS Portal
          </button>
        </div>
      </div>
    </div>
  );
}
