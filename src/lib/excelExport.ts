function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportRowsAsExcelCsv(rows: Array<Record<string, unknown>>, fileBaseName: string): void {
  if (!rows.length) return;

  const headers: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    }
  }

  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(","));

  const csv = [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileBaseName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
