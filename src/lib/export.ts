/**
 * Data Export Library
 *
 * Utilities for exporting data to CSV, JSON, and PDF formats.
 *
 * @module lib/export
 */

// ============================================
// Types
// ============================================

export interface ExportOptions {
  format: "csv" | "json";
  filename?: string;
  includeHeaders?: boolean;
}

export interface CallExportData {
  id: string;
  direction: string;
  status: string;
  callerNumber: string;
  calleeNumber: string;
  durationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
  flowName: string | null;
  sentimentLabel: string | null;
  primaryIntent: string | null;
  transcript: string | null;
}

export interface AnalyticsExportData {
  date: string;
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDurationSeconds: number;
  totalDurationMinutes: number;
}

export interface FlowExportData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  agentMode: string;
  nodes: unknown[];
  edges: unknown[];
  variables: unknown[];
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CSV Generation
// ============================================

/**
 * Convert array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  options: { headers?: string[]; includeHeaders?: boolean } = {}
): string {
  if (data.length === 0) {
    return "";
  }

  const { headers = Object.keys(data[0]), includeHeaders = true } = options;

  const rows: string[] = [];

  // Add header row
  if (includeHeaders) {
    rows.push(headers.map(escapeCSVField).join(","));
  }

  // Add data rows
  for (const item of data) {
    const row = headers.map((header) => {
      const value = item[header];
      return escapeCSVField(formatCSVValue(value));
    });
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Escape CSV field value
 */
function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format value for CSV export
 */
function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// ============================================
// Call Export Functions
// ============================================

/**
 * Format call data for export
 */
export function formatCallsForExport(calls: CallExportData[]): Record<string, unknown>[] {
  return calls.map((call) => ({
    "Call ID": call.id,
    Direction: call.direction,
    Status: call.status,
    "Caller Number": call.callerNumber,
    "Callee Number": call.calleeNumber,
    "Duration (seconds)": call.durationSeconds ?? "",
    "Started At": call.startedAt,
    "Ended At": call.endedAt ?? "",
    Flow: call.flowName ?? "",
    Sentiment: call.sentimentLabel ?? "",
    Intent: call.primaryIntent ?? "",
    Transcript: call.transcript ?? "",
  }));
}

/**
 * Export calls to CSV
 */
export function exportCallsToCSV(calls: CallExportData[]): string {
  const formattedData = formatCallsForExport(calls);
  return toCSV(formattedData);
}

/**
 * Export calls to JSON
 */
export function exportCallsToJSON(calls: CallExportData[]): string {
  return JSON.stringify(calls, null, 2);
}

// ============================================
// Analytics Export Functions
// ============================================

/**
 * Format analytics data for export
 */
export function formatAnalyticsForExport(
  data: AnalyticsExportData[]
): Record<string, unknown>[] {
  return data.map((row) => ({
    Date: row.date,
    "Total Calls": row.totalCalls,
    "Inbound Calls": row.inboundCalls,
    "Outbound Calls": row.outboundCalls,
    "Completed Calls": row.completedCalls,
    "Failed Calls": row.failedCalls,
    "Avg Duration (seconds)": row.avgDurationSeconds,
    "Total Duration (minutes)": row.totalDurationMinutes,
  }));
}

/**
 * Export analytics to CSV
 */
export function exportAnalyticsToCSV(data: AnalyticsExportData[]): string {
  const formattedData = formatAnalyticsForExport(data);
  return toCSV(formattedData);
}

/**
 * Export analytics to JSON
 */
export function exportAnalyticsToJSON(data: AnalyticsExportData[]): string {
  return JSON.stringify(data, null, 2);
}

// ============================================
// Flow Export Functions
// ============================================

/**
 * Format flow data for export (simplified for CSV)
 */
export function formatFlowsForCSVExport(
  flows: FlowExportData[]
): Record<string, unknown>[] {
  return flows.map((flow) => ({
    "Flow ID": flow.id,
    Name: flow.name,
    Description: flow.description ?? "",
    Status: flow.status,
    Version: flow.version,
    "Agent Mode": flow.agentMode,
    "Node Count": flow.nodes.length,
    "Edge Count": flow.edges.length,
    "Variable Count": flow.variables.length,
    "Created At": flow.createdAt,
    "Updated At": flow.updatedAt,
  }));
}

/**
 * Export flows to CSV (summary format)
 */
export function exportFlowsToCSV(flows: FlowExportData[]): string {
  const formattedData = formatFlowsForCSVExport(flows);
  return toCSV(formattedData);
}

/**
 * Export single flow to JSON (full format with all data)
 */
export function exportFlowToJSON(flow: FlowExportData): string {
  return JSON.stringify(
    {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      status: flow.status,
      version: flow.version,
      agentMode: flow.agentMode,
      flowData: {
        nodes: flow.nodes,
        edges: flow.edges,
        variables: flow.variables,
        settings: flow.settings,
      },
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Export multiple flows to JSON
 */
export function exportFlowsToJSON(flows: FlowExportData[]): string {
  return JSON.stringify(
    {
      flows: flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        status: flow.status,
        version: flow.version,
        agentMode: flow.agentMode,
        flowData: {
          nodes: flow.nodes,
          edges: flow.edges,
          variables: flow.variables,
          settings: flow.settings,
        },
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
      })),
      exportedAt: new Date().toISOString(),
      totalFlows: flows.length,
    },
    null,
    2
  );
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create a download response for CSV
 */
export function createCSVResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Create a download response for JSON
 */
export function createJSONResponse(json: string, filename: string): Response {
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Generate filename with date
 */
export function generateFilename(
  prefix: string,
  format: "csv" | "json"
): string {
  const date = new Date().toISOString().split("T")[0];
  return `${prefix}_${date}.${format}`;
}
