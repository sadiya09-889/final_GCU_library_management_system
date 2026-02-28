import { supabase } from "./supabase";
import type { Book, IssuedBook, UserProfile } from "./types";

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
    const { data, error } = await supabase
        .from("books")
        .insert(book)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<Book> {
    const { data, error } = await supabase
        .from("books")
        .update(updates)
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
