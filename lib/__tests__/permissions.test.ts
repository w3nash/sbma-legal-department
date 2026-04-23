import { describe, it, expect } from "vitest";
import {
  canViewCase,
  canUploadToCase,
  canDownloadDocument,
  canManageCase,
  canManageUsers,
} from "../permissions";

describe("permissions", () => {
  it("admin can view any case", () => {
    expect(canViewCase({ role: "admin" }, null)).toBe(true);
  });
  it("member cannot view unassigned case", () => {
    expect(canViewCase({ role: "member" }, null)).toBe(false);
  });
  it("member with active membership can view case", () => {
    expect(canViewCase({ role: "member" }, { role: "viewer" })).toBe(true);
  });
  it("admin can upload to any case", () => {
    expect(canUploadToCase({ role: "admin" }, null)).toBe(true);
  });
  it("viewer cannot upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "viewer" })).toBe(false);
  });
  it("uploader can upload", () => {
    expect(canUploadToCase({ role: "member" }, { role: "uploader" })).toBe(true);
  });
  it("member without membership cannot upload to case", () => {
    expect(canUploadToCase({ role: "member" }, null)).toBe(false);
  });
  it("admin can download any document", () => {
    expect(canDownloadDocument({ role: "admin" }, null)).toBe(true);
  });
  it("member with membership can download document", () => {
    expect(canDownloadDocument({ role: "member" }, { role: "viewer" })).toBe(true);
  });
  it("member without membership cannot download document", () => {
    expect(canDownloadDocument({ role: "member" }, null)).toBe(false);
  });
  it("admin can manage case", () => {
    expect(canManageCase({ role: "admin" })).toBe(true);
  });
  it("member cannot manage case", () => {
    expect(canManageCase({ role: "member" })).toBe(false);
  });
  it("admin can manage users", () => {
    expect(canManageUsers({ role: "admin" })).toBe(true);
  });
  it("member cannot manage users", () => {
    expect(canManageUsers({ role: "member" })).toBe(false);
  });
});
