import { supabase } from "./supabase";
import { ACADEMIC_PROGRAMMES, getProgrammeRecommendationKeywords } from "./academicProgrammes";
import type { AcademicProgramme, Book, BookReservation, BookReservationStatus, IssuedBook, LibraryNotification, Magazine, ProgrammeBook, UserProfile } from "./types";

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

function isMissingRelationError(error: unknown, relationName: string): boolean {
    const message = getErrorMessage(error, "").toLowerCase();
    const relation = relationName.toLowerCase();

    return (
        message.includes(relation) &&
        (
            message.includes("does not exist") ||
            message.includes("could not find") ||
            message.includes("schema cache")
        )
    );
}

function isMissingFunctionError(error: unknown, functionName: string): boolean {
    const message = getErrorMessage(error, "").toLowerCase();
    const fn = functionName.toLowerCase();

    return (
        message.includes(fn) &&
        (
            message.includes("does not exist") ||
            message.includes("could not find") ||
            message.includes("schema cache") ||
            message.includes("pgrst202")
        )
    );
}

const MAGAZINES_BUCKET = "magazines";

export interface BulkUploadResult {
    successful: number;
    failed: number;
    errors: Array<{ row: number; bookNumber: string; error: string }>;
}

export interface FetchBooksPageParams {
    page: number;
    perPage: number;
    search?: string;
    category?: string;
    status?: "All" | "Available" | "Issued" | "Out of Stock";
    yearFilter?: "All" | "2020-2025" | "2015-2019" | "Before 2015";
    dateFilter?: "All" | "Last 30 Days" | "Last 6 Months";
}

export interface FetchBooksPageResult {
    books: Book[];
    total: number;
}

export interface FetchOpacBooksPageParams {
    page: number;
    perPage: number;
    search?: string;
    availableOnly?: boolean;
    yearStart?: number | null;
    yearEnd?: number | null;
    programmeKeywords?: string[];
}

export interface FetchOpacBooksPageResult {
    books: Book[];
    total: number;
    source: "rpc" | "fallback";
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

function normalizeUniqueField(value: unknown): string {
    return sanitizeText(value).toLowerCase();
}

function escapePostgrestPattern(value: string) {
    return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function escapePostgrestFilterValue(value: string) {
    return escapePostgrestPattern(value).replace(/[(),]/g, " ");
}

function getBookConstraintMessage(error: unknown, fallback: string): string {
    const message = getErrorMessage(error, fallback);
    const lowerMessage = message.toLowerCase();

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

async function fetchAllBookIdentityRows(pageSize = 1000) {
    const effectivePageSize = Math.max(1, Math.min(1000, Math.floor(pageSize)));
    const all: Array<Pick<Book, "id" | "book_number" | "accession_no">> = [];

    for (let offset = 0; ; offset += effectivePageSize) {
        const { data, error } = await supabase
            .from("books")
            .select("id, book_number, accession_no")
            .order("id")
            .range(offset, offset + effectivePageSize - 1);

        if (error) throw error;
        const batch = (data ?? []) as Array<Pick<Book, "id" | "book_number" | "accession_no">>;
        all.push(...batch);

        if (batch.length < effectivePageSize) break;
    }

    return all;
}

async function hasBookConflict(field: "book_number" | "accession_no", value: string, excludeId?: string) {
    if (!value) return false;

    let query = supabase
        .from("books")
        .select("id")
        .eq(field, value)
        .limit(1);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).length > 0;
}

async function validateBookForSave(book: Partial<Omit<Book, "id">>, excludeId?: string) {
    const title = sanitizeText(book.title);
    const author = sanitizeText(book.author);
    const bookNumber = sanitizeText(book.book_number);
    const accessionNo = sanitizeText(book.accession_no);

    if (!title) throw new Error("Title is required");
    if (!author) throw new Error("Author is required");
    if (!bookNumber) throw new Error("Book number is required");

    if (await hasBookConflict("book_number", bookNumber, excludeId)) {
        throw new Error("Book number already exists");
    }

    if (accessionNo && await hasBookConflict("accession_no", accessionNo, excludeId)) {
        throw new Error("Accession number already exists");
    }
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
    const existingBooks = await fetchAllBookIdentityRows();
    const existingNumbers = new Set(
        existingBooks
            .map((b) => sanitizeText(b.book_number).toLowerCase())
            .filter(Boolean),
    );
    const existingAccessions = new Set(
        existingBooks
            .map((b) => sanitizeText(b.accession_no).toLowerCase())
            .filter(Boolean),
    );

    for (let i = 0; i < books.length; i++) {
        const book = normalizeUploadBook(books[i]);
        const rowNum = i + 2;
        const title = sanitizeText(book.title);
        const author = sanitizeText(book.author);
        const bookNumber = sanitizeText(book.book_number);
        const accessionNo = sanitizeText(book.accession_no);
        const normalizedBookNumber = normalizeUniqueField(bookNumber);
        const normalizedAccessionNo = normalizeUniqueField(accessionNo);

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
        if (normalizedAccessionNo && existingAccessions.has(normalizedAccessionNo)) {
            errors.push({ row: rowNum, bookNumber, error: "Accession number already exists" });
            continue;
        }

        validBooks.push(normalizeBookPayload(book));
        validBookRows.push(rowNum);
        existingNumbers.add(normalizedBookNumber);
        if (normalizedAccessionNo) {
            existingAccessions.add(normalizedAccessionNo);
        }
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
                        error: getBookConstraintMessage(rowError, "Failed to insert row"),
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
    return fetchAllBooks();
}

/**
 * Fetch all books by paging through Supabase's max-rows limit (commonly 1000).
 * Prefer this only for screens that truly need the full dataset.
 */
export async function fetchAllBooks(pageSize = 1000): Promise<Book[]> {
    const effectivePageSize = Math.max(1, Math.min(1000, Math.floor(pageSize)));
    const all: Book[] = [];

    for (let offset = 0; ; offset += effectivePageSize) {
        const { data, error } = await supabase
            .from("books")
            .select("*")
            .order("title")
            .order("id")
            .range(offset, offset + effectivePageSize - 1);

        if (error) throw error;
        const batch = (data ?? []) as unknown as Book[];
        all.push(...batch);

        if (batch.length < effectivePageSize) break;
    }

    return all;
}

export async function fetchBookRecordCount(): Promise<number> {
    const { count, error } = await supabase
        .from("books")
        .select("id", { count: "exact", head: true });

    if (error) throw error;
    return count ?? 0;
}

export async function fetchAvailableBookRecordCount(): Promise<number> {
    const { count, error } = await supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .gt("available", 0);

    if (error) throw error;
    return count ?? 0;
}

export async function fetchBooksForDashboard(pageSize = 1000): Promise<Book[]> {
    const effectivePageSize = Math.max(1, Math.min(1000, Math.floor(pageSize)));
    const all: Book[] = [];

    for (let offset = 0; ; offset += effectivePageSize) {
        const { data, error } = await supabase
            .from("books")
            .select("id, title, author, category, available, total, book_number, date_of_purchase, created_at")
            .order("title")
            .order("id")
            .range(offset, offset + effectivePageSize - 1);

        if (error) throw error;
        const batch = (data ?? []) as unknown as Book[];
        all.push(...batch);

        if (batch.length < effectivePageSize) break;
    }

    return all;
}

export async function fetchBookCategories(pageSize = 1000): Promise<string[]> {
    const effectivePageSize = Math.max(1, Math.min(1000, Math.floor(pageSize)));
    const categories = new Set<string>();

    for (let offset = 0; ; offset += effectivePageSize) {
        const { data, error } = await supabase
            .from("books")
            .select("category")
            .order("category")
            .range(offset, offset + effectivePageSize - 1);

        if (error) throw error;
        const batch = (data ?? []) as Array<Pick<Book, "category">>;

        for (const row of batch) {
            const category = sanitizeText(row.category);
            if (category) categories.add(category);
        }

        if (batch.length < effectivePageSize) break;
    }

    return ["All", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
}

export async function fetchBooksPage(params: FetchBooksPageParams): Promise<FetchBooksPageResult> {
    const page = Math.max(1, Math.floor(params.page || 1));
    const perPage = Math.max(1, Math.min(1000, Math.floor(params.perPage || 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const search = sanitizeText(params.search);
    const category = sanitizeText(params.category);
    const status = params.status || "All";
    const yearFilter = params.yearFilter || "All";
    const dateFilter = params.dateFilter || "All";

    let query = supabase
        .from("books")
        .select("*", { count: "exact" });

    if (search) {
        const escaped = search.replace(/[%_]/g, (match) => `\\${match}`);
        query = query.or([
            `title.ilike.%${escaped}%`,
            `author.ilike.%${escaped}%`,
            `isbn.ilike.%${escaped}%`,
            `book_number.ilike.%${escaped}%`,
            `category.ilike.%${escaped}%`,
        ].join(","));
    }

    if (category && category !== "All") {
        query = query.eq("category", category);
    }

    if (status === "Available") {
        query = query.gt("available", 0);
    } else if (status === "Out of Stock") {
        query = query.eq("available", 0);
    }

    if (yearFilter === "2020-2025") {
        query = query.gte("year_of_publication", 2020).lte("year_of_publication", 2025);
    } else if (yearFilter === "2015-2019") {
        query = query.gte("year_of_publication", 2015).lte("year_of_publication", 2019);
    } else if (yearFilter === "Before 2015") {
        query = query.lt("year_of_publication", 2015);
    }

    if (dateFilter === "Last 30 Days") {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        query = query.gte("date_of_purchase", since.toISOString().split("T")[0]);
    } else if (dateFilter === "Last 6 Months") {
        const since = new Date();
        since.setDate(since.getDate() - 180);
        query = query.gte("date_of_purchase", since.toISOString().split("T")[0]);
    }

    const { data, error, count } = await query
        .order("title")
        .order("id")
        .range(from, to);

    if (error) throw error;
    return { books: (data ?? []) as Book[], total: count ?? 0 };
}

export async function fetchBookByBookNumber(bookNumber: string): Promise<Book | null> {
    const normalized = typeof bookNumber === "string" ? bookNumber.trim() : "";
    if (!normalized) return null;

    const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("book_number", normalized)
        .maybeSingle();

    if (error) throw error;
    return (data as Book | null) ?? null;
}

export async function fetchAvailableBooks(limit = 3): Promise<Book[]> {
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
    const { data, error } = await supabase
        .from("books")
        .select("*")
        .gt("available", 0)
        .order("available", { ascending: false })
        .limit(safeLimit);

    if (error) throw error;
    return (data ?? []) as Book[];
}

function getMissingMagazinesMessage(error: unknown) {
    if (isMissingRelationError(error, "magazines")) {
        return "E-Resources magazines are not configured in Supabase yet. Run add_e_resources_magazines.sql in the SQL editor.";
    }

    return getErrorMessage(error, "Magazine request failed");
}

function getMagazineStorageMessage(error: unknown) {
    const message = getErrorMessage(error, "Magazine storage request failed");
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("bucket") && lowerMessage.includes("not found")) {
        return "Magazine storage bucket is not configured yet. Run add_e_resources_magazines.sql in the SQL editor.";
    }

    if (lowerMessage.includes("row-level security") || lowerMessage.includes("permission")) {
        return "You do not have permission to manage magazine files.";
    }

    return message;
}

function sanitizeFileName(fileName: string) {
    const trimmed = sanitizeText(fileName, "magazine");
    const extensionMatch = trimmed.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "pdf";
    const withoutExtension = extensionMatch
        ? trimmed.slice(0, -extensionMatch[0].length)
        : trimmed;
    const baseName = withoutExtension
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

    return `${baseName || "magazine"}.${extension}`;
}

function getMagazineStoragePath(fileUrl: string) {
    const marker = `/storage/v1/object/public/${MAGAZINES_BUCKET}/`;
    const markerIndex = fileUrl.indexOf(marker);

    if (markerIndex === -1) return "";

    const path = fileUrl.slice(markerIndex + marker.length).split("?")[0];

    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

function normalizeBookRecord(row: Partial<Book>): Book {
    return {
        id: sanitizeText(row.id),
        title: sanitizeText(row.title, "Untitled Book"),
        sub_title: sanitizeText(row.sub_title),
        author: sanitizeText(row.author, "Unknown Author"),
        author2: sanitizeText(row.author2),
        isbn: sanitizeText(row.isbn),
        category: sanitizeText(row.category),
        available: Math.max(0, sanitizeInteger(row.available, 0)),
        total: Math.max(0, sanitizeInteger(row.total, 0)),
        class_number: sanitizeText(row.class_number),
        book_number: sanitizeText(row.book_number),
        edition: sanitizeText(row.edition),
        place_of_publication: sanitizeText(row.place_of_publication),
        name_of_publication: sanitizeText(row.name_of_publication),
        year_of_publication: sanitizeInteger(row.year_of_publication, 0),
        phy_desc: sanitizeText(row.phy_desc),
        volume: sanitizeText(row.volume),
        general_note: sanitizeText(row.general_note),
        subject: sanitizeText(row.subject),
        permanent_location: sanitizeText(row.permanent_location),
        current_library: sanitizeText(row.current_library),
        location: sanitizeText(row.location),
        date_of_purchase: sanitizeText(row.date_of_purchase),
        vendor: sanitizeText(row.vendor),
        bill_number: sanitizeText(row.bill_number),
        price: sanitizeDecimal(row.price, 0),
        call_no: sanitizeText(row.call_no),
        accession_no: sanitizeText(row.accession_no),
        item_type: sanitizeText(row.item_type, "Book"),
    };
}

function normalizeKeywordFilters(keywords: string[]) {
    return Array.from(new Set(
        keywords
            .map((keyword) => sanitizeText(keyword))
            .filter((keyword) => keyword.length >= 2)
            .slice(0, 16),
    ));
}

function getOpacSearchFilter(search: string) {
    const escaped = escapePostgrestFilterValue(search);
    const filters = [
        `title.ilike.%${escaped}%`,
        `author.ilike.%${escaped}%`,
        `isbn.ilike.%${escaped}%`,
        `book_number.ilike.%${escaped}%`,
        `accession_no.ilike.%${escaped}%`,
        `category.ilike.%${escaped}%`,
        `subject.ilike.%${escaped}%`,
        `call_no.ilike.%${escaped}%`,
        `class_number.ilike.%${escaped}%`,
    ];

    if (/^(18|19|20)\d{2}$/.test(search)) {
        filters.push(`year_of_publication.eq.${search}`);
    }

    return filters.join(",");
}

function getOpacKeywordFilter(keywords: string[]) {
    return normalizeKeywordFilters(keywords)
        .flatMap((keyword) => {
            const escaped = escapePostgrestFilterValue(keyword);
            return [
                `title.ilike.%${escaped}%`,
                `author.ilike.%${escaped}%`,
                `category.ilike.%${escaped}%`,
                `subject.ilike.%${escaped}%`,
                `call_no.ilike.%${escaped}%`,
                `class_number.ilike.%${escaped}%`,
            ];
        })
        .join(",");
}

async function fetchOpacBooksPageFallback(
    params: Required<Pick<FetchOpacBooksPageParams, "page" | "perPage">> & FetchOpacBooksPageParams,
): Promise<FetchOpacBooksPageResult> {
    const page = Math.max(1, Math.floor(params.page || 1));
    const perPage = Math.max(1, Math.min(50, Math.floor(params.perPage || 12)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const search = sanitizeText(params.search);
    const keywordFilter = getOpacKeywordFilter(params.programmeKeywords ?? []);

    let query = supabase
        .from("books")
        .select("*", { count: "exact" });

    if (search) {
        query = query.or(getOpacSearchFilter(search));
    }

    if (keywordFilter) {
        query = query.or(keywordFilter);
    }

    if (params.availableOnly) {
        query = query.gt("available", 0);
    }

    if (Number.isFinite(params.yearStart)) {
        query = query.gte("year_of_publication", params.yearStart as number);
    }

    if (Number.isFinite(params.yearEnd)) {
        query = query.lte("year_of_publication", params.yearEnd as number);
    }

    const { data, error, count } = await query
        .order("title")
        .order("id")
        .range(from, to);

    if (error) throw error;

    return {
        books: ((data ?? []) as Partial<Book>[]).map(normalizeBookRecord),
        total: count ?? 0,
        source: "fallback",
    };
}

export async function fetchOpacBooksPage(params: FetchOpacBooksPageParams): Promise<FetchOpacBooksPageResult> {
    const page = Math.max(1, Math.floor(params.page || 1));
    const perPage = Math.max(1, Math.min(50, Math.floor(params.perPage || 12)));
    const pageOffset = (page - 1) * perPage;
    const keywords = normalizeKeywordFilters(params.programmeKeywords ?? []);

    const { data, error } = await supabase.rpc("search_opac_books", {
        p_search_text: sanitizeText(params.search),
        p_programme_keywords: keywords,
        p_year_start: Number.isFinite(params.yearStart) ? params.yearStart : null,
        p_year_end: Number.isFinite(params.yearEnd) ? params.yearEnd : null,
        p_available_only: Boolean(params.availableOnly),
        p_page_limit: perPage,
        p_page_offset: pageOffset,
    });

    if (error) {
        if (isMissingFunctionError(error, "search_opac_books")) {
            return fetchOpacBooksPageFallback({ ...params, page, perPage });
        }

        throw error;
    }

    const rows = (data ?? []) as Array<Partial<Book> & { total_count?: number | string }>;

    return {
        books: rows.map((row) => normalizeBookRecord(row)),
        total: rows.length > 0 ? sanitizeInteger(rows[0].total_count, rows.length) : 0,
        source: "rpc",
    };
}

function getProgrammeSortKey(programme: Pick<AcademicProgramme, "school" | "department">) {
    return `${sanitizeText(programme.school).toLowerCase()}|${sanitizeText(programme.department).toLowerCase()}`;
}

function sortAcademicProgrammes(programmes: AcademicProgramme[]) {
    const order = new Map(
        ACADEMIC_PROGRAMMES.map((programme, index) => [getProgrammeSortKey(programme), index]),
    );

    return [...programmes].sort((a, b) => {
        const aOrder = order.get(getProgrammeSortKey(a)) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = order.get(getProgrammeSortKey(b)) ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return `${a.school} ${a.department}`.localeCompare(`${b.school} ${b.department}`);
    });
}

export async function fetchAcademicProgrammes(): Promise<AcademicProgramme[]> {
    const { data, error } = await supabase
        .from("academic_programmes")
        .select("id, school, department, sheet_name, unique_titles, total_copies, is_general_reference")
        .order("school")
        .order("department");

    if (error) {
        if (isMissingRelationError(error, "academic_programmes")) {
            return ACADEMIC_PROGRAMMES;
        }

        throw error;
    }

    const programmes = (data ?? []) as AcademicProgramme[];
    return programmes.length > 0 ? sortAcademicProgrammes(programmes) : ACADEMIC_PROGRAMMES;
}

async function fetchFallbackBookRecommendations(params: {
    school: string;
    department: string;
    limit: number;
}): Promise<ProgrammeBook[]> {
    const keywords = getProgrammeRecommendationKeywords(params.school, params.department).slice(0, 6);
    if (keywords.length === 0) return [];

    const orFilter = keywords.flatMap((keyword) => {
        const escaped = escapePostgrestPattern(keyword);
        return [
            `category.ilike.%${escaped}%`,
            `subject.ilike.%${escaped}%`,
            `title.ilike.%${escaped}%`,
        ];
    }).join(",");

    const { data, error } = await supabase
        .from("books")
        .select("id, title, author, isbn, category, subject, call_no, available, accession_no")
        .gt("available", 0)
        .or(orFilter)
        .order("available", { ascending: false })
        .order("title")
        .limit(params.limit);

    if (error) throw error;

    return ((data ?? []) as Book[]).map((book, index) => ({
        id: book.id,
        school: params.school,
        department: params.department,
        sheet_name: "books",
        sort_order: index + 1,
        title: sanitizeText(book.title, "Untitled Book"),
        author: sanitizeText(book.author, "Unknown Author"),
        isbn: sanitizeText(book.isbn),
        call_no: sanitizeText(book.call_no),
        subject: sanitizeText(book.subject, sanitizeText(book.category, "General")),
        copies: Math.max(0, sanitizeInteger(book.available, 0)),
        accession_numbers: sanitizeText(book.accession_no),
    }));
}

export async function fetchProgrammeBookRecommendations(params: {
    school?: string;
    department?: string;
    limit?: number;
}): Promise<ProgrammeBook[]> {
    const school = sanitizeText(params.school);
    const department = sanitizeText(params.department);
    const safeLimit = Math.max(1, Math.min(50, Math.floor(params.limit || 10)));

    if (!school || !department) return [];

    const { data, error } = await supabase
        .from("programme_books")
        .select("id, school, department, sheet_name, sort_order, title, author, isbn, call_no, subject, copies, accession_numbers")
        .eq("school", school)
        .eq("department", department)
        .gt("copies", 0)
        .order("sort_order", { ascending: true })
        .limit(safeLimit);

    if (error) {
        if (isMissingRelationError(error, "programme_books")) {
            return fetchFallbackBookRecommendations({ school, department, limit: safeLimit });
        }

        throw error;
    }

    const programmeBooks = (data ?? []) as ProgrammeBook[];
    if (programmeBooks.length > 0) return programmeBooks;

    return fetchFallbackBookRecommendations({ school, department, limit: safeLimit });
}

export async function addBook(book: Omit<Book, "id">): Promise<Book> {
    const normalizedBook = normalizeUploadBook(book);
    await validateBookForSave(normalizedBook);
    const payload = normalizeBookPayload(normalizedBook);

    const { data, error } = await supabase
        .from("books")
        .insert(payload)
        .select()
        .single();
    if (error) throw new Error(getBookConstraintMessage(error, "Failed to add book"));
    return data;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<Book> {
    const { data: existingBook, error: existingBookError } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

    if (existingBookError) throw existingBookError;

    await validateBookForSave({ ...(existingBook as Book), ...updates }, id);
    const payload = normalizeBookPayload(updates);

    const { data, error } = await supabase
        .from("books")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    if (error) throw new Error(getBookConstraintMessage(error, "Failed to update book"));
    return data;
}

export async function deleteBook(id: string): Promise<void> {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
}

// ─── Issued Books ───────────────────────────────────────

// Magazines

export interface UploadMagazineInput {
    title: string;
    category?: string;
    file: File;
}

export async function fetchMagazines(): Promise<Magazine[]> {
    const { data, error } = await supabase
        .from("magazines")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw new Error(getMissingMagazinesMessage(error));
    return (data ?? []) as Magazine[];
}

export async function uploadMagazine(input: UploadMagazineInput): Promise<Magazine> {
    const title = sanitizeText(input.title);
    const category = sanitizeText(input.category, "General");

    if (!title) throw new Error("Magazine title is required");
    if (!input.file) throw new Error("Magazine file is required");

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Please sign in to upload magazines");

    const uploadedAt = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = sanitizeFileName(input.file.name);
    const storagePath = `${user.id}/${uploadedAt}-${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(MAGAZINES_BUCKET)
        .upload(storagePath, input.file, {
            cacheControl: "3600",
            contentType: input.file.type || undefined,
            upsert: false,
        });

    if (uploadError) throw new Error(getMagazineStorageMessage(uploadError));

    const { data: publicUrlData } = supabase.storage
        .from(MAGAZINES_BUCKET)
        .getPublicUrl(storagePath);

    const fileUrl = publicUrlData.publicUrl;

    const { data, error } = await supabase
        .from("magazines")
        .insert({
            title,
            category,
            uploaded_by: user.id,
            file_url: fileUrl,
        })
        .select()
        .single();

    if (error) {
        await supabase.storage.from(MAGAZINES_BUCKET).remove([storagePath]);
        throw new Error(getMissingMagazinesMessage(error));
    }

    return data as Magazine;
}

export async function deleteMagazine(id: string): Promise<void> {
    const magazineId = sanitizeText(id);
    if (!magazineId) throw new Error("Magazine id is required");

    const { data: magazine, error: fetchError } = await supabase
        .from("magazines")
        .select("file_url")
        .eq("id", magazineId)
        .maybeSingle();

    if (fetchError) throw new Error(getMissingMagazinesMessage(fetchError));
    if (!magazine) throw new Error("Magazine not found");

    const storagePath = getMagazineStoragePath(String(magazine.file_url ?? ""));
    if (storagePath) {
        const { error: removeError } = await supabase.storage
            .from(MAGAZINES_BUCKET)
            .remove([storagePath]);

        if (removeError) throw new Error(getMagazineStorageMessage(removeError));
    }

    const { error } = await supabase
        .from("magazines")
        .delete()
        .eq("id", magazineId);

    if (error) throw new Error(getMissingMagazinesMessage(error));
}

// Issued Books

export async function fetchIssuedBooks(): Promise<IssuedBook[]> {
    const { data, error } = await supabase
        .from("issued_books")
        .select("*")
        .order("issue_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

async function fetchProfileByEmail(email: string): Promise<UserProfile | null> {
    const normalizedEmail = sanitizeText(email).toLowerCase();
    if (!normalizedEmail) return null;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (error) return null;
    return data;
}

export async function fetchIssuedBooksByStudent(
    studentLookup: string | { id?: string; regNo?: string; email?: string },
): Promise<IssuedBook[]> {
    const lookup =
        typeof studentLookup === "string"
            ? { id: studentLookup }
            : studentLookup;

    const directId = sanitizeText(lookup.id);
    const directRegNo = sanitizeText(lookup.regNo);
    const directEmail = sanitizeText(lookup.email).toLowerCase();

    const matchedProfiles = new Map<string, UserProfile>();

    const addProfile = (profile: UserProfile | null) => {
        if (!profile?.id) return;
        matchedProfiles.set(profile.id, profile);
    };

    addProfile(directId ? await fetchProfile(directId) : null);
    addProfile(directRegNo ? await fetchProfile(directRegNo) : null);
    addProfile(directEmail ? await fetchProfileByEmail(directEmail) : null);

    const candidateStudentIds = Array.from(new Set([
        directId,
        directRegNo,
        ...Array.from(matchedProfiles.values()).flatMap((profile) => [
            sanitizeText(profile.id),
            sanitizeText(profile.reg_no),
        ]),
    ].filter(Boolean)));

    const candidateEmails = Array.from(new Set([
        directEmail,
        ...Array.from(matchedProfiles.values()).map((profile) => sanitizeText(profile.email).toLowerCase()),
    ].filter(Boolean)));

    if (candidateStudentIds.length === 0 && candidateEmails.length === 0) {
        return [];
    }

    const issueQueries = [];

    if (candidateStudentIds.length > 0) {
        issueQueries.push(
            supabase
                .from("issued_books")
                .select("*")
                .in("student_id", candidateStudentIds)
                .order("issue_date", { ascending: false }),
        );
    }

    if (candidateEmails.length > 0) {
        issueQueries.push(
            supabase
                .from("issued_books")
                .select("*")
                .in("student_email", candidateEmails)
                .order("issue_date", { ascending: false }),
        );
    }

    const responses = await Promise.all(issueQueries);
    const mergedIssues = new Map<string, IssuedBook>();

    for (const response of responses) {
        if (response.error) {
            const missingColumns = getMissingIssuedBookColumns(response.error.message || "");
            if (missingColumns.includes("student_email") && candidateStudentIds.length > 0) {
                continue;
            }

            throw response.error;
        }

        for (const issue of response.data ?? []) {
            mergedIssues.set(issue.id, issue as IssuedBook);
        }
    }

    return Array
        .from(mergedIssues.values())
        .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
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

async function fetchActiveIssuedCount(bookId: string) {
    const { count, error } = await supabase
        .from("issued_books")
        .select("id", { count: "exact", head: true })
        .eq("book_id", bookId)
        .in("status", ["issued", "overdue"]);

    if (error) throw error;
    return count ?? 0;
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

function getMissingIssuedBookColumns(errorMessage: string): Array<"student_email"> {
    const lowerMessage = errorMessage.toLowerCase();
    const missing: Array<"student_email"> = [];

    const mentionsStudentEmail =
        lowerMessage.includes("student_email") ||
        lowerMessage.includes("'student_email'") ||
        lowerMessage.includes("\"student_email\"");

    const indicatesMissingColumn =
        lowerMessage.includes("does not exist") ||
        lowerMessage.includes("could not find") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("unknown column");

    if (mentionsStudentEmail && indicatesMissingColumn) {
        missing.push("student_email");
    }

    return missing;
}

export interface ReturnQualityCheck {
    status: NonNullable<IssuedBook["return_quality_status"]>;
    notes?: string;
    checklist: NonNullable<IssuedBook["return_quality_checklist"]>;
}

export async function issueBook(issue: Omit<IssuedBook, "id">): Promise<IssuedBook> {
    const bookId = typeof issue.book_id === "string" ? issue.book_id.trim() : "";
    if (!bookId) throw new Error("Book is required to issue");

    let previousAvailable = 0;
    let nextAvailable = 0;
    let decremented = false;

    for (let attempt = 0; attempt < 3; attempt++) {
        const inventory = await fetchBookInventory(bookId);
        const activeIssues = await fetchActiveIssuedCount(bookId);
        const computedAvailable = Math.max(inventory.total - activeIssues, 0);
        const effectiveAvailable = Math.min(inventory.available, computedAvailable);

        if (effectiveAvailable <= 0) throw new Error("No copies available to issue");

        previousAvailable = inventory.available;
        nextAvailable = effectiveAvailable - 1;

        const updated = await updateBookAvailableOptimistically(bookId, previousAvailable, nextAvailable);
        if (updated) {
            decremented = true;
            break;
        }
    }

    if (!decremented) throw new Error("Book availability changed. Please try again.");

    const matchedProfile = await fetchProfile(issue.student_id);
    const resolvedStudentId = sanitizeText(matchedProfile?.reg_no, sanitizeText(issue.student_id));
    const resolvedStudentEmail = sanitizeText(issue.student_email, sanitizeText(matchedProfile?.email)).toLowerCase();
    const insertPayload: Record<string, unknown> = {
        ...issue,
        student_id: resolvedStudentId,
        student_email: resolvedStudentEmail || null,
    };

    let data: IssuedBook | null = null;
    let error: unknown = null;
    const dbSafeInsertPayload: Record<string, unknown> = { ...insertPayload };

    while (true) {
        const response = await supabase
            .from("issued_books")
            .insert(dbSafeInsertPayload)
            .select()
            .single();

        if (!response.error) {
            data = response.data as IssuedBook;
            break;
        }

        error = response.error;
        const missingColumns = getMissingIssuedBookColumns(response.error.message || "");
        if (missingColumns.length === 0) {
            break;
        }

        let removedAnyColumn = false;
        for (const missingColumn of missingColumns) {
            if (!(missingColumn in dbSafeInsertPayload)) continue;
            delete dbSafeInsertPayload[missingColumn];
            removedAnyColumn = true;
        }

        if (!removedAnyColumn) {
            break;
        }
    }

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

    return data as IssuedBook;
}

export async function returnBook(id: string, qualityCheck?: ReturnQualityCheck): Promise<IssuedBook> {
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

    const updatePayload: Record<string, unknown> = {
        status: "returned",
        return_date: returnDate,
    };

    if (qualityCheck) {
        updatePayload.return_quality_status = qualityCheck.status;
        updatePayload.return_quality_notes = sanitizeText(qualityCheck.notes);
        updatePayload.return_quality_checked_at = new Date().toISOString();
        updatePayload.return_quality_checklist = qualityCheck.checklist;
    }

    let returnedIssue: IssuedBook | null = null;
    let error: unknown = null;
    const dbSafeUpdatePayload: Record<string, unknown> = { ...updatePayload };

    while (true) {
        const response = await supabase
            .from("issued_books")
            .update(dbSafeUpdatePayload)
            .eq("id", id)
            .eq("status", previousStatus)
            .select()
            .single();

        if (!response.error) {
            returnedIssue = response.data as IssuedBook;
            break;
        }

        error = response.error;
        const lowerMessage = response.error.message?.toLowerCase() || "";
        const qualityColumnsMissing =
            (lowerMessage.includes("return_quality_status") ||
                lowerMessage.includes("return_quality_notes") ||
                lowerMessage.includes("return_quality_checked_at") ||
                lowerMessage.includes("return_quality_checklist")) &&
            (lowerMessage.includes("does not exist") ||
                lowerMessage.includes("could not find") ||
                lowerMessage.includes("schema cache") ||
                lowerMessage.includes("unknown column"));

        if (!qualityColumnsMissing || !qualityCheck) {
            break;
        }

        delete dbSafeUpdatePayload.return_quality_status;
        delete dbSafeUpdatePayload.return_quality_notes;
        delete dbSafeUpdatePayload.return_quality_checked_at;
        delete dbSafeUpdatePayload.return_quality_checklist;
        qualityCheck = undefined;
    }

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

    return returnedIssue as IssuedBook;
}

// ─── Profiles ───────────────────────────────────────────

function getMissingReservationsTableMessage(error: unknown) {
    if (isMissingRelationError(error, "book_reservations")) {
        return "Book reservations are not configured in Supabase yet. Run add_book_reservations.sql in the SQL editor.";
    }

    return getErrorMessage(error, "Reservation request failed");
}

export async function fetchBookReservations(): Promise<BookReservation[]> {
    const { data, error } = await supabase
        .from("book_reservations")
        .select("*")
        .order("requested_at", { ascending: false });

    if (error) throw new Error(getMissingReservationsTableMessage(error));
    return (data ?? []) as BookReservation[];
}

export async function fetchBookReservationsByStudent(studentUserId: string): Promise<BookReservation[]> {
    const normalizedStudentId = sanitizeText(studentUserId);
    if (!normalizedStudentId) return [];

    const { data, error } = await supabase
        .from("book_reservations")
        .select("*")
        .eq("student_user_id", normalizedStudentId)
        .order("requested_at", { ascending: false });

    if (error) throw new Error(getMissingReservationsTableMessage(error));
    return (data ?? []) as BookReservation[];
}

export async function createBookReservation(book: Book): Promise<BookReservation> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Please sign in to reserve books");

    const profile = await fetchProfile(user.id);
    const studentName =
        sanitizeText(profile?.name) ||
        sanitizeText(user.user_metadata?.name) ||
        sanitizeText(user.email?.split("@")[0]) ||
        "Library Member";
    const studentEmail = sanitizeText(profile?.email, sanitizeText(user.email)).toLowerCase();
    const studentRegNo = sanitizeText(profile?.reg_no, sanitizeText(user.user_metadata?.reg_no));

    const existing = await supabase
        .from("book_reservations")
        .select("*")
        .eq("student_user_id", user.id)
        .eq("book_id", book.id)
        .in("status", ["pending", "approved"])
        .maybeSingle();

    if (existing.error) throw new Error(getMissingReservationsTableMessage(existing.error));
    if (existing.data) return existing.data as BookReservation;

    const payload = {
        book_id: book.id,
        book_title: sanitizeText(book.title, "Untitled Book"),
        book_author: sanitizeText(book.author),
        book_number: sanitizeText(book.book_number),
        accession_no: sanitizeText(book.accession_no),
        student_user_id: user.id,
        student_name: studentName,
        student_email: studentEmail,
        student_reg_no: studentRegNo || null,
        status: "pending" as BookReservationStatus,
    };

    const { data, error } = await supabase
        .from("book_reservations")
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(getMissingReservationsTableMessage(error));
    return data as BookReservation;
}

export async function updateBookReservationStatus(
    reservationId: string,
    status: Exclude<BookReservationStatus, "pending">,
    notes = "",
): Promise<BookReservation> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Please sign in to update reservations");

    const payload: Partial<BookReservation> = {
        status,
        notes: sanitizeText(notes),
        processed_by: user.id,
        processed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from("book_reservations")
        .update(payload)
        .eq("id", reservationId)
        .select()
        .single();

    if (error) throw new Error(getMissingReservationsTableMessage(error));
    return data as BookReservation;
}

export async function cancelBookReservation(reservationId: string): Promise<BookReservation> {
    const { data, error } = await supabase
        .from("book_reservations")
        .update({ status: "cancelled", processed_at: new Date().toISOString() })
        .eq("id", reservationId)
        .eq("status", "pending")
        .select()
        .single();

    if (error) throw new Error(getMissingReservationsTableMessage(error));
    return data as BookReservation;
}

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

    const lookupColumn = identifier.includes("@")
        ? "email"
        : looksLikeUuid(identifier)
            ? "id"
            : "reg_no";
    const lookupValue = lookupColumn === "email" ? identifier.toLowerCase() : identifier;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq(lookupColumn, lookupValue)
        .maybeSingle();

    if (error) return null;
    return data;
}

type NotificationLookup = {
    id?: string;
    regNo?: string;
    email?: string;
};

function getMissingNotificationsTableMessage(error: unknown) {
    if (isMissingRelationError(error, "notifications")) {
        return "Notifications are not configured in Supabase yet. Run supabase_add_notifications_table.sql in the SQL editor.";
    }

    return getErrorMessage(error, "Failed to load notifications");
}

async function fetchNotificationProfiles(lookup: NotificationLookup): Promise<UserProfile[]> {
    const matchedProfiles = new Map<string, UserProfile>();

    const addProfile = (profile: UserProfile | null) => {
        if (!profile?.id) return;
        matchedProfiles.set(profile.id, profile);
    };

    addProfile(lookup.id ? await fetchProfile(lookup.id) : null);
    addProfile(lookup.regNo ? await fetchProfile(lookup.regNo) : null);
    addProfile(lookup.email ? await fetchProfileByEmail(lookup.email) : null);

    return Array.from(matchedProfiles.values());
}

export async function fetchNotificationsForStudent(
    studentLookup: string | NotificationLookup,
): Promise<LibraryNotification[]> {
    const lookup = typeof studentLookup === "string" ? { id: studentLookup } : studentLookup;
    const profiles = await fetchNotificationProfiles(lookup);

    const candidateRecipientIds = Array.from(new Set([
        sanitizeText(lookup.id),
        ...profiles.map((profile) => sanitizeText(profile.id)),
    ].filter(Boolean)));

    if (candidateRecipientIds.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .in("recipient_id", candidateRecipientIds)
        .order("created_at", { ascending: false });

    if (error) throw new Error(getMissingNotificationsTableMessage(error));
    return (data ?? []) as LibraryNotification[];
}

export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(notificationIds.map((id) => sanitizeText(id)).filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", uniqueIds);

    if (error) throw new Error(getMissingNotificationsTableMessage(error));
}

type ProfileMetadataFallbackColumn = "contact_number" | "reg_no" | "school" | "department";

function getMissingProfileColumns(errorMessage: string): ProfileMetadataFallbackColumn[] {
    const lowerMessage = errorMessage.toLowerCase();
    const missing: ProfileMetadataFallbackColumn[] = [];

    const isMissingColumnError = (columnName: ProfileMetadataFallbackColumn) => {
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

    if (isMissingColumnError("school")) {
        missing.push("school");
    }

    if (isMissingColumnError("department")) {
        missing.push("department");
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

export async function updateStudentAcademicProfile(
    userId: string,
    updates: Pick<UserProfile, "school" | "department">,
): Promise<UserProfile> {
    const school = sanitizeText(updates.school);
    const department = sanitizeText(updates.department);

    if (!school) throw new Error("School is required");
    if (!department) throw new Error("Department is required");

    const updatedProfile = await updateProfile(userId, { school, department });
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id === userId) {
        await supabase.auth.updateUser({
            data: {
                ...user.user_metadata,
                school,
                department,
            },
        });
    }

    return {
        ...updatedProfile,
        school,
        department,
    };
}
