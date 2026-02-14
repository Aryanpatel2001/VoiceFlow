/**
 * Auth Mock Helpers
 *
 * Utilities for mocking authentication in tests.
 */

import { vi } from "vitest";
import { getAuthenticatedUser } from "@/lib/auth";

// Type for mocked auth function
type MockedAuth = ReturnType<typeof vi.fn>;

export interface MockUser {
  id: string;
  email: string;
  name?: string;
  organizationId: string;
  role?: string;
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user_test123",
    email: "test@example.com",
    name: "Test User",
    organizationId: "org_test123",
    role: "admin",
    ...overrides,
  };
}

/**
 * Mock an authenticated user
 */
export function mockAuthenticatedUser(user: MockUser | null = createMockUser()) {
  (getAuthenticatedUser as MockedAuth).mockResolvedValue(user);
}

/**
 * Mock an unauthenticated request
 */
export function mockUnauthenticated() {
  (getAuthenticatedUser as MockedAuth).mockResolvedValue(null);
}

/**
 * Mock auth error
 */
export function mockAuthError(error: Error | string) {
  const err = typeof error === "string" ? new Error(error) : error;
  (getAuthenticatedUser as MockedAuth).mockRejectedValue(err);
}

/**
 * Reset auth mocks
 */
export function resetAuthMocks() {
  vi.mocked(getAuthenticatedUser).mockReset();
}
