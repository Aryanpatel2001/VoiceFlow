/**
 * Flows Export API
 *
 * GET /api/export/flows - Export flows to CSV or JSON
 * GET /api/export/flows?flowId=xxx - Export single flow (full JSON)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";
import {
  exportFlowsToCSV,
  exportFlowsToJSON,
  exportFlowToJSON,
  createCSVResponse,
  createJSONResponse,
  generateFilename,
  type FlowExportData,
} from "@/lib/export";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "export");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Organization required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json") as "csv" | "json";
    const flowId = searchParams.get("flowId");
    const status = searchParams.get("status");

    // Single flow export
    if (flowId) {
      const result = await query(
        `SELECT
          id, name, description, status, version, agent_mode,
          nodes, edges, variables, settings,
          created_at, updated_at
        FROM flows
        WHERE id = $1 AND organization_id = $2`,
        [flowId, user.organizationId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
      }

      const row = result.rows[0];
      const flow: FlowExportData = {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        version: row.version,
        agentMode: row.agent_mode,
        nodes: typeof row.nodes === "string" ? JSON.parse(row.nodes) : row.nodes || [],
        edges: typeof row.edges === "string" ? JSON.parse(row.edges) : row.edges || [],
        variables: typeof row.variables === "string" ? JSON.parse(row.variables) : row.variables || [],
        settings: typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings || {},
        createdAt: row.created_at?.toISOString() || "",
        updatedAt: row.updated_at?.toISOString() || "",
      };

      const json = exportFlowToJSON(flow);
      const filename = `flow_${flow.name.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
      return createJSONResponse(json, filename);
    }

    // Multiple flows export
    const conditions = ["organization_id = $1"];
    const params: string[] = [user.organizationId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const result = await query(
      `SELECT
        id, name, description, status, version, agent_mode,
        nodes, edges, variables, settings,
        created_at, updated_at
      FROM flows
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at DESC`,
      params
    );

    const flows: FlowExportData[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      version: row.version,
      agentMode: row.agent_mode,
      nodes: typeof row.nodes === "string" ? JSON.parse(row.nodes) : row.nodes || [],
      edges: typeof row.edges === "string" ? JSON.parse(row.edges) : row.edges || [],
      variables: typeof row.variables === "string" ? JSON.parse(row.variables) : row.variables || [],
      settings: typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings || {},
      createdAt: row.created_at?.toISOString() || "",
      updatedAt: row.updated_at?.toISOString() || "",
    }));

    if (format === "csv") {
      const csv = exportFlowsToCSV(flows);
      return createCSVResponse(csv, generateFilename("flows", "csv"));
    }

    const json = exportFlowsToJSON(flows);
    return createJSONResponse(json, generateFilename("flows", "json"));
  } catch (error) {
    console.error("Flows export error:", error);
    return NextResponse.json(
      { error: "Failed to export flows" },
      { status: 500 }
    );
  }
}
