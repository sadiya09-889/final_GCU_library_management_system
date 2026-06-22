import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

export type AppRole = UserProfile["role"];

function getText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "librarian" || value === "student" || value === "faculty" || value === "pending";
}

export function inferUserRole(identity: {
  currentRole?: unknown;
  requestedRole?: unknown;
  email?: unknown;
  regNo?: unknown;
  profileRole?: unknown;
  appMetadataRole?: unknown;
}): AppRole {
  // 1. Privileged role checks: admin/librarian must never be downgraded
  const pRole = getText(identity.profileRole);
  if (pRole === "admin" || pRole === "librarian") {
    return pRole;
  }

  const appRole = getText(identity.appMetadataRole);
  if (appRole === "admin" || appRole === "librarian") {
    return appRole;
  }

  const cRole = getText(identity.currentRole);
  if (cRole === "admin" || cRole === "librarian") {
    return cRole;
  }

  // 2. Member logic
  // If reg_no exists and is non-empty, the role must always be student
  if (getText(identity.regNo)) {
    return "student";
  }

  // Trusted non-privileged current role (faculty/student/pending) => use it.
  if (isAppRole(identity.currentRole)) {
    return identity.currentRole;
  }

  // If requestedRole is admin/librarian (privileged), reject it
  const requested = getText(identity.requestedRole);
  if (requested === "admin" || requested === "librarian") {
    return "pending";
  }

  if (requested === "faculty") {
    return "faculty";
  }

  if (requested === "student") {
    return "pending"; // requested student with no regNo => pending
  }

  return "pending"; // missing role/no regNo => pending
}

function getTrustedAppRole(authUser: User): AppRole | undefined {
  const appRole = authUser.app_metadata?.library_role ?? authUser.app_metadata?.role;
  return isAppRole(appRole) ? appRole : undefined;
}

function getRequestedMemberRole(authUser: User): "student" | "faculty" | undefined {
  const requestedRole = authUser.user_metadata?.role;
  return requestedRole === "student" || requestedRole === "faculty" ? requestedRole : undefined;
}

export async function resolveCurrentUserContext(sessionUser?: User | null) {
  const authUser = sessionUser ?? (await supabase.auth.getUser()).data.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  const name =
    getText(profile?.name) ||
    getText(authUser.user_metadata?.name) ||
    getText(authUser.user_metadata?.full_name) ||
    getText(authUser.email?.split("@")[0]) ||
    "User";

  const email = (getText(authUser.email) || getText(profile?.email)).toLowerCase();
  const regNo = getText(profile?.reg_no) || getText(authUser.user_metadata?.reg_no);
  const school = getText(profile?.school) || getText(authUser.user_metadata?.school);
  const department = getText(profile?.department) || getText(authUser.user_metadata?.department);
  
  const profileRole = profile?.role;
  const appMetadataRole = getTrustedAppRole(authUser);
  const currentRole = isAppRole(profileRole) ? profileRole : appMetadataRole;
  const requestedRole = getRequestedMemberRole(authUser);
  const role = inferUserRole({
    currentRole,
    requestedRole,
    email,
    regNo,
    profileRole,
    appMetadataRole,
  });

  return {
    user: authUser,
    profile: (profile as UserProfile | null) ?? null,
    name,
    email,
    regNo,
    school,
    department,
    role,
  };
}

export async function syncCurrentUserContext(sessionUser?: User | null) {
  const resolved = await resolveCurrentUserContext(sessionUser);
  if (!resolved) return null;

  const { user, profile, name, email, regNo, school, department, role } = resolved;

  const isPrivileged = profile?.role === "admin" || profile?.role === "librarian";

  const profilePayload: Record<string, any> = {
    id: user.id,
    name,
    email,
    reg_no: regNo || null,
    school: school || null,
    department: department || null,
  };

  // If the profile role is already admin/librarian, we do NOT overwrite it from the client.
  if (!isPrivileged) {
    profilePayload.role = role;
  }

  if (!profile) {
    // If no profile exists, create it (role can be admin/librarian if trusted app metadata says so)
    profilePayload.role = role;
    try {
      await supabase
        .from("profiles")
        .insert(profilePayload);
    } catch {
      // The database trigger normally creates this row. If insert is blocked, continue with the resolved in-memory role.
    }
  } else {
    const hasNameChanged = getText(profile.name) !== name;
    const hasEmailChanged = getText(profile.email).toLowerCase() !== email;
    const hasRegNoChanged = getText(profile.reg_no) !== regNo;
    const hasSchoolChanged = getText(profile.school) !== school;
    const hasDeptChanged = getText(profile.department) !== department;
    const hasRoleChanged = !isPrivileged && profile.role !== role;

    if (
      hasNameChanged ||
      hasEmailChanged ||
      hasRegNoChanged ||
      hasSchoolChanged ||
      hasDeptChanged ||
      hasRoleChanged
    ) {
      try {
        await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("id", user.id);
      } catch {
        // Keep the resolved role available in the client even if the DB migration is not applied yet.
      }
    }
  }

  const metadataName = getText(user.user_metadata?.name);
  const metadataRole = getText(user.user_metadata?.role);
  const metadataRegNo = getText(user.user_metadata?.reg_no);
  const metadataSchool = getText(user.user_metadata?.school);
  const metadataDepartment = getText(user.user_metadata?.department);

  const finalMetadataRole = isPrivileged ? profile.role : role;

  if (
    metadataName !== name ||
    metadataRole !== finalMetadataRole ||
    metadataRegNo !== regNo ||
    metadataSchool !== school ||
    metadataDepartment !== department
  ) {
    try {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          name,
          role: finalMetadataRole,
          reg_no: regNo || "",
          school: school || "",
          department: department || "",
        },
      });
    } catch {
      // Ignore metadata sync failures and continue with the resolved in-memory role.
    }
  }

  return resolved;
}
