import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap, Loader2 } from "lucide-react";
import campusImage from "@/assets/campus.jpeg";
import { supabase } from "@/lib/supabase";
import { syncCurrentUserContext } from "@/lib/accountRole";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw new Error("Confirmation link is invalid or expired. Please sign up again.");
        }

        const resolved = await syncCurrentUserContext(session.user);
        if (!active) return;

        if (resolved?.role === "student" && (!resolved.school || !resolved.department)) {
          navigate("/academic-profile", { replace: true });
          return;
        }

        navigate("/dashboard", { replace: true });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error && err.message ? err.message : "Unable to confirm this account.");
      }
    }

    void completeAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={campusImage} alt="Garden City University Campus" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 gradient-hero opacity-70" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-8 w-8 text-secondary" />
            <span className="font-semibold text-2xl text-primary-foreground">Garden City University</span>
          </div>
          <p className="text-primary-foreground/70 text-lg font-light max-w-md">
            Confirming your library account.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-lg gradient-warm flex items-center justify-center">
            {error ? <BookOpen className="h-6 w-6 text-secondary-foreground" /> : <Loader2 className="h-6 w-6 animate-spin text-secondary-foreground" />}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {error ? "Confirmation Failed" : "Confirming Account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "Please wait while we finish setting up your access."}
          </p>
          {error && (
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/signup" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Sign Up Again
              </Link>
              <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-semibold gradient-warm text-secondary-foreground hover:opacity-90">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
