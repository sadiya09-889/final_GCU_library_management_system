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
    issue_date: string;
    due_date: string;
    return_date?: string;
    status: "issued" | "returned" | "overdue";
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: "admin" | "librarian" | "student";
    department?: string;
    contact_number?: string;
    join_date: string;
}

// Validation schema for profile updates
export const profileUpdateSchema = z.object({
    department: z.string().min(1, "Department is required").max(100, "Department must be less than 100 characters"),
    contact_number: z.string()
        .min(1, "Contact number is required")
        .regex(/^[+]?[\d\s\-\(\)]{10,15}$/, "Please enter a valid phone number")
        .max(15, "Contact number must be less than 15 characters")
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
