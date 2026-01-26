/**
 * Auth Utilities
 *
 * Helper functions for authentication in server components and API routes.
 *
 * @module lib/auth
 * @see docs/features/02-authentication.md
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./config";

export { authOptions } from "./config";

/**
 * Get the current session on the server
 * Use in Server Components and API Routes
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Get the current user from session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in Server Components
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

/**
 * Require authentication and organization membership
 * Redirects to onboarding if user has no organization
 */
export async function requireAuthWithOrg() {
  const user = await requireAuth();

  if (!user.organizationId) {
    redirect("/onboarding");
  }

  return user;
}

/**
 * Check if user has specific role in organization
 */
export async function checkRole(allowedRoles: string[]) {
  const user = await requireAuthWithOrg();

  if (!user.role || !allowedRoles.includes(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  return user;
}

/**
 * For API routes - returns null instead of redirecting
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Validate API request has valid session
 * Returns user or throws error (for API routes)
 */
export async function validateApiAuth() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
