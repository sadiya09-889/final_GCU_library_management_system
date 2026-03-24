/**
 * create-admin.mjs
 * Creates demo users (admin, librarian, student) via Supabase Admin REST API.
 *
 * Usage:
 *   node scripts/create-admin.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>
 *
 * Get SERVICE_ROLE_KEY from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 */

const [, , SUPABASE_URL, SERVICE_ROLE_KEY] = process.argv;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Usage: node scripts/create-admin.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>");
  process.exit(1);
}

const USERS = [
  { email: "admin@gcu.edu.in",     password: "admin123", name: "Admin",     role: "admin" },
  { email: "librarian@gcu.edu.in", password: "lib123",   name: "Librarian", role: "librarian" },
  { email: "student@gcu.edu.in",   password: "stu123",   name: "Student",   role: "student" },
];

const headers = {
  "Content-Type": "application/json",
  "apikey": SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
};

async function createUser(user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.msg || data.message || JSON.stringify(data);
    if (msg.toLowerCase().includes("already")) {
      console.log(`⚠️  ${user.email} already exists — skipping.`);
      return null;
    }
    throw new Error(msg);
  }
  console.log(`✅  Created: ${user.email}  (${user.role})`);
  return data.id;
}

async function updateProfile(userId, user) {
  await new Promise(r => setTimeout(r, 800)); // wait for trigger to fire
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ role: user.role, name: user.name }),
  });
  if (res.ok) {
    console.log(`   🔧 Role set to '${user.role}'`);
  } else {
    console.warn(`   ⚠️  Could not update profile: ${await res.text()}`);
  }
}

async function main() {
  console.log("\n🚀  GCU Library — Supabase User Setup\n");
  for (const user of USERS) {
    try {
      const id = await createUser(user);
      if (id) await updateProfile(id, user);
    } catch (err) {
      console.error(`❌  Failed for ${user.email}:`, err.message);
    }
    console.log();
  }
  console.log("✔️  Done! Login credentials:");
  console.log("   admin@gcu.edu.in      / admin123");
  console.log("   librarian@gcu.edu.in  / lib123");
  console.log("   student@gcu.edu.in    / stu123\n");
}

main();
