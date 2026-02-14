/**
 * Health Check API
 *
 * GET /api/health - Basic health check (liveness probe)
 * GET /api/health?detailed=true - Detailed health check (readiness probe)
 *
 * Used by load balancers and container orchestrators to verify service health.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version?: string;
  uptime?: number;
  checks?: {
    database: CheckResult;
    memory: CheckResult;
  };
}

interface CheckResult {
  status: "pass" | "fail";
  latencyMs?: number;
  message?: string;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "true";

  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Basic health check - just return OK
  if (!detailed) {
    return NextResponse.json(health);
  }

  // Detailed health check - verify dependencies
  const checks: HealthStatus["checks"] = {
    database: await checkDatabase(),
    memory: checkMemory(),
  };

  health.checks = checks;

  // Determine overall status
  const failedChecks = Object.values(checks).filter((c) => c.status === "fail");
  if (failedChecks.length === Object.keys(checks).length) {
    health.status = "unhealthy";
  } else if (failedChecks.length > 0) {
    health.status = "degraded";
  }

  const statusCode = health.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, { status: statusCode });
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();

  try {
    await query("SELECT 1");
    return {
      status: "pass",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      message: "Database connection failed",
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usagePercent = (used.heapUsed / used.heapTotal) * 100;

  // Fail if memory usage is above 90%
  if (usagePercent > 90) {
    return {
      status: "fail",
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    };
  }

  return {
    status: "pass",
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
  };
}
