import xlsx from "xlsx";
import path from "node:path";
import fs from "node:fs";

const filePath = path.resolve(process.cwd(), "GCU_Library_Unique_Books_Deduplicated.xlsx");
const wb = xlsx.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

const bookNumbers = new Map();
const accessionNos = new Map();

let dupBookNumberCount = 0;
let dupAccessionNoCount = 0;
let multiAccessionNoCount = 0;
let emptyBookNumberCount = 0;
let emptyAccessionNoCount = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const rowNum = i + 2; // Excel row numbering starts at 1, headers at 1, data starts at 2
  
  const bookNumberRaw = String(row["Book No"] ?? "").trim();
  const bookNumber = bookNumberRaw.toLowerCase();
  
  const accessionNoRaw = String(row["Accession No"] ?? "").trim();
  const accessionNo = accessionNoRaw.toLowerCase();

  if (!bookNumber) {
    emptyBookNumberCount++;
  } else {
    if (bookNumbers.has(bookNumber)) {
      dupBookNumberCount++;
      bookNumbers.get(bookNumber).push(rowNum);
    } else {
      bookNumbers.set(bookNumber, [rowNum]);
    }
  }

  if (!accessionNo) {
    emptyAccessionNoCount++;
  } else {
    if (accessionNo.includes(",") || accessionNo.includes("-") || accessionNo.includes("/") || accessionNo.includes(";")) {
      multiAccessionNoCount++;
    }
    if (accessionNos.has(accessionNo)) {
      dupAccessionNoCount++;
      accessionNos.get(accessionNo).push(rowNum);
    } else {
      accessionNos.set(accessionNo, [rowNum]);
    }
  }
}

console.log("Total rows in JSON:", rows.length);
console.log("Empty Book Numbers:", emptyBookNumberCount);
console.log("Duplicate Book Numbers (unique values with count > 1):", dupBookNumberCount);
console.log("Empty Accession Nos:", emptyAccessionNoCount);
console.log("Duplicate Accession Nos (unique values with count > 1):", dupAccessionNoCount);
console.log("Accession Nos containing delimiters (, - / ;):", multiAccessionNoCount);

// Let's print some examples of duplicates or multi-accession nos
console.log("\nSome multi-accession no examples:");
let printedMulti = 0;
for (const row of rows) {
  const acc = String(row["Accession No"] ?? "").trim();
  if (acc && (acc.includes(",") || acc.includes("-") || acc.includes("/") || acc.includes(";"))) {
    console.log(`Row: ${acc} | Copies: ${row["No. of Copies"]}`);
    printedMulti++;
    if (printedMulti >= 5) break;
  }
}

console.log("\nSome duplicate accession number examples:");
let printedDupAcc = 0;
for (const [key, val] of accessionNos.entries()) {
  if (val.length > 1) {
    console.log(`AccessionNo: "${key}" | Rows: ${val.join(", ")}`);
    printedDupAcc++;
    if (printedDupAcc >= 5) break;
  }
}

console.log("\nSome duplicate book number examples:");
let printedDupBook = 0;
for (const [key, val] of bookNumbers.entries()) {
  if (val.length > 1) {
    console.log(`BookNumber: "${key}" | Rows: ${val.join(", ")}`);
    printedDupBook++;
    if (printedDupBook >= 5) break;
  }
}
