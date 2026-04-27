import { z } from "zod";

export interface Book {
    id: string;
    title: string;
    sub_title: string;
    author: string;
    author2: string;
    isbn: string;
    category: string;
    available: number;
    total: number;
    class_number: string;
    book_number: string;
    edition: string;
    place_of_publication: string;
    name_of_publication: string;
    year_of_publication: number;
    phy_desc: string;
    volume: string;
    general_note: string;
    subject: string;
    permanent_location: string;
    current_library: string;
    location: string;
    date_of_purchase: string;
    vendor: string;
    bill_number: string;
    price: number;
    call_no: string;
    accession_no: string;
    item_type: string;
}

export interface IssuedBook {
    id: string;
    book_id: string;
    book_title: string;
    student_name: string;
    student_id: string;
    student_email?: string;
    issue_date: string;
    due_date: string;
    return_date?: string;
    status: "issued" | "returned" | "overdue";
    return_quality_status?: "excellent" | "good" | "minor_damage" | "damaged";
    return_quality_notes?: string;
    return_quality_checked_at?: string;
    return_quality_checklist?: {
        coverIntact: boolean;
        pagesIntact: boolean;
        bindingIntact: boolean;
        cleanPages: boolean;
    };
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: "admin" | "librarian" | "student" | "faculty";
    department?: string;
    contact_number?: string;
    reg_no?: string;
    join_date: string;
}

// Validation schema for profile updates
export const profileUpdateSchema = z.object({
    department: z.string().trim().max(100, "Department must be less than 100 characters"),
    contact_number: z.string()
        .trim()
        .max(15, "Contact number must be less than 15 characters")
        .refine((value) => value === "" || /^[+]?[\d\s-()]{10,15}$/.test(value), "Please enter a valid phone number"),
    reg_no: z.string()
        .trim()
        .max(30, "Reg No must be less than 30 characters")
        .refine((value) => value === "" || /^[A-Za-z0-9/-]+$/.test(value), "Reg No can contain letters, numbers, - and /")
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
