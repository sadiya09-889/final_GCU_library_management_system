import { describe, expect, it } from "vitest";
import { calculatePenalty } from "./supabaseService";
import type { IssuedBook } from "./types";

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
});
