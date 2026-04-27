/**
 * User roles for the Case Document Management system.
 */
export const UserRole = {
  Admin: "admin",
  Member: "member",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export function formatRole(role: string): string {
  return role
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Membership roles within a case.
 */
export const MembershipRole = {
  Viewer: "viewer",
  Uploader: "uploader",
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

/**
 * Application routes.
 */
export const Route = {
  Home: "/",
  Login: "/login",
  Cases: "/cases",
  AdminUsers: "/admin/users",
  AdminUsersCreate: "/admin/users/create",
  AdminAuditLogs: "/admin/audit-logs",
  Profile: "/profile",
  ForgotPassword: "/forgot-password",
} as const;

export type Route = (typeof Route)[keyof typeof Route];
