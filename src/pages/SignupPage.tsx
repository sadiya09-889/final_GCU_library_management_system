import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BookOpen, Eye, EyeOff, GraduationCap, ChevronLeft, Briefcase } from "lucide-react";
import campusImage from "@/assets/campus.jpeg";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [accountType, setAccountType] = useState<"student" | "faculty">("student");
  const [stage, setStage] = useState<"role-selection" | "form">("role-selection");
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const trimmedName = name.trim();
    const trimmedRegNo = regNo.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }

    if (accountType === "student") {
      if (!trimmedRegNo) {
        setError("Reg No is required for student accounts.");
        return;
      }

      if (!/^[A-Za-z0-9/-]+$/.test(trimmedRegNo)) {
        setError("Reg No can contain letters, numbers, - and / only.");
        return;
      }
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const emailRedirectTo = accountType === "faculty"
      ? `${window.location.origin}/auth/callback`
      : `${window.location.origin}/verify-otp?email=${encodeURIComponent(normalizedEmail)}`;
    const { data: signupData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          name: trimmedName,
          role: accountType,
          reg_no: accountType === "student" ? trimmedRegNo : "",
          school: "",
          department: "",
          contact_number: "",
        },
      },
    });
    setLoading(false);

    if (authError) {
      const message = authError.message.toLowerCase();

      if (message.includes("already registered")) {
        setError("This email is already registered. Please go to the Sign In page to log in.");
      } else if (message.includes("database error saving new user")) {
        setError("Account creation failed while saving the profile. Please try again in a moment.");
      } else {
        setError(authError.message);
      }
      return;
    }

    if (signupData.session) {
      navigate("/dashboard", { replace: true });
      return;
    }

    navigate(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left – Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={campusImage} alt="Garden City University Campus" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 gradient-hero opacity-70" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-8 w-8 text-secondary" />
            <span className="font-semibold text-2xl text-primary-foreground">Garden City University</span>
          </div>
          <p className="text-primary-foreground/70 text-lg font-light max-w-md">
            Create your account to access the GCU Library Management System.
          </p>
        </div>
      </div>

      {/* Right – Form or Role Selection */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="font-semibold text-xl text-primary">Garden City University</span>
          </div>

          {stage === "role-selection" ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg gradient-warm flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Join GCU Library</h1>
                  <p className="text-muted-foreground text-sm">Select your account type to get started</p>
                </div>
              </div>

              <div className="space-y-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("student");
                    setStage("form");
                    setError("");
                  }}
                  className="w-full p-5 text-left border-2 border-border hover:border-secondary rounded-xl bg-card transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center group-hover:bg-secondary/20 transition-colors flex-shrink-0">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-foreground group-hover:text-secondary transition-colors">GCU Student</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Register with your GCU student ID/Register Number to access student library services.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountType("faculty");
                    setStage("form");
                    setError("");
                  }}
                  className="w-full p-5 text-left border-2 border-border hover:border-secondary rounded-xl bg-card transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-foreground group-hover:text-secondary transition-colors">GCU Faculty</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Register as a GCU faculty member. Personal or GCU domains allowed. No Register Number needed.
                    </p>
                  </div>
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-6">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          ) : (
            <div>
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setStage("role-selection")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back to selection
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg gradient-warm flex items-center justify-center">
                  {accountType === "student" ? (
                    <GraduationCap className="h-5 w-5 text-secondary-foreground" />
                  ) : (
                    <Briefcase className="h-5 w-5 text-secondary-foreground" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {accountType === "student" ? "Student Signup" : "Faculty Signup"}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {accountType === "student"
                      ? "Create account using your student register number"
                      : "Create account with your designation"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSignup} className="mt-8 space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition"
                  />
                </div>

                {/* Reg No (Student Only) */}
                {accountType === "student" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Reg No</label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={e => setRegNo(e.target.value)}
                      required
                      maxLength={30}
                      placeholder="e.g. 23BTRE101"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition"
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder={accountType === "faculty" ? "faculty@example.com" : "student@gcu.edu.in"}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accountType === "faculty"
                      ? "Faculty accounts can use any active email address."
                      : "Student accounts are identified by Reg No and email."}
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}
                {notice && <p className="text-sm text-green-600">{notice}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Creating Account..."
                    : `Create ${accountType === "faculty" ? "Faculty" : "Student"} Account`}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
