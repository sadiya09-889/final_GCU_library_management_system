/**
 * Import books from a KOHA-style XLSX into Supabase `books`.
 *
 * Uses the project's VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from `.env`,
 * then signs in as an admin/librarian user (required due to RLS policies).
 *
 * Usage:
 *   node scripts/import-books-from-koha-xlsx.mjs "<path-to-xlsx>" --email "<email>" --password "<password>" --chunk 500
 *
 * Optional env vars:
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
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

function usage(exitCode = 0) {
  console.log(
    [
      "Usage:",
      "  node scripts/import-books-from-koha-xlsx.mjs \"C:\\\\path\\\\file.xlsx\" [--email \"admin@gcu.edu.in\"] [--password \"...\"] [--chunk 500] [--limit 100]",
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
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(toText(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(toText(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateOnly(value) {
  const s = toText(value);
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd-MMM-yyyy (e.g. 05-May-1994)
  const monthNameMatch = s.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);
  if (monthNameMatch) {
    const day = Number.parseInt(monthNameMatch[1], 10);
    const monthName = monthNameMatch[2].toLowerCase();
    const year = Number.parseInt(monthNameMatch[3], 10);
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const month = months[monthName];
    if (Number.isFinite(day) && Number.isFinite(year) && month) {
      const yyyy = String(year).padStart(4, "0");
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const numericMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (numericMatch) {
    const day = Number.parseInt(numericMatch[1], 10);
    const month = Number.parseInt(numericMatch[2], 10);
    const year = Number.parseInt(numericMatch[3], 10);
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const yyyy = String(year).padStart(4, "0");
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function normalizeKey(value) {
  return toText(value).toLowerCase();
}

function getInsertErrorMessage(error, fallback) {
  const message = error?.message || fallback;
  const lowerMessage = String(message).toLowerCase();

  if (lowerMessage.includes("books_book_number_unique") || lowerMessage.includes("book_number")) {
    return "Book number already exists";
  }

  if (lowerMessage.includes("books_accession_no_unique") || lowerMessage.includes("accession_no")) {
    return "Accession number already exists";
  }

  if (lowerMessage.includes("duplicate key")) {
    return "A book with the same unique identifier already exists";
  }

  return message;
}

async function fetchExistingBookKeys(supabase, pageSize = 1000) {
  const effectivePageSize = Math.max(1, Math.min(1000, pageSize));
  const bookNumbers = new Set();
  const accessionNumbers = new Set();

  for (let offset = 0; ; offset += effectivePageSize) {
    const { data, error } = await supabase
      .from("books")
      .select("book_number, accession_no")
      .order("id")
      .range(offset, offset + effectivePageSize - 1);

    if (error) throw error;
    const batch = data ?? [];

    for (const row of batch) {
      const bookNumber = normalizeKey(row.book_number);
      const accessionNo = normalizeKey(row.accession_no);

      if (bookNumber) bookNumbers.add(bookNumber);
      if (accessionNo) accessionNumbers.add(accessionNo);
    }

    if (batch.length < effectivePageSize) break;
  }

  return { bookNumbers, accessionNumbers };
}

function parseArgs(argv) {
  const args = {
    file: "",
    email: process.env.SUPABASE_IMPORT_EMAIL || "admin@gcu.edu.in",
    password: process.env.SUPABASE_IMPORT_PASSWORD || "admin123",
    chunk: toInt(process.env.SUPABASE_IMPORT_CHUNK_SIZE, 500),
    limit: null,
  };

  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--email") {
      args.email = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--password") {
      args.password = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--chunk") {
      args.chunk = toInt(argv[i + 1], args.chunk);
      i++;
      continue;
    }
    if (a === "--limit") {
      const n = toInt(argv[i + 1], 0);
      args.limit = n > 0 ? n : null;
      i++;
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      usage(1);
    }
    positionals.push(a);
  }

  if (positionals.length > 0) args.file = positionals[0];
  return args;
}

function buildBookPayload(row) {
  const title = toText(row["245$a"]);
  const author = toText(row["100$a"]);
  const bookNumber = toText(row["082$b"]);

  const categoryOrSubject = toText(row["650$a"]);
  const itemType = toText(row["952$y"]) || toText(row["942$c"]) || "BK";

  return {
    title,
    sub_title: toText(row["245$b"]),
    author,
    author2: toText(row["700$a"]),
    isbn: toText(row["020$a"]),
    category: categoryOrSubject,
    available: 1,
    total: 1,
    class_number: toText(row["082$a"]),
    book_number: bookNumber,
    edition: toText(row["250$a"]),
    place_of_publication: toText(row["260$a"]),
    name_of_publication: toText(row["260$b"]),
    year_of_publication: toInt(row["260$c"], 2024),
    phy_desc: toText(row["300$a"]),
    volume: toText(row["490$v"]),
    general_note: toText(row["500$a"]),
    subject: categoryOrSubject,
    permanent_location: toText(row["952$a"]),
    current_library: toText(row["952$b"]),
    location: toText(row["952$c"]),
    date_of_purchase: toDateOnly(row["952$d"]),
    vendor: toText(row["952$e"]),
    bill_number: toText(row["952$f"]),
    price: toFloat(row["952$g"], 0),
    call_no: toText(row["952$o"]),
    accession_no: toText(row["952$p"]),
    item_type: itemType,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) usage(1);
  if (!fs.existsSync(args.file)) {
    console.error(`File not found: ${args.file}`);
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), ".env");
  const env = parseEnvFile(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase config. Ensure `.env` contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  const chunkSize = Math.max(1, Math.min(1000, args.chunk || 500));

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

  console.log("Reading XLSX...");
  const wb = xlsx.readFile(args.file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rowsRaw = xlsx.utils.sheet_to_json(ws, { defval: "", raw: false });
  const rows = [...rowsRaw];

  // Drop the first row if it looks like the label row (this file has it).
  if (rows.length && String(rows[0]["245$a"] ?? "").toLowerCase().includes("title")) {
    rows.shift();
  }

  const limitedRows = args.limit ? rows.slice(0, args.limit) : rows;
  console.log(`Rows detected: ${rows.length}${args.limit ? ` (importing first ${args.limit})` : ""}`);

  console.log("Checking existing books for duplicates...");
  const { bookNumbers: existingBookNumbers, accessionNumbers: existingAccessionNumbers } = await fetchExistingBookKeys(supabase);

  const payloads = [];
  const validationErrors = [];
  for (let i = 0; i < limitedRows.length; i++) {
    const payload = buildBookPayload(limitedRows[i]);
    const normalizedBookNumber = normalizeKey(payload.book_number);
    const normalizedAccessionNo = normalizeKey(payload.accession_no);

    if (!payload.title) {
      validationErrors.push({ row: i + 2, book_number: payload.book_number || "N/A", error: "Missing title" });
      continue;
    }
    if (!payload.author) {
      validationErrors.push({ row: i + 2, book_number: payload.book_number || "N/A", error: "Missing author" });
      continue;
    }
    if (!payload.book_number) {
      validationErrors.push({ row: i + 2, book_number: "N/A", error: "Missing book_number (082$b)" });
      continue;
    }
    if (existingBookNumbers.has(normalizedBookNumber)) {
      validationErrors.push({ row: i + 2, book_number: payload.book_number, error: "Book number already exists" });
      continue;
    }
    if (normalizedAccessionNo && existingAccessionNumbers.has(normalizedAccessionNo)) {
      validationErrors.push({ row: i + 2, book_number: payload.book_number || "N/A", error: "Accession number already exists" });
      continue;
    }

    payloads.push(payload);
    existingBookNumbers.add(normalizedBookNumber);
    if (normalizedAccessionNo) {
      existingAccessionNumbers.add(normalizedAccessionNo);
    }
  }

  if (validationErrors.length > 0) {
    console.warn(`Validation: ${validationErrors.length} rows will be skipped (missing required fields).`);
  }

  let inserted = 0;
  let failed = 0;
  const insertErrors = [];

  console.log(`Uploading in chunks of ${chunkSize}...`);
  const startTime = Date.now();

  for (let start = 0; start < payloads.length; start += chunkSize) {
    const chunk = payloads.slice(start, start + chunkSize);
    const { error } = await supabase.from("books").insert(chunk);

    if (!error) {
      inserted += chunk.length;
    } else {
      // Fallback to per-row insertion to isolate failures.
      for (let i = 0; i < chunk.length; i++) {
        const rowPayload = chunk[i];
        const { error: rowError } = await supabase.from("books").insert(rowPayload);
        if (rowError) {
          failed += 1;
          insertErrors.push({
            row: "unknown",
            book_number: rowPayload.book_number || "N/A",
            error: getInsertErrorMessage(rowError, "Failed to insert row"),
          });
        } else {
          inserted += 1;
        }
      }

      console.warn(`Chunk starting at ${start + 1} failed (${error.message}); continued row-by-row.`);
    }

    const processed = Math.min(start + chunk.length, payloads.length);
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const rate = Math.round(inserted / elapsedSec);
    console.log(`Progress: ${processed}/${payloads.length} processed | ${inserted} inserted | ${failed} failed | ~${rate}/s`);
  }

  const { count, error: countError } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.warn(`Could not verify count: ${countError.message}`);
  } else {
    console.log(`Supabase books count now: ${count}`);
  }

  if (validationErrors.length || insertErrors.length) {
    const reportPath = path.resolve(process.cwd(), "books_import_errors.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ validationErrors, insertErrors }, null, 2),
      "utf8",
    );
    console.log(`Wrote error report: ${reportPath}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
