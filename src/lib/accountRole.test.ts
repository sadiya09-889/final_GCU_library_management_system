import { describe, expect, it } from "vitest";
import { inferUserRole } from "./accountRole";

describe("account role resolution", () => {
  it("resolves reg_no + requested faculty as student", () => {
    expect(inferUserRole({
      currentRole: undefined,
      email: "teacher@example.com",
      regNo: "23BTRE101",
      requestedRole: "faculty",
    })).toBe("student");
  });

  it("resolves reg_no + no role as student", () => {
    expect(inferUserRole({
      regNo: "23BTRE101",
    })).toBe("student");
  });

  it("resolves requested faculty + personal email + no reg_no as faculty", () => {
    expect(inferUserRole({
      email: "faculty@gmail.com",
      requestedRole: "faculty",
    })).toBe("faculty");
  });

  it("resolves missing role + no reg_no as pending", () => {
    expect(inferUserRole({
      email: "student@gcu.edu.in",
    })).toBe("pending");
  });

  it("does not accept privileged roles (admin/librarian) from requested metadata and defaults to pending", () => {
    expect(inferUserRole({
      email: "attacker@example.com",
      requestedRole: "admin",
    })).toBe("pending");
    
    expect(inferUserRole({
      email: "attacker@example.com",
      requestedRole: "librarian",
    })).toBe("pending");
  });

  it("preserves privileged role (librarian) from profile even if regNo is present", () => {
    expect(inferUserRole({
      profileRole: "librarian",
      regNo: "LIB-001",
      requestedRole: "student",
    })).toBe("librarian");
  });

  it("preserves privileged role (admin) from profile even if regNo is present", () => {
    expect(inferUserRole({
      profileRole: "admin",
      regNo: "ADM-001",
      requestedRole: "student",
    })).toBe("admin");
  });

  it("preserves privileged role (librarian) from app metadata even if regNo is present", () => {
    expect(inferUserRole({
      appMetadataRole: "librarian",
      regNo: "LIB-001",
      requestedRole: "student",
    })).toBe("librarian");
  });

  it("preserves privileged role (admin) from app metadata even if regNo is present", () => {
    expect(inferUserRole({
      appMetadataRole: "admin",
      regNo: "ADM-001",
      requestedRole: "student",
    })).toBe("admin");
  });

  it("preserves privileged role (librarian) from currentRole even if regNo is present", () => {
    expect(inferUserRole({
      currentRole: "librarian",
      regNo: "LIB-001",
      requestedRole: "student",
    })).toBe("librarian");
  });
});
