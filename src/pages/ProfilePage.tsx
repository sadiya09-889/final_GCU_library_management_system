import { useState, useEffect } from "react";
import { User, Mail, Shield, Calendar, Building2, Phone, Edit2, Save, X, Hash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fetchProfile, updateProfile } from "@/lib/supabaseService";
import { profileUpdateSchema, type UserProfile, type ProfileUpdateData } from "@/lib/types";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

function getMetadataValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getProfileRole(value: unknown): UserProfile["role"] {
  if (value === "admin" || value === "librarian" || value === "student") {
    return value;
  }
  return "student";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    department: "",
    contact_number: "",
    reg_no: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProfile();

    // Set up real-time subscription for profile changes
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscription = supabase
          .channel('profile_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`
            },
            (payload) => {
              // Update profile data if changed externally
              const updatedProfile = payload.new as UserProfile;
              setProfile(updatedProfile);
              setFormData((prev) => ({
                department: updatedProfile.department || "",
                contact_number: updatedProfile.contact_number || prev.contact_number,
                reg_no: updatedProfile.reg_no || prev.reg_no,
              }));
              // Only show toast if user is not currently editing (to avoid conflicts)
              if (!editing) {
                toast.info("Profile updated");
              }
            }
          )
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      }
    };

    const cleanup = setupRealtimeSubscription();
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [editing]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadataName =
          getMetadataValue(user.user_metadata?.name) ||
          getMetadataValue(user.user_metadata?.full_name) ||
          getMetadataValue(user.email?.split("@")[0]) ||
          "User";

        const metadataEmail = getMetadataValue(user.email);
        const metadataRole = getProfileRole(user.user_metadata?.role);
        const metadataContact = getMetadataValue(user.user_metadata?.contact_number);
        const metadataRegNo = getMetadataValue(user.user_metadata?.reg_no);
        const fallbackJoinDate = user.created_at
          ? new Date(user.created_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        const userProfile = await fetchProfile(user.id);
        if (userProfile) {
          const mergedProfile: UserProfile = {
            ...userProfile,
            name: getMetadataValue(userProfile.name) || metadataName,
            email: getMetadataValue(userProfile.email) || metadataEmail,
            role: getProfileRole(userProfile.role || metadataRole),
            contact_number: userProfile.contact_number || metadataContact,
            reg_no: userProfile.reg_no || metadataRegNo,
            join_date: userProfile.join_date || fallbackJoinDate,
          };

          setProfile(mergedProfile);
          setFormData({
            department: mergedProfile.department || "",
            contact_number: mergedProfile.contact_number || "",
            reg_no: mergedProfile.reg_no || "",
          });
        } else {
          // If no profile exists in database, create a fallback from auth data
          const role = metadataRole;
          const fallbackProfile: UserProfile = {
            id: user.id,
            name: metadataName,
            email: metadataEmail,
            role,
            department: role === "admin" ? "Administration" : role === "librarian" ? "Library" : "",
            contact_number: metadataContact,
            reg_no: metadataRegNo,
            join_date: fallbackJoinDate,
          };
          setProfile(fallbackProfile);
          setFormData({
            department: fallbackProfile.department || "",
            contact_number: fallbackProfile.contact_number || "",
            reg_no: fallbackProfile.reg_no || "",
          });
        }
      }
    } catch (error) {
      toast.error("Failed to load profile");
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setErrors({});
  };

  const handleCancel = () => {
    setEditing(false);
    setErrors({});
    // Reset form data to original values
    if (profile) {
      setFormData({
        department: profile.department || "",
        contact_number: profile.contact_number || "",
        reg_no: profile.reg_no || "",
      });
    }
  };

  const handleSave = async () => {
    try {
      // Validate the form data
      const validation = profileUpdateSchema.safeParse(formData);
      if (!validation.success) {
        const validationErrors: Record<string, string> = {};
        validation.error.errors.forEach(err => {
          if (err.path[0]) {
            validationErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(validationErrors);
        return;
      }

      if (!profile) return;

      setSaving(true);
      const updatedProfile = await updateProfile(profile.id, formData);
      setProfile(updatedProfile);
      setEditing(false);
      setErrors({});
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(getErrorMessage(error, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProfileUpdateData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  if (loading || !profile) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-1">Your account information</p>
        </div>
        <div className="bg-card rounded-xl shadow-card border border-border p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-16 w-16 rounded-full bg-secondary/20"></div>
            <div className="h-4 bg-secondary/20 rounded w-3/4"></div>
            <div className="h-4 bg-secondary/20 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Your account information</p>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center text-secondary-foreground font-bold text-xl">
            {profile.name?.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-xl text-foreground">{profile.name}</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary capitalize mt-1">
              <Shield className="h-3 w-3" /> {profile.role}
            </span>
          </div>
          {!editing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Read-only fields */}
          {[
            { icon: Mail, label: "Email", value: profile.email },
            { icon: User, label: "Full Name", value: profile.name },
            { icon: Shield, label: "Role", value: profile.role },
            { icon: Calendar, label: "Member Since", value: new Date(profile.join_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })},
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 py-3 border-b border-border">
              <item.icon className="h-5 w-5 text-secondary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-foreground capitalize">{item.value}</p>
              </div>
            </div>
          ))}

          {/* Editable department field */}
          <div className="flex items-center gap-3 py-3 border-b border-border">
            <Building2 className="h-5 w-5 text-secondary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Department</p>
              {editing ? (
                <div>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleInputChange("department", e.target.value)}
                    className="text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 mt-1 w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Enter department"
                  />
                  {errors.department && (
                    <p className="text-xs text-destructive mt-1">{errors.department}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground capitalize">
                  {formData.department || "Not specified"}
                </p>
              )}
            </div>
          </div>

          {/* Editable contact number field */}
          <div className="flex items-center gap-3 py-3 border-b border-border">
            <Hash className="h-5 w-5 text-secondary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Reg No</p>
              {editing ? (
                <div>
                  <input
                    type="text"
                    value={formData.reg_no}
                    onChange={(e) => handleInputChange("reg_no", e.target.value)}
                    className="text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 mt-1 w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Enter registration number"
                  />
                  {errors.reg_no && (
                    <p className="text-xs text-destructive mt-1">{errors.reg_no}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {formData.reg_no || "Not specified"}
                </p>
              )}
            </div>
          </div>

          {/* Editable contact number field */}
          <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <Phone className="h-5 w-5 text-secondary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Contact Number</p>
              {editing ? (
                <div>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => handleInputChange("contact_number", e.target.value)}
                    className="text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 mt-1 w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Enter contact number"
                  />
                  {errors.contact_number && (
                    <p className="text-xs text-destructive mt-1">{errors.contact_number}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {formData.contact_number || "Not specified"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Edit mode action buttons */}
        {editing && (
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
