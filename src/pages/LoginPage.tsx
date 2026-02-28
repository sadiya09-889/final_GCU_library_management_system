import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff, GraduationCap } from "lucide-react";
import campusImage from "@/assets/campus.jpeg";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      if (authError.message === "Failed to fetch" || authError.message.includes("fetch")) {
        setError("Cannot connect to the server. Please check your internet connection or try again later.");
      } else if (authError.message.toLowerCase().includes("invalid")) {
        setError("Invalid email or password.");
      } else {
        setError(authError.message);
      }
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={campusImage} alt="Garden City University Campus" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 gradient-hero opacity-70" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-8 w-8 text-secondary" />
            <span className="font-semibold text-2xl text-primary-foreground">Garden City University</span>
          </div>
          <p className="text-primary-foreground/70 text-lg font-light max-w-md">
            Access the library management system to explore, issue, and manage books across our extensive collection.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="font-semibold text-xl text-primary">Garden City University</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg gradient-warm flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Library Portal</h1>
              <p className="text-muted-foreground text-sm">Sign in to continue</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="admin@gcu.edu.in"
                className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition pr-12" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Admin:</span> admin@gcu.edu.in / admin123</p>
              <p><span className="font-medium text-foreground">Librarian:</span> librarian@gcu.edu.in / lib123</p>
              <p><span className="font-medium text-foreground">Student:</span> student@gcu.edu.in / stu123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
