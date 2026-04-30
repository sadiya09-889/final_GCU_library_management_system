import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Building2, Check, GraduationCap, Library, Loader2 } from "lucide-react";
import campusImage from "@/assets/campus.jpeg";
import { supabase } from "@/lib/supabase";
import { syncCurrentUserContext } from "@/lib/accountRole";
import { fetchAcademicProgrammes, updateStudentAcademicProfile } from "@/lib/supabaseService";
import { ACADEMIC_PROGRAMMES, getSchoolDisplayName, groupProgrammesBySchool } from "@/lib/academicProgrammes";
import type { AcademicProgramme } from "@/lib/types";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

export default function AcademicProfilePage() {
  const [programmes, setProgrammes] = useState<AcademicProgramme[]>(ACADEMIC_PROGRAMMES);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function loadProgrammes() {
      try {
        const result = await fetchAcademicProgrammes();
        if (isMounted) {
          setProgrammes(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load school options from Supabase."));
        }
      } finally {
        if (isMounted) {
          setLoadingOptions(false);
        }
      }
    }

    void loadProgrammes();

    return () => {
      isMounted = false;
    };
  }, []);

  const schoolGroups = useMemo(() => groupProgrammesBySchool(programmes), [programmes]);
  const schools = useMemo(() => Array.from(schoolGroups.entries()), [schoolGroups]);
  const selectedProgrammes = selectedSchool ? schoolGroups.get(selectedSchool) ?? [] : [];

  const handleSchoolSelect = (school: string) => {
    setSelectedSchool(school);
    setSelectedDepartment("");
    setError("");
  };

  const saveAcademicProfile = async (school: string, department: string) => {
    setError("");

    if (!school || !department) {
      setError("Select your school and department to continue.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      await updateStudentAcademicProfile(user.id, {
        school,
        department,
      });

      const resolved = await syncCurrentUserContext();
      const existingUser = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");
      const userData = {
        ...existingUser,
        id: user.id,
        name: resolved?.name || user.user_metadata?.name || user.email || "User",
        role: resolved?.role || user.user_metadata?.role || "student",
        email: resolved?.email || user.email || "",
        school,
        department,
      };

      sessionStorage.setItem("gcu_user", JSON.stringify(userData));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save academic details."));
    } finally {
      setSaving(false);
    }
  };

  const handleDepartmentSelect = (department: string) => {
    setSelectedDepartment(department);
    void saveAcademicProfile(selectedSchool, department);
  };

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
            Choose your academic area so the library can show books from your programme.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-screen bg-background p-6 sm:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="font-semibold text-xl text-primary">Garden City University</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg gradient-warm flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Academic Details</h1>
                  <p className="text-muted-foreground text-sm">Select your school, then choose your department</p>
                </div>
              </div>
            </div>

            {selectedSchool && (
              <button
                type="button"
                onClick={() => handleSchoolSelect("")}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Schools
              </button>
            )}
          </div>

          {loadingOptions && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-secondary" />
              Loading programme list...
            </div>
          )}

          {!selectedSchool ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {schools.map(([school]) => {
                const isGeneralReference = school === "General Reference";
                const Icon = isGeneralReference ? Library : Building2;

                return (
                  <button
                    key={school}
                    type="button"
                    onClick={() => handleSchoolSelect(school)}
                    className="rounded-lg border border-border bg-card p-5 text-left shadow-card transition hover:border-secondary hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-secondary/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground leading-tight">{getSchoolDisplayName(school)}</h2>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="mb-5 rounded-lg border border-border bg-card p-4 shadow-card">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected school</p>
                <p className="mt-1 font-semibold text-foreground">{getSchoolDisplayName(selectedSchool)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedProgrammes.map((programme) => {
                  const selected = selectedDepartment === programme.department;

                  return (
                    <button
                      key={programme.sheet_name}
                      type="button"
                      onClick={() => handleDepartmentSelect(programme.department)}
                      disabled={saving}
                      className={`rounded-lg border bg-card p-5 text-left shadow-card transition focus:outline-none focus:ring-2 focus:ring-secondary/40 ${
                        selected ? "border-secondary" : "border-border hover:border-secondary hover:shadow-elevated"
                      } disabled:cursor-wait disabled:opacity-75`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-semibold text-foreground leading-tight">{programme.department}</h2>
                        </div>
                        <span className={`h-6 w-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          selected ? "border-secondary bg-secondary text-secondary-foreground" : "border-border text-transparent"
                        }`}>
                          <Check className="h-4 w-4" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="mt-5 text-sm text-destructive">{error}</p>}

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {saving ? "Saving your academic details..." : "Your selection is saved to your library profile."}
            </p>
            <button
              type="button"
              onClick={() => void saveAcademicProfile(selectedSchool, selectedDepartment)}
              disabled={!selectedSchool || !selectedDepartment || saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
