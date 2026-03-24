import { useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { BookOpen, GraduationCap, RotateCcw } from "lucide-react";
import campusImage from "@/assets/campus.jpeg";
import { supabase } from "@/lib/supabase";

export default function VerifyOTPPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState(["", "", "", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next box
    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    // Focus last filled box
    const lastIndex = Math.min(pasted.length, 7);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = otp.join("");
    if (token.length < 8) {
      setError("Please enter the complete 8-digit OTP.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setLoading(false);

    if (verifyError) {
      if (verifyError.message.toLowerCase().includes("expired")) {
        setError("OTP has expired. Please request a new one.");
      } else if (verifyError.message.toLowerCase().includes("invalid")) {
        setError("Invalid OTP. Please check and try again.");
      } else {
        setError(verifyError.message);
      }
      return;
    }

    navigate("/dashboard");
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");
    setResending(true);
    const { error: resendError } = await supabase.auth.resend({ email, type: "signup" });
    setResending(false);

    if (resendError) {
      setError(resendError.message);
    } else {
      setSuccess("A new OTP has been sent to your email.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
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
            Verify your email to complete your GCU Library account setup.
          </p>
        </div>
      </div>

      {/* Right – OTP Form */}
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
              <h1 className="text-2xl font-semibold text-foreground">Verify Your Email</h1>
              <p className="text-muted-foreground text-sm">Enter the 8-digit OTP sent to your email</p>
            </div>
          </div>

          {/* Email display */}
          <div className="mt-6 p-3 rounded-lg bg-muted border border-border text-center">
            <p className="text-sm text-muted-foreground">OTP sent to:</p>
            <p className="font-medium text-foreground text-sm break-all">{email}</p>
          </div>

          <form onSubmit={handleVerify} className="mt-8 space-y-6">
            {/* OTP Boxes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-4 text-center">
                Enter Verification Code
              </label>
              <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 border-border bg-card text-foreground focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/30 transition"
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {success && <p className="text-green-600 text-sm text-center">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {resending ? "Sending..." : "Resend OTP"}
            </button>
            <p className="text-sm text-muted-foreground">
              Wrong email?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Go back
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
