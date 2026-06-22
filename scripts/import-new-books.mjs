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
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
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
      Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year) &&
      month >= 1 && month <= 12 && day >= 1 && day <= 31
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

function buildBookPayload(row) {
  const title = toText(row["Title"]);
  const author = toText(row["Author"]);
  const bookNumber = toText(row["Book No"]);
  
  const accessionNoRaw = toText(row["Accession No"]);
  // Extract only the first accession number to prevent duplicate problems and multiple entries
  const parts = accessionNoRaw.split(/[\s,/;]+/);
  const firstAccession = parts[0]?.trim() || "";

  const copiesCount = Math.max(1, toInt(row["No. of Copies"], 1));

  return {
    title,
    sub_title: toText(row["Sub-Title"]),
    author,
    author2: toText(row["Author 2"]),
    isbn: toText(row["ISBN No"]),
    category: toText(row["Subject"]),
    subject: toText(row["Subject"]),
    class_number: toText(row["Class No"]),
    book_number: bookNumber,
    edition: toText(row["Edition"]),
    place_of_publication: toText(row["Place of Pub."]),
    name_of_publication: toText(row["Name of Publication"]),
    year_of_publication: toInt(row["Year of Pub"], 2024),
    phy_desc: toText(row["Phy. Desc"]),
    volume: toText(row["Volume"]),
    general_note: toText(row["General Note"]),
    permanent_location: toText(row["Permanent Location"]),
    current_library: toText(row["Current Library"]),
    location: toText(row["Location"]),
    date_of_purchase: toDateOnly(row["Date of Purchase"]),
    vendor: toText(row["Vendor"]),
    bill_number: toText(row["Bill No."]),
    price: toFloat(row["Price"], 0),
    call_no: toText(row["Call No"]),
    accession_no: firstAccession,
    item_type: toText(row["Item Type"]) || "Book",
    total: copiesCount,
    available: copiesCount,
    no_of_copies: copiesCount
  };
}

async function main() {
  const file = "GCU_Library_Unique_Books_Deduplicated.xlsx";
  const email = "admin@gcu.edu.in";
  const password = "admin123";
  const chunkSize = 500;

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), ".env");
  const env = parseEnvFile(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase config in .env.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error(`Supabase auth failed: ${authError.message}`);
    process.exit(1);
  }

  console.log("Reading XLSX...");
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rowsRaw = xlsx.utils.sheet_to_json(ws, { defval: "", raw: false });
  console.log(`Parsed ${rowsRaw.length} rows from Excel.`);

  const bookNumbers = new Set();
  const accessionNumbers = new Set();

  const payloads = [];
  const validationErrors = [];
  const duplicatesSkipped = [];

  for (let i = 0; i < rowsRaw.length; i++) {
    const row = rowsRaw[i];
    const rowNum = i + 2; // Excel header is row 1
    const payload = buildBookPayload(row);

    const normalizedBookNumber = normalizeKey(payload.book_number);
    const normalizedAccessionNo = normalizeKey(payload.accession_no);

    if (!payload.title) {
      validationErrors.push({ row: rowNum, book_number: payload.book_number || "N/A", error: "Missing Title" });
      continue;
    }
    if (!payload.author) {
      validationErrors.push({ row: rowNum, book_number: payload.book_number || "N/A", error: "Missing Author" });
      continue;
    }
    if (!payload.book_number) {
      validationErrors.push({ row: rowNum, book_number: "N/A", error: "Missing Book Number" });
      continue;
    }

    // Check unique constraints for current run
    if (bookNumbers.has(normalizedBookNumber)) {
      duplicatesSkipped.push({ row: rowNum, book_number: payload.book_number, error: "Duplicate Book Number in Excel" });
      continue;
    }
    if (normalizedAccessionNo && accessionNumbers.has(normalizedAccessionNo)) {
      duplicatesSkipped.push({ row: rowNum, book_number: payload.book_number, accession_no: payload.accession_no, error: "Duplicate Accession Number in Excel" });
      continue;
    }

    payloads.push(payload);
    bookNumbers.add(normalizedBookNumber);
    if (normalizedAccessionNo) {
      accessionNumbers.add(normalizedAccessionNo);
    }
  }

  console.log(`Validation completed.`);
  console.log(`- Valid payloads: ${payloads.length}`);
  console.log(`- Missing required fields: ${validationErrors.length}`);
  console.log(`- Duplicates filtered out: ${duplicatesSkipped.length}`);

  let inserted = 0;
  let failed = 0;
  const insertErrors = [];

  console.log(`Uploading to Supabase in chunks of ${chunkSize}...`);
  const startTime = Date.now();

  for (let start = 0; start < payloads.length; start += chunkSize) {
    const chunk = payloads.slice(start, start + chunkSize);
    const { error } = await supabase.from("books").insert(chunk);

    if (!error) {
      inserted += chunk.length;
    } else {
      console.warn(`Chunk starting at ${start + 1} failed (${error.message}); processing row-by-row...`);
      for (let i = 0; i < chunk.length; i++) {
        const rowPayload = chunk[i];
        const { error: rowError } = await supabase.from("books").insert(rowPayload);
        if (rowError) {
          failed += 1;
          insertErrors.push({
            book_number: rowPayload.book_number || "N/A",
            error: getInsertErrorMessage(rowError, "Failed to insert row"),
          });
        } else {
          inserted += 1;
        }
      }
    }

    const processed = Math.min(start + chunk.length, payloads.length);
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const rate = Math.round(inserted / elapsedSec);
    console.log(`Progress: ${processed}/${payloads.length} processed | ${inserted} inserted | ${failed} failed | ~${rate}/s`);
  }

  // Validate database state
  console.log("Validating Database State...");
  const { count, error: countError } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error(`Could not verify final database count: ${countError.message}`);
  } else {
    console.log(`Supabase books count now: ${count}`);
  }

  // Calculate sum of total and available copies
  const { data: sumData, error: sumError } = await supabase
    .from("books")
    .select("total, available");

  if (sumError) {
    console.error(`Could not calculate checksums: ${sumError.message}`);
  } else {
    let sumTotal = 0;
    let sumAvailable = 0;
    let availableExceedsTotalCount = 0;

    for (const b of sumData) {
      sumTotal += b.total;
      sumAvailable += b.available;
      if (b.available > b.total) {
        availableExceedsTotalCount++;
      }
    }

    console.log(`Sum of total copies: ${sumTotal}`);
    console.log(`Sum of available copies: ${sumAvailable}`);
    console.log(`Books with available > total: ${availableExceedsTotalCount}`);
  }

  if (validationErrors.length || duplicatesSkipped.length || insertErrors.length) {
    const reportPath = path.resolve(process.cwd(), "books_import_report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ validationErrors, duplicatesSkipped, insertErrors }, null, 2),
      "utf8",
    );
    console.log(`Wrote import report: ${reportPath}`);
  }

  console.log("Import script complete.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
