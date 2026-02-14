/**
 * Vitest Setup File
 *
 * This file runs before all tests.
 * Sets up global mocks and testing utilities.
 */

import { vi, beforeAll, afterAll, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Mock database module
vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  getClient: vi.fn(() => ({
    query: vi.fn(),
    release: vi.fn(),
  })),
}));

// Mock auth module
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test setup
beforeAll(() => {
  // Suppress console.error in tests unless explicitly needed
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
