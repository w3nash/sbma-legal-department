import { UserRole, MembershipRole } from "./constants";

export interface UserContext {
  role: UserRole;
}

export interface MembershipContext {
  role: MembershipRole;
}

/**
 * Determines whether a user is allowed to view a case.
 * Admins can view any case; members need an active membership.
 */
export function canViewCase(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === UserRole.Admin) return true;
  return membership !== null;
}

/**
 * Determines whether a user is allowed to upload documents to a case.
 * Admins can upload to any case; members need an uploader membership.
 */
export function canUploadToCase(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === UserRole.Admin) return true;
  return membership?.role === MembershipRole.Uploader;
}

/**
 * Determines whether a user is allowed to download a document.
 * Admins can download any document; members need an active membership.
 */
export function canDownloadDocument(
  user: UserContext,
  membership: MembershipContext | null
): boolean {
  if (user.role === UserRole.Admin) return true;
  return membership !== null;
}

/**
 * Determines whether a user is allowed to manage (create/edit/delete) a case.
 * Only admins can manage cases.
 */
export function canManageCase(user: UserContext): boolean {
  return user.role === UserRole.Admin;
}

/**
 * Determines whether a user is allowed to manage (create/edit/delete) users.
 * Only admins can manage users.
 */
export function canManageUsers(user: UserContext): boolean {
  return user.role === UserRole.Admin;
}
