/**
 * PostgreSQL Database Connection
 *
 * This module provides a connection pool to PostgreSQL database.
 * Uses the `pg` package for raw SQL queries.
 *
 * @module lib/db
 * @see docs/features/01-database-setup.md
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "voiceflow_pro",
  user: process.env.DB_USER || "postgres",
  ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
};

// Create connection pool (singleton)
let pool: Pool | null = null;

/**
 * Get the database connection pool
 * Creates a new pool if one doesn't exist
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);

    // Log pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });

    // Log when pool connects
    pool.on("connect", () => {
      console.log("Database pool: New client connected");
    });
  }
  return pool;
}

/**
 * Execute a SQL query
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (over 100ms)
    if (duration > 100) {
      console.warn("Slow query:", { text, duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error("Database query error:", { text, error });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to release the client after use!
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();
  return client;
}

/**
 * Execute multiple queries in a transaction
 * @param queries - Array of {text, params} objects
 * @returns Array of query results
 */
export async function transaction<T extends QueryResultRow = QueryResultRow>(
  queries: Array<{ text: string; params?: unknown[] }>
): Promise<QueryResult<T>[]> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const results: QueryResult<T>[] = [];
    for (const q of queries) {
      const result = await client.query<T>(q.text, q.params);
      results.push(result);
    }

    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 * Call this when shutting down the application
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("Database pool closed");
  }
}

/**
 * Check database connection health
 * @returns true if connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query("SELECT 1 as health");
    return result.rows[0]?.health === 1;
  } catch {
    return false;
  }
}

// Export types for convenience
export type { Pool, PoolClient, QueryResult };
