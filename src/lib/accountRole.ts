import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

export type AppRole = UserProfile["role"];

function getText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "librarian" || value === "student" || value === "faculty";
}

export function isFacultyEmail(email: string) {
  return getText(email).toLowerCase().endsWith("@gcu.edu.in");
}

export function inferUserRole(identity: {
  currentRole?: unknown;
  email?: unknown;
  regNo?: unknown;
}): AppRole {
  if (identity.currentRole === "admin" || identity.currentRole === "librarian") {
    return identity.currentRole;
  }

  if (getText(identity.regNo)) {
    return "student";
  }

  if (isFacultyEmail(getText(identity.email))) {
    return "faculty";
  }

  return "student";
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
  const currentRole = isAppRole(profile?.role)
    ? profile.role
    : isAppRole(authUser.user_metadata?.role)
      ? authUser.user_metadata.role
      : undefined;
  const role = inferUserRole({ currentRole, email, regNo });

  return {
    user: authUser,
    profile: (profile as UserProfile | null) ?? null,
    name,
    email,
    regNo,
    role,
  };
}

export async function syncCurrentUserContext(sessionUser?: User | null) {
  const resolved = await resolveCurrentUserContext(sessionUser);
  if (!resolved) return null;

  const { user, profile, name, email, regNo, role } = resolved;

  if (
    profile &&
    (
      getText(profile.name) !== name ||
      getText(profile.email).toLowerCase() !== email ||
      getText(profile.reg_no) !== regNo ||
      profile.role !== role
    )
  ) {
    try {
      await supabase
        .from("profiles")
        .update({
          name,
          email,
          reg_no: regNo || null,
          role,
        })
        .eq("id", user.id);
    } catch {
      // Keep the resolved role available in the client even if the DB migration is not applied yet.
    }
  }

  const metadataName = getText(user.user_metadata?.name);
  const metadataRole = getText(user.user_metadata?.role);
  const metadataRegNo = getText(user.user_metadata?.reg_no);

  if (metadataName !== name || metadataRole !== role || metadataRegNo !== regNo) {
    try {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          name,
          role,
          reg_no: regNo || "",
        },
      });
    } catch {
      // Ignore metadata sync failures and continue with the resolved in-memory role.
    }
  }

  return resolved;
}
