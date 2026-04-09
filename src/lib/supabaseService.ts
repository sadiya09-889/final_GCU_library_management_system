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

function sanitizeText(value: unknown, fallback = ""): string {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
}

function sanitizeInteger(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDecimal(value: unknown, fallback: number): number {
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDate(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split("T")[0];
}

function normalizeUploadBook(book: Partial<Book>): Partial<Omit<Book, "id">> {
    const total = Math.max(0, sanitizeInteger(book.total, 0));
    const availableRaw = Math.max(0, sanitizeInteger(book.available, total));
    const available = Math.min(availableRaw, total);

    return {
        title: sanitizeText(book.title),
        sub_title: sanitizeText(book.sub_title),
        author: sanitizeText(book.author),
        author2: sanitizeText(book.author2),
        isbn: sanitizeText(book.isbn),
        category: sanitizeText(book.category),
        available,
        total,
        class_number: sanitizeText(book.class_number),
        book_number: sanitizeText(book.book_number),
        edition: sanitizeText(book.edition),
        place_of_publication: sanitizeText(book.place_of_publication),
        name_of_publication: sanitizeText(book.name_of_publication),
        year_of_publication: sanitizeInteger(book.year_of_publication, 2024),
        phy_desc: sanitizeText(book.phy_desc),
        volume: sanitizeText(book.volume),
        general_note: sanitizeText(book.general_note),
        subject: sanitizeText(book.subject),
        permanent_location: sanitizeText(book.permanent_location),
        current_library: sanitizeText(book.current_library),
        location: sanitizeText(book.location),
        date_of_purchase: sanitizeDate(book.date_of_purchase),
        vendor: sanitizeText(book.vendor),
        bill_number: sanitizeText(book.bill_number),
        price: sanitizeDecimal(book.price, 0),
        call_no: sanitizeText(book.call_no),
        accession_no: sanitizeText(book.accession_no),
        item_type: sanitizeText(book.item_type, "Book"),
    };
}

export async function bulkAddBooks(books: Partial<Book>[]): Promise<BulkUploadResult> {
    const errors: BulkUploadResult["errors"] = [];
    const validBooks: Partial<Omit<Book, "id">>[] = [];
    const validBookRows: number[] = [];

    // Step 1: Validate all books and separate valid from invalid
    const { data: existingBooks } = await supabase.from("books").select("book_number");
    const existingNumbers = new Set(
        (existingBooks ?? [])
            .map((b) => sanitizeText(b.book_number).toLowerCase())
            .filter(Boolean),
    );

    for (let i = 0; i < books.length; i++) {
        const book = normalizeUploadBook(books[i]);
        const rowNum = i + 2;
        const title = sanitizeText(book.title);
        const author = sanitizeText(book.author);
        const bookNumber = sanitizeText(book.book_number);
        const normalizedBookNumber = bookNumber.toLowerCase();

        if (!title) {
            errors.push({ row: rowNum, bookNumber: bookNumber || "N/A", error: "Title is required" });
            continue;
        }
        if (!author) {
            errors.push({ row: rowNum, bookNumber: bookNumber || "N/A", error: "Author is required" });
            continue;
        }
        if (!bookNumber) {
            errors.push({ row: rowNum, bookNumber: "N/A", error: "Book number is required" });
            continue;
        }
        if (existingNumbers.has(normalizedBookNumber)) {
            errors.push({ row: rowNum, bookNumber, error: "Book number already exists" });
            continue;
        }

        validBooks.push(normalizeBookPayload(book));
        validBookRows.push(rowNum);
        existingNumbers.add(normalizedBookNumber);
    }

    // Step 2: Batch insert all valid books at once
    let successful = 0;
    if (validBooks.length > 0) {
        try {
            const { error } = await supabase.from("books").insert(validBooks);
            if (error) throw error;
            successful = validBooks.length;
        } catch (error) {
            // If batch insert fails, try one-by-one so valid rows still go through.
            for (let i = 0; i < validBooks.length; i++) {
                const rowPayload = validBooks[i];
                const rowNumber = validBookRows[i];

                const { error: rowError } = await supabase.from("books").insert(rowPayload);

                if (rowError) {
                    errors.push({
                        row: rowNumber,
                        bookNumber: sanitizeText(rowPayload.book_number, "N/A"),
                        error: getErrorMessage(rowError, "Failed to insert row"),
                    });
                } else {
                    successful += 1;
                }
            }
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
            // Escaped quote inside a quoted value: "" -> "
            if (inQuotes && row[i + 1] === '"') {
                current += '"';
                i++;
                continue;
            }
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
    const normalizedCsv = csvText.replace(/^\uFEFF/, "").trim();
    const lines = normalizedCsv.split(/\r?\n/);
    if (lines.length < 2) return [];

    const normalizeHeader = (header: string) => header.toLowerCase().trim().replace(/[\s-]+/g, "_");

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

    const numericDefaults: Record<string, number> = {
        available: 0,
        total: 0,
        price: 0,
        year_of_publication: 2024,
    };
    const numericColumns = new Set(Object.keys(numericDefaults));

    const headerLine = lines[0];
    const rawHeaders = parseCSVRow(headerLine).map(normalizeHeader);
    
    const books: Partial<Book>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVRow(line);
        if (values.every((v) => !v.trim())) continue;

        const book: Record<string, unknown> = {};

        // Map values to headers correctly
        for (let headerIdx = 0; headerIdx < rawHeaders.length; headerIdx++) {
            const normalized = rawHeaders[headerIdx];
            if (!validColumns.has(normalized)) continue;

            const value = (values[headerIdx] || "").trim();
            const header = normalized;

            if (!value) {
                if (numericColumns.has(header)) {
                    book[header] = numericDefaults[header];
                } else if (header === "date_of_purchase") {
                    book[header] = "";
                } else {
                    book[header] = "";
                }
            } else if (numericColumns.has(header)) {
                const parsed = header === "price"
                    ? Number.parseFloat(value)
                    : Number.parseInt(value, 10);
                book[header] = Number.isFinite(parsed) ? parsed : numericDefaults[header];
            } else {
                book[header] = value;
            }
        }

        books.push(book as Partial<Book>);
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

async function fetchBookInventory(bookId: string) {
    const { data, error } = await supabase
        .from("books")
        .select("id, available, total")
        .eq("id", bookId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Book not found");

    const available = Math.max(0, sanitizeInteger(data.available, 0));
    const total = Math.max(Math.max(0, sanitizeInteger(data.total, 0)), available);

    return { available, total };
}

async function updateBookAvailableOptimistically(bookId: string, expectedAvailable: number, nextAvailable: number) {
    const { data, error } = await supabase
        .from("books")
        .update({ available: nextAvailable })
        .eq("id", bookId)
        .eq("available", expectedAvailable)
        .select("id");

    if (error) throw error;
    return (data ?? []).length > 0;
}

export async function issueBook(issue: Omit<IssuedBook, "id">): Promise<IssuedBook> {
    const bookId = typeof issue.book_id === "string" ? issue.book_id.trim() : "";
    if (!bookId) throw new Error("Book is required to issue");

    let previousAvailable = 0;
    let nextAvailable = 0;
    let decremented = false;

    for (let attempt = 0; attempt < 3; attempt++) {
        const { available } = await fetchBookInventory(bookId);
        if (available <= 0) throw new Error("No copies available to issue");

        previousAvailable = available;
        nextAvailable = available - 1;

        const updated = await updateBookAvailableOptimistically(bookId, previousAvailable, nextAvailable);
        if (updated) {
            decremented = true;
            break;
        }
    }

    if (!decremented) throw new Error("Book availability changed. Please try again.");

    const { data, error } = await supabase
        .from("issued_books")
        .insert(issue)
        .select()
        .single();

    if (error) {
        // Best-effort rollback of availability decrement.
        try {
            await supabase
                .from("books")
                .update({ available: previousAvailable })
                .eq("id", bookId)
                .eq("available", nextAvailable);
        } catch {
            // Ignore rollback failures.
        }

        throw error;
    }

    return data;
}

export async function returnBook(id: string): Promise<IssuedBook> {
    const { data: existingIssue, error: existingError } = await supabase
        .from("issued_books")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (existingError) throw existingError;
    if (!existingIssue) throw new Error("Issued record not found");
    if (existingIssue.status === "returned") return existingIssue;

    const bookId = typeof existingIssue.book_id === "string" ? existingIssue.book_id.trim() : "";
    const returnDate = new Date().toISOString().split("T")[0];
    const previousStatus = existingIssue.status;

    let previousAvailable = 0;
    let nextAvailable = 0;
    let incremented = !bookId;

    if (bookId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const inventory = await fetchBookInventory(bookId);
            previousAvailable = inventory.available;
            const computedNext = previousAvailable + 1;
            nextAvailable = inventory.total > 0 ? Math.min(computedNext, inventory.total) : computedNext;

            if (nextAvailable === previousAvailable) {
                incremented = true;
                break;
            }

            const updated = await updateBookAvailableOptimistically(bookId, previousAvailable, nextAvailable);
            if (updated) {
                incremented = true;
                break;
            }
        }

        if (!incremented) throw new Error("Unable to update book availability. Please try again.");
    }

    const { data: returnedIssue, error } = await supabase
        .from("issued_books")
        .update({
            status: "returned",
            return_date: returnDate,
        })
        .eq("id", id)
        .eq("status", previousStatus)
        .select()
        .single();

    if (error) {
        if (bookId && incremented && nextAvailable !== previousAvailable) {
            // Best-effort rollback of availability increment.
            try {
                await supabase
                    .from("books")
                    .update({ available: previousAvailable })
                    .eq("id", bookId)
                    .eq("available", nextAvailable);
            } catch {
                // Ignore rollback failures.
            }
        }

        throw error;
    }

    return returnedIssue;
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

function looksLikeUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function fetchProfile(userIdentifier: string): Promise<UserProfile | null> {
    const identifier = userIdentifier.trim();
    if (!identifier) return null;

    const lookupColumn = looksLikeUuid(identifier) ? "id" : "reg_no";

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq(lookupColumn, identifier)
        .maybeSingle();

    if (error) return null;
    return data;
}

function getMissingProfileColumns(errorMessage: string): Array<"contact_number" | "reg_no"> {
    const lowerMessage = errorMessage.toLowerCase();
    const missing: Array<"contact_number" | "reg_no"> = [];

    const isMissingColumnError = (columnName: "contact_number" | "reg_no") => {
        const mentionsColumn =
            lowerMessage.includes(columnName) ||
            lowerMessage.includes(`'${columnName}'`) ||
            lowerMessage.includes(`"${columnName}"`);

        const indicatesMissingColumn =
            lowerMessage.includes("does not exist") ||
            lowerMessage.includes("could not find") ||
            lowerMessage.includes("schema cache") ||
            lowerMessage.includes("unknown column");

        return mentionsColumn && indicatesMissingColumn;
    };

    if (isMissingColumnError("contact_number")) {
        missing.push("contact_number");
    }

    if (isMissingColumnError("reg_no")) {
        missing.push("reg_no");
    }

    return missing;
}

export async function updateProfile(userId: string, updates: Partial<Omit<UserProfile, "id" | "join_date">>): Promise<UserProfile> {
    const tryDbUpdate = async (payload: Partial<Omit<UserProfile, "id" | "join_date">>) => {
        const { data, error } = await supabase
            .from("profiles")
            .update(payload)
            .eq("id", userId)
            .select()
            .single();

        return { data, error };
    };

    const dbSafeUpdates: Partial<Omit<UserProfile, "id" | "join_date">> = { ...updates };
    const metadataUpdates: Record<string, string> = {};

    let updatedProfile: UserProfile | null = null;
    let lastError: unknown = null;

    while (Object.keys(dbSafeUpdates).length > 0) {
        const attempt = await tryDbUpdate(dbSafeUpdates);
        if (!attempt.error && attempt.data) {
            updatedProfile = attempt.data;
            break;
        }

        lastError = attempt.error;
        const missingColumns = getMissingProfileColumns(attempt.error?.message || "");
        if (missingColumns.length === 0) {
            throw attempt.error;
        }

        let removedAnyColumn = false;
        for (const missingColumn of missingColumns) {
            if (!(missingColumn in dbSafeUpdates)) continue;

            const value = updates[missingColumn];
            if (typeof value === "string") {
                metadataUpdates[missingColumn] = value;
            }

            delete dbSafeUpdates[missingColumn];
            removedAnyColumn = true;
        }

        if (!removedAnyColumn) {
            throw attempt.error;
        }
    }

    if (!updatedProfile) {
        const { data: existing, error: existingError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (existingError || !existing) {
            throw existingError || lastError;
        }

        updatedProfile = existing;
    }

    if (Object.keys(metadataUpdates).length > 0) {
        const { error: metadataError } = await supabase.auth.updateUser({
            data: metadataUpdates,
        });

        if (metadataError) {
            throw metadataError;
        }
    }

    return {
        ...updatedProfile,
        ...metadataUpdates,
    };
}
