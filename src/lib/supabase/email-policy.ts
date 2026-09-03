/**
 * Workspace email policy:
 * - admin: full access, email domain MUST be @collectivep.com
 * - member: internal team, email domain MUST be @collectivep.com
 * - guest: outside partner, email domain can be @collectivep.com, @gmail.com, @yahoo.com, etc.
 *
 * Keep this module dependency-free so it stays safe to import from the Edge runtime.
 */
export const WORKSPACE_EMAIL_DOMAIN = "collectivep.com";

export function isWorkspaceEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@").pop()?.toLowerCase();
  return domain === WORKSPACE_EMAIL_DOMAIN;
}

/**
 * Validates an email address against role-specific domain requirements:
 * - admin: domain must be collectivep.com
 * - member: domain must be collectivep.com
 * - guest: any valid email domain allowed
 */
export function validateEmailForRole(
  email: string | null | undefined,
  role: "admin" | "member" | "guest"
): { valid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return { valid: false, error: "Please enter an email address." };
  }
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes(".")) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  const domain = parts[1];

  if (role === "admin" && domain !== WORKSPACE_EMAIL_DOMAIN) {
    return {
      valid: false,
      error: "Administrator accounts must use an @collectivep.com email address.",
    };
  }

  if (role === "member" && domain !== WORKSPACE_EMAIL_DOMAIN) {
    return {
      valid: false,
      error: "Member accounts must use an @collectivep.com email address.",
    };
  }

  return { valid: true };
}

export function isAllowedWorkspaceEmail(
  email: string | null | undefined,
  userRole?: string | null
): boolean {
  if (!email) return false;
  if (userRole === "guest") return true;
  return isWorkspaceEmail(email);
}

