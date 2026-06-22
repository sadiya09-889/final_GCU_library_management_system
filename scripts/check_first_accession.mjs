import xlsx from "xlsx";
import path from "node:path";
import fs from "node:fs";

const filePath = path.resolve(process.cwd(), "GCU_Library_Unique_Books_Deduplicated.xlsx");
const wb = xlsx.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

const accessionNos = new Map();
let dupFirstAccessionCount = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const rowNum = i + 2;
  
  const accessionNoRaw = String(row["Accession No"] ?? "").trim();
  if (!accessionNoRaw) continue;
  
  // Split on delimiters: comma, slash, semicolon, dash (wait, is dash a delimiter for range like 1205-1210? Yes, let's see. If we split on dash, we take the first number).
  // Let's use regex to split on commas, slashes, semicolons, and spaces
  const parts = accessionNoRaw.split(/[\s,/;]+/);
  const firstAccession = parts[0].trim();
  const normalized = firstAccession.toLowerCase();
  
  if (normalized) {
    if (accessionNos.has(normalized)) {
      dupFirstAccessionCount++;
      accessionNos.get(normalized).push({ rowNum, raw: accessionNoRaw });
    } else {
      accessionNos.set(normalized, [{ rowNum, raw: accessionNoRaw }]);
    }
  }
}

console.log("Duplicate count when taking first accession number:", dupFirstAccessionCount);
if (dupFirstAccessionCount > 0) {
  console.log("Some duplicates details:");
  let printed = 0;
  for (const [key, val] of accessionNos.entries()) {
    if (val.length > 1) {
      console.log(`Normalized first accession: "${key}"`);
      for (const item of val) {
        console.log(`  Row ${item.rowNum}: "${item.raw}"`);
      }
      printed++;
      if (printed >= 5) break;
    }
  }
}
