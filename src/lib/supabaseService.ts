import { supabase } from "./supabase";
import type { Book, IssuedBook, UserProfile } from "./types";

function normalizeBookPayload<T extends Partial<Omit<Book, "id">>>(book: T) {
    const date = book.date_of_purchase;

    return {
        ...book,
        // Supabase date columns reject empty strings; send null when no date is chosen.
        date_of_purchase: typeof date === "string" && date.trim() === "" ? null : date,
    };
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message;
    }
    return fallback;
}

export interface BulkUploadResult {
    successful: number;
    failed: number;
    errors: Array<{ row: number; bookNumber: string; error: string }>;
}

export async function bulkAddBooks(books: Partial<Book>[]): Promise<BulkUploadResult> {
    const errors: BulkUploadResult["errors"] = [];
    const validBooks: Partial<Book>[] = [];
    const validBookRows: number[] = [];

    // Step 1: Validate all books and separate valid from invalid
    const { data: existingBooks } = await supabase.from("books").select("book_number");
    const existingNumbers = new Set(existingBooks?.map(b => b.book_number) || []);

    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const rowNum = i + 2;

        if (!book.title?.trim()) {
            errors.push({ row: rowNum, bookNumber: book.book_number || "N/A", error: "Title is required" });
            continue;
        }
        if (!book.book_number?.trim()) {
            errors.push({ row: rowNum, bookNumber: "N/A", error: "Book number is required" });
            continue;
        }
        if (existingNumbers.has(book.book_number)) {
            errors.push({ row: rowNum, bookNumber: book.book_number, error: "Book number already exists" });
            continue;
        }

        validBooks.push(normalizeBookPayload(book));
        validBookRows.push(rowNum);
        existingNumbers.add(book.book_number);
    }

    // Step 2: Batch insert all valid books at once
    let successful = 0;
    if (validBooks.length > 0) {
        try {
            const { error } = await supabase.from("books").insert(validBooks);
            if (error) throw error;
            successful = validBooks.length;
        } catch (error) {
            // If batch insert fails, log the error for all valid books
            for (let i = 0; i < validBooks.length; i++) {
                errors.push({
                    row: validBookRows[i],
                    bookNumber: (validBooks[i] as any).book_number || "N/A",
                    error: getErrorMessage(error, "Failed to insert batch"),
                });
            }
            successful = 0;
        }
    }

    return { successful, failed: errors.length, errors };
}

// Proper CSV parser that handles quoted fields and commas
function parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ""));
            current = "";
        } else {
            current += char;
        }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
}

export function parseBooksCsv(csvText: string): Partial<Book>[] {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return [];

    // Valid column names that exist in the books table
    const validColumns = new Set([
        "title", "sub_title", "author", "author2", "isbn", "category",
        "available", "total", "class_number", "book_number", "edition",
        "place_of_publication", "name_of_publication", "year_of_publication",
        "phy_desc", "volume", "general_note", "subject",
        "permanent_location", "current_library", "location",
        "date_of_purchase", "vendor", "bill_number", "price",
        "call_no", "accession_no", "item_type"
    ]);

    const headerLine = lines[0];
    // Parse headers properly with CSV aware parsing
    const rawHeaders = parseCSVRow(headerLine);
    const headers = rawHeaders
        .map(h => h.toLowerCase().trim())
        .filter(h => validColumns.has(h)); // Only keep valid columns
    
    const books: Partial<Book>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVRow(line);
        const book: Partial<Book> = {};

        // Map values to headers correctly
        for (let headerIdx = 0; headerIdx < rawHeaders.length; headerIdx++) {
            const normalized = rawHeaders[headerIdx].toLowerCase().trim();
            if (!validColumns.has(normalized)) continue;

            const value = values[headerIdx] || "";
            const header = normalized;

            // Set empty values to null to allow partial records
            if (!value) {
                (book as any)[header] = null;
            } else if (["available", "total", "price", "year_of_publication"].includes(header)) {
                // For numeric fields, parse to number or null if invalid
                const parsed = parseInt(value);
                (book as any)[header] = isNaN(parsed) ? null : parsed;
            } else {
                // For text fields, keep the value
                (book as any)[header] = value;
            }
        }

        books.push(book);
    }

    return books;
}

// ─── Books ──────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
    const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("title");
    if (error) throw error;
    return data ?? [];
}

export async function addBook(book: Omit<Book, "id">): Promise<Book> {
    const payload = normalizeBookPayload(book);

    const { data, error } = await supabase
        .from("books")
        .insert(payload)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<Book> {
    const payload = normalizeBookPayload(updates);

    const { data, error } = await supabase
        .from("books")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteBook(id: string): Promise<void> {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
}

// ─── Issued Books ───────────────────────────────────────

export async function fetchIssuedBooks(): Promise<IssuedBook[]> {
    const { data, error } = await supabase
        .from("issued_books")
        .select("*")
        .order("issue_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function fetchIssuedBooksByStudent(studentId: string): Promise<IssuedBook[]> {
    const { data, error } = await supabase
        .from("issued_books")
        .select("*")
        .eq("student_id", studentId)
        .order("issue_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function fetchOverdueBooks(): Promise<IssuedBook[]> {
    const { data, error } = await supabase
        .from("issued_books")
        .select("*")
        .eq("status", "overdue")
        .order("due_date");
    if (error) throw error;
    return data ?? [];
}

export async function checkAndUpdateOverdueBooks(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    // Fetch all issued books where due_date has passed
    const { data, error } = await supabase
        .from("issued_books")
        .select("id, due_date")
        .eq("status", "issued")
        .lt("due_date", today);
    if (error || !data || data.length === 0) return;
    // Update each overdue book's status
    const ids = data.map(d => d.id);
    await supabase
        .from("issued_books")
        .update({ status: "overdue" })
        .in("id", ids);
}

export async function issueBook(issue: Omit<IssuedBook, "id">): Promise<IssuedBook> {
    const { data, error } = await supabase
        .from("issued_books")
        .insert(issue)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function returnBook(id: string): Promise<IssuedBook> {
    const { data, error } = await supabase
        .from("issued_books")
        .update({
            status: "returned",
            return_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ─── Profiles ───────────────────────────────────────────

export async function fetchProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
    if (error) throw error;
    return data ?? [];
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
    if (error) return null;
    return data;
}

export async function updateProfile(userId: string, updates: Partial<Omit<UserProfile, "id" | "join_date">>): Promise<UserProfile> {
    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}
