/**
 * Database Mock Helpers
 *
 * Utilities for mocking database queries in tests.
 */

import { vi } from "vitest";
import { query, getClient } from "@/lib/db";

// Type for mocked query function
type MockedQuery = ReturnType<typeof vi.fn>;

/**
 * Create a complete mock QueryResult object
 */
function createMockQueryResult<T>(data: T[], rowCount?: number) {
  return {
    rows: data,
    rowCount: rowCount ?? data.length,
    command: "SELECT" as const,
    oid: 0,
    fields: [],
  };
}

/**
 * Mock a successful database query response
 */
export function mockQuerySuccess<T>(data: T[]) {
  (query as MockedQuery).mockResolvedValueOnce(createMockQueryResult(data));
}

/**
 * Mock a database query error
 */
export function mockQueryError(error: Error | string) {
  const err = typeof error === "string" ? new Error(error) : error;
  (query as MockedQuery).mockRejectedValueOnce(err);
}

/**
 * Mock multiple query responses in sequence
 */
export function mockQuerySequence(responses: Array<unknown[] | Error>) {
  responses.forEach((response) => {
    if (response instanceof Error) {
      (query as MockedQuery).mockRejectedValueOnce(response);
    } else {
      (query as MockedQuery).mockResolvedValueOnce(createMockQueryResult(response));
    }
  });
}

/**
 * Mock a query result with custom row count (for DELETE/UPDATE operations)
 */
export function mockQueryWithRowCount(rowCount: number) {
  (query as MockedQuery).mockResolvedValueOnce(createMockQueryResult([], rowCount));
}

/**
 * Mock a database client for transactions
 */
export function mockClient() {
  const clientMock = {
    query: vi.fn(),
    release: vi.fn(),
  };

  (getClient as ReturnType<typeof vi.fn>).mockResolvedValue(clientMock);

  return clientMock;
}

/**
 * Reset all database mocks
 */
export function resetDbMocks() {
  vi.mocked(query).mockReset();
  vi.mocked(getClient).mockReset();
}
