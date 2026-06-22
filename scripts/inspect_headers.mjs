import xlsx from "xlsx";
import path from "node:path";
import fs from "node:fs";

const filePath = path.resolve(process.cwd(), "GCU_Library_Unique_Books_Deduplicated.xlsx");
console.log("File exists:", fs.existsSync(filePath));

const wb = xlsx.readFile(filePath);
console.log("Sheet names:", wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];

// Read headers (the first row)
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
console.log("Number of rows:", rows.length);
if (rows.length > 0) {
  console.log("Headers (Row 0):", rows[0]);
  console.log("Row 1 sample data:", rows[1]);
  console.log("Row 2 sample data:", rows[2]);
}
