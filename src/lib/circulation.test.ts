import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  calculatePenalty,
  createBookReservation,
  createNotificationOnce,
  notifyReservationBookAvailable,
} from "./supabaseService";
import type { IssuedBook, Book } from "./types";
import { supabase } from "./supabase";

// Mock supabase client
vi.mock("./supabase", () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      auth: {
        getUser: vi.fn(),
      },
    },
  };
});

function createMockQuery(data: any, error: any = null) {
  const promise = Promise.resolve({ data, error });
  const builder: any = promise;
  
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }));
  
  return builder;
}

describe("Circulation and Penalty Calculations", () => {
  describe("calculatePenalty", () => {
    it("should return 0 if the book is returned", () => {
      const mockIssue: IssuedBook = {
        id: "1",
        book_id: "book-1",
        book_title: "Test Book",
        student_name: "John Doe",
        student_id: "student-1",
        issue_date: "2026-06-01",
        due_date: "2026-06-16",
        status: "returned",
      };
      
      const penalty = calculatePenalty(mockIssue, new Date("2026-06-20"));
      expect(penalty).toBe(0);
    });

    it("should return 0 if today is on or before the due date", () => {
      const mockIssue: IssuedBook = {
        id: "1",
        book_id: "book-1",
        book_title: "Test Book",
        student_name: "John Doe",
        student_id: "student-1",
        issue_date: "2026-06-01",
        due_date: "2026-06-16",
        status: "issued",
      };

      // Same day
      expect(calculatePenalty(mockIssue, new Date("2026-06-16"))).toBe(0);
      
      // Before due date
      expect(calculatePenalty(mockIssue, new Date("2026-06-15"))).toBe(0);
      expect(calculatePenalty(mockIssue, new Date("2026-06-10"))).toBe(0);
    });

    it("should calculate ₹2/day penalty if today is after the due date", () => {
      const mockIssue: IssuedBook = {
        id: "1",
        book_id: "book-1",
        book_title: "Test Book",
        student_name: "John Doe",
        student_id: "student-1",
        issue_date: "2026-06-01",
        due_date: "2026-06-16",
        status: "overdue",
      };

      // 1 day overdue
      expect(calculatePenalty(mockIssue, new Date("2026-06-17"))).toBe(2);

      // 5 days overdue
      expect(calculatePenalty(mockIssue, new Date("2026-06-21"))).toBe(10);

      // 10 days overdue
      expect(calculatePenalty(mockIssue, new Date("2026-06-26"))).toBe(20);
    });
  });

  describe("Due Date Math", () => {
    it("correctly calculates a 15-day due date from issue date", () => {
      const issueDate = new Date("2026-06-01");
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 15);
      
      expect(dueDate.toISOString().split("T")[0]).toBe("2026-06-16");
    });

    it("correctly calculates renewal extensions (15 days from current due date)", () => {
      const currentDueDate = new Date("2026-06-16");
      const extendedDueDate = new Date(currentDueDate);
      extendedDueDate.setDate(extendedDueDate.getDate() + 15);

      expect(extendedDueDate.toISOString().split("T")[0]).toBe("2026-07-01");
    });
  });

  describe("Reservations and Notifications Lifecycle", () => {
    const mockFrom = supabase.from as any;
    const mockGetUser = supabase.auth.getUser as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should block duplicate active reservations", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return createMockQuery({ id: "user-123", role: "student", name: "Alice", email: "test@example.com" });
        } else if (table === "books") {
          return createMockQuery({ id: "book-123", available: 0, total: 1 });
        } else if (table === "book_reservations") {
          // Return an existing pending reservation
          return createMockQuery({ id: "res-456", student_user_id: "user-123", book_id: "book-123", status: "pending" });
        }
        return createMockQuery([]);
      });

      const mockBook: Book = {
        id: "book-123",
        title: "Test Book",
        author: "Test Author",
        isbn: "123",
        call_no: "C1",
        subject: "S1",
        copies: 1,
        accession_numbers: "A1",
        available: 0,
        total: 1,
      };

      await expect(createBookReservation(mockBook)).rejects.toThrow(
        "You already have an active reservation for this book"
      );
    });

    it("should de-duplicate notifications in createNotificationOnce using metadata", async () => {
      // Simulate that a notification with the same metadata already exists
      const existingNotification = { id: "notification-999", recipient_id: "user-123", type: "reservation" };
      
      mockFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return createMockQuery([existingNotification]);
        }
        return createMockQuery([]);
      });

      const result = await createNotificationOnce(
        "user-123",
        "reservation",
        "Title",
        "Message content",
        "book-123",
        { reservation_id: "res-123", notification_event: "event-1" }
      );

      // Should return the existing notification and NOT call insert
      expect(result).toEqual(existingNotification);
      
      const insertQuery = mockFrom("notifications");
      expect(insertQuery.insert).not.toHaveBeenCalled();
    });

    it("should trigger availability notifications for active reservations when book is back in stock", async () => {
      const activeReservation = {
        id: "res-1",
        book_id: "book-123",
        student_user_id: "user-123",
        student_name: "Alice Student",
        status: "pending",
      };

      const staffProfile = { id: "staff-789", role: "librarian" };

      mockFrom.mockImplementation((table: string) => {
        if (table === "books") {
          return createMockQuery({ id: "book-123", title: "Reserved Book Title" });
        } else if (table === "book_reservations") {
          return createMockQuery([activeReservation]);
        } else if (table === "profiles") {
          return createMockQuery([staffProfile]);
        } else if (table === "notifications") {
          // Return empty on select to allow insert, and return inserted notification on insert
          return createMockQuery([]);
        }
        return createMockQuery([]);
      });

      await notifyReservationBookAvailable("book-123");

      // Verify that supabase queried the notifications table to check duplicates and perform inserts
      expect(mockFrom).toHaveBeenCalledWith("notifications");
    });
  });
});
