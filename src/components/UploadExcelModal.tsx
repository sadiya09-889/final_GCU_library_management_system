import { useEffect, useRef, useState } from "react";
import { Upload, X, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { bulkAddBooks, parseBooksCsv } from "@/lib/supabaseService";
import type { BulkUploadResult } from "@/lib/supabaseService";
import type { Book } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadExcelModal({ isOpen, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [preview, setPreview] = useState<Partial<Book>[]>([]);
  const [parsedBooks, setParsedBooks] = useState<Partial<Book>[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setPreview([]);
      setParsedBooks([]);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  const parseBooksFromFile = async (file: File): Promise<Partial<Book>[]> => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      return parseBooksCsv(text);
    }

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const { read, utils } = await import("xlsx");
      const workbook = read(await file.arrayBuffer(), { type: "array" });

      if (!workbook.SheetNames.length) return [];
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) return [];

      const csvText = utils.sheet_to_csv(firstSheet, { blankrows: false });
      return parseBooksCsv(csvText);
    }

    throw new Error("Unsupported file type. Please upload .csv, .xlsx, or .xls file.");
  };

  const downloadTemplate = () => {
    const headers = [
      "title", "sub_title", "author", "author2", "isbn", "category",
      "book_number", "class_number", "edition", "place_of_publication",
      "name_of_publication", "year_of_publication", "accession_no", "total", "available"
    ];
    
    const csv = headers.join(",") + "\r\n" +
      "Sample Title,Subtitle,Author Name,,ISBN123,Fiction,BK001,FIC-001,1st,New York,ABC Publishers,2024,ACC001,5,5";
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "books_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const books = await parseBooksFromFile(file);
      if (books.length === 0) {
        setParsedBooks([]);
        setPreview([]);
        toast.error("No valid data found in file");
        return;
      }

      setParsedBooks(books);
      setPreview(books.slice(0, 5));
      setResult(null);
      toast.success(`File loaded: ${books.length} books found`);
    } catch (error) {
      setParsedBooks([]);
      setPreview([]);
      toast.error(error instanceof Error ? error.message : "Failed to parse file");
    }
  };

  const handleUpload = async () => {
    if (parsedBooks.length === 0) {
      toast.error("No books to upload. Please select a file first.");
      return;
    }

    setUploading(true);
    let loadingToastId: string | number | undefined;

    try {
      loadingToastId = toast.loading(`Uploading ${parsedBooks.length} books...`);
      const uploadResult = await bulkAddBooks(parsedBooks);
      if (loadingToastId !== undefined) toast.dismiss(loadingToastId);
      setResult(uploadResult);

      if (uploadResult.successful > 0) {
        toast.success(`✓ ${uploadResult.successful} books added to database successfully!`);
        // Auto-refresh after successful upload
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
      if (uploadResult.failed > 0) {
        toast.error(`✗ ${uploadResult.failed} books failed to upload. Check errors below.`);
      }
    } catch (error) {
      if (loadingToastId !== undefined) toast.dismiss(loadingToastId);
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;

    const rows = result.errors.map(e => ({
      row: e.row,
      book_number: e.bookNumber,
      error: e.error
    }));

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${r[h as keyof typeof r]}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "upload_errors.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Error report downloaded");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-elevated w-full max-w-2xl p-6 border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-secondary" />
            <h2 className="font-semibold text-xl text-foreground">Upload Excel</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result ? (
          <>
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>How to use:</strong> Download the CSV template, fill it with your book data, then upload it here. The system will validate and add all books to your Supabase database.
                </p>
              </div>

              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-secondary/50 bg-card text-secondary hover:bg-secondary/10 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" /> Download CSV Template
              </button>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-10 w-10 mx-auto mb-3 text-secondary opacity-60" />
                <p className="font-medium text-foreground mb-1">Click to browse or drag and drop</p>
                <p className="text-muted-foreground text-sm">CSV or Excel file (.csv, .xlsx, .xls)</p>
              </div>

              {preview.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-foreground">Preview (showing {preview.length} of {parsedBooks.length} records)</p>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">Ready to upload</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-2 py-1 text-muted-foreground">Book Number</th>
                          <th className="text-left px-2 py-1 text-muted-foreground">Title</th>
                          <th className="text-left px-2 py-1 text-muted-foreground">Author</th>
                          <th className="text-left px-2 py-1 text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((book, i) => (
                          <tr key={i} className="border-b border-border hover:bg-muted">
                            <td className="px-2 py-1 text-foreground font-medium">{book.book_number || "-"}</td>
                            <td className="px-2 py-1 text-foreground">{book.title || "-"}</td>
                            <td className="px-2 py-1 text-foreground">{book.author || "-"}</td>
                            <td className="px-2 py-1 text-foreground">{book.total || "0"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || parsedBooks.length === 0}
                className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-secondary-foreground border-t-transparent rounded-full" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload to Database
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              {result.successful > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                  <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">{result.successful} Books Added Successfully!</p>
                    <p className="text-sm text-muted-foreground">All books have been added to your Supabase database</p>
                  </div>
                </div>
              )}

              {result.failed > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">{result.failed} Books Failed</p>
                    <p className="text-sm text-muted-foreground">View errors below and download the report to fix issues</p>
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto border border-border">
                  <p className="text-sm font-semibold text-foreground mb-3">Error Details:</p>
                  <div className="space-y-2">
                    {result.errors.slice(0, 15).map((err, i) => (
                      <div key={i} className="text-xs text-muted-foreground border-l-2 border-destructive pl-2 py-1">
                        <p className="font-medium text-destructive">Row {err.row} • {err.bookNumber || "Unknown"}</p>
                        <p className="text-xs">{err.error}</p>
                      </div>
                    ))}
                    {result.errors.length > 15 && (
                      <p className="text-xs text-muted-foreground font-medium">...and {result.errors.length - 15} more errors</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {result.errors.length > 0 && (
                <button
                  onClick={downloadErrorReport}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Download Error Report
                </button>
              )}
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                {result.successful > 0 ? "Close & Refresh" : "Close"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
