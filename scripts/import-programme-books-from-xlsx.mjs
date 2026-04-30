/**
 * Import GCU programme-wise recommendations into Supabase.
 *
 * Run add_academic_recommendations.sql in Supabase SQL Editor first.
 *
 * Usage:
 *   node scripts/import-programme-books-from-xlsx.mjs "C:\\path\\GCU_Programme_Wise_Books.xlsx" --email "admin@gcu.edu.in" --password "..." --chunk 500
 *
 * Optional:
 *   --dry-run
 *   SUPABASE_IMPORT_EMAIL
 *   SUPABASE_IMPORT_PASSWORD
 *   SUPABASE_IMPORT_CHUNK_SIZE
 */

import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }

  return env;
}

function usage(exitCode = 0) {
  console.log(
    [
      "Usage:",
      "  node scripts/import-programme-books-from-xlsx.mjs \"C:\\\\path\\\\GCU_Programme_Wise_Books.xlsx\" [--email \"admin@gcu.edu.in\"] [--password \"...\"] [--chunk 500] [--dry-run]",
      "",
      "Env overrides:",
      "  SUPABASE_IMPORT_EMAIL",
      "  SUPABASE_IMPORT_PASSWORD",
      "  SUPABASE_IMPORT_CHUNK_SIZE",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function toText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(toText(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const args = {
    file: "",
    email: process.env.SUPABASE_IMPORT_EMAIL || "admin@gcu.edu.in",
    password: process.env.SUPABASE_IMPORT_PASSWORD || "admin123",
    chunk: toInt(process.env.SUPABASE_IMPORT_CHUNK_SIZE, 500),
    dryRun: false,
  };

  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--email") {
      args.email = argv[i + 1] || "";
      i++;
      continue;
    }
    if (arg === "--password") {
      args.password = argv[i + 1] || "";
      i++;
      continue;
    }
    if (arg === "--chunk") {
      args.chunk = toInt(argv[i + 1], args.chunk);
      i++;
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      usage(1);
    }

    positionals.push(arg);
  }

  if (positionals.length > 0) args.file = positionals[0];
  return args;
}

function parseWorkbook(filePath) {
  const wb = xlsx.readFile(filePath);
  const summarySheet = wb.Sheets.Summary;
  if (!summarySheet) throw new Error("Missing Summary sheet");

  const summaryRows = xlsx.utils.sheet_to_json(summarySheet, { header: 1, defval: "" });
  const programmes = [];

  for (let rowIndex = 4; rowIndex < summaryRows.length; rowIndex++) {
    const row = summaryRows[rowIndex];
    const school = toText(row[0]);
    const department = toText(row[1]);
    const sheetName = toText(row[2]);

    if (!school || school.toUpperCase() === "TOTAL") break;
    if (!department || !sheetName) continue;

    programmes.push({
      school,
      department,
      sheet_name: sheetName,
      unique_titles: toInt(row[3]),
      total_copies: toInt(row[4]),
      is_general_reference: school === "General Reference",
    });
  }

  const books = [];
  const skippedRows = [];

  for (const programme of programmes) {
    const ws = wb.Sheets[programme.sheet_name];
    if (!ws) {
      skippedRows.push({ sheet_name: programme.sheet_name, row: 0, error: "Missing programme sheet" });
      continue;
    }

    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
    for (let rowIndex = 4; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const sortOrder = toInt(row[0], rowIndex - 3);
      const title = toText(row[1]);

      if (!title) {
        skippedRows.push({ sheet_name: programme.sheet_name, row: rowIndex + 1, error: "Missing title" });
        continue;
      }

      books.push({
        school: programme.school,
        department: programme.department,
        sheet_name: programme.sheet_name,
        sort_order: sortOrder,
        title,
        author: toText(row[2]),
        isbn: toText(row[3]),
        call_no: toText(row[4]),
        subject: toText(row[5]),
        copies: Math.max(0, toInt(row[6])),
        accession_numbers: toText(row[7]),
      });
    }
  }

  return { programmes, books, skippedRows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) usage(1);
  if (!fs.existsSync(args.file)) {
    console.error(`File not found: ${args.file}`);
    process.exit(1);
  }

  const { programmes, books, skippedRows } = parseWorkbook(args.file);
  console.log(`Programmes parsed: ${programmes.length}`);
  console.log(`Programme books parsed: ${books.length}`);
  if (skippedRows.length > 0) {
    console.warn(`Skipped rows: ${skippedRows.length}`);
  }

  if (args.dryRun) {
    console.log("Dry run complete. No Supabase changes were made.");
    return;
  }

  const env = parseEnvFile(path.resolve(process.cwd(), ".env"));
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase config. Ensure `.env` contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: args.email,
    password: args.password,
  });

  if (authError) {
    console.error(`Supabase auth failed: ${authError.message}`);
    process.exit(1);
  }

  const chunkSize = Math.max(1, Math.min(1000, args.chunk || 500));
  const sheetNames = programmes.map((programme) => programme.sheet_name);

  console.log("Upserting academic programmes...");
  const { error: programmesError } = await supabase
    .from("academic_programmes")
    .upsert(programmes, { onConflict: "sheet_name" });

  if (programmesError) throw programmesError;

  console.log("Replacing existing programme book rows for workbook sheets...");
  const { error: deleteError } = await supabase
    .from("programme_books")
    .delete()
    .in("sheet_name", sheetNames);

  if (deleteError) throw deleteError;

  console.log(`Uploading programme books in chunks of ${chunkSize}...`);
  let inserted = 0;

  for (let start = 0; start < books.length; start += chunkSize) {
    const chunk = books.slice(start, start + chunkSize);
    const { error } = await supabase.from("programme_books").insert(chunk);
    if (error) throw error;

    inserted += chunk.length;
    console.log(`Progress: ${inserted}/${books.length}`);
  }

  const { count: programmeCount } = await supabase
    .from("academic_programmes")
    .select("id", { count: "exact", head: true });

  const { count: bookCount } = await supabase
    .from("programme_books")
    .select("id", { count: "exact", head: true });

  console.log(`Supabase academic_programmes count: ${programmeCount ?? "unknown"}`);
  console.log(`Supabase programme_books count: ${bookCount ?? "unknown"}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
