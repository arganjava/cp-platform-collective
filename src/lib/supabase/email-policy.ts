/**
 * Workspace email policy: only Collective Perspectives (@collectivep.com)
 * Google accounts may sign in. Enforced at the edge (middleware), in the
 * auth callback, and in the client app shell. Keep this module dependency-free
 * so it stays safe to import from the Edge runtime.
 */
export const WORKSPACE_EMAIL_DOMAIN = "collectivep.com";

export function isAllowedWorkspaceEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@").pop()?.toLowerCase();
  return domain === WORKSPACE_EMAIL_DOMAIN;
}
