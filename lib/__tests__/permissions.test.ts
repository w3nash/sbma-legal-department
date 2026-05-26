import { describe, it, expect } from "vitest";
import {
  canViewCase,
  canUploadToCase,
  canDownloadDocument,
  canManageCase,
  canManageUsers,
} from "../permissions";
import { UserRole, MembershipRole } from "../constants";

describe("permissions", () => {
  it("admin can view any case", () => {
    expect(canViewCase({ role: UserRole.Admin }, null)).toBe(true);
  });
  it("member cannot view unassigned case", () => {
    expect(canViewCase({ role: UserRole.Member }, null)).toBe(false);
  });
  it("member with active membership can view case", () => {
    expect(
      canViewCase({ role: UserRole.Member }, { role: MembershipRole.Viewer })
    ).toBe(true);
  });
  it("admin can upload to any case", () => {
    expect(canUploadToCase({ role: UserRole.Admin }, null)).toBe(true);
  });
  it("viewer cannot upload", () => {
    expect(
      canUploadToCase(
        { role: UserRole.Member },
        { role: MembershipRole.Viewer }
      )
    ).toBe(false);
  });
  it("uploader can upload", () => {
    expect(
      canUploadToCase(
        { role: UserRole.Member },
        { role: MembershipRole.Uploader }
      )
    ).toBe(true);
  });
  it("member without membership cannot upload to case", () => {
    expect(canUploadToCase({ role: UserRole.Member }, null)).toBe(false);
  });
  it("admin can download any document", () => {
    expect(canDownloadDocument({ role: UserRole.Admin }, null)).toBe(true);
  });
  it("viewer cannot download document", () => {
    expect(
      canDownloadDocument(
        { role: UserRole.Member },
        { role: MembershipRole.Viewer }
      )
    ).toBe(false);
  });
  it("uploader can download document", () => {
    expect(
      canDownloadDocument(
        { role: UserRole.Member },
        { role: MembershipRole.Uploader }
      )
    ).toBe(true);
  });
  it("member without membership cannot download document", () => {
    expect(canDownloadDocument({ role: UserRole.Member }, null)).toBe(false);
  });
  it("admin can manage case", () => {
    expect(canManageCase({ role: UserRole.Admin })).toBe(true);
  });
  it("member cannot manage case", () => {
    expect(canManageCase({ role: UserRole.Member })).toBe(false);
  });
  it("admin can manage users", () => {
    expect(canManageUsers({ role: UserRole.Admin })).toBe(true);
  });
  it("member cannot manage users", () => {
    expect(canManageUsers({ role: UserRole.Member })).toBe(false);
  });
});
