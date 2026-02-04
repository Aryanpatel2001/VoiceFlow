/**
 * Flow Service
 *
 * Business logic for managing conversation flows.
 * Handles CRUD operations, versioning, and validation.
 *
 * @module services/flow
 */

import { query } from "@/lib/db";
import { validateFlow } from "@/lib/canvas/validation";
import type {
  Flow,
  FlowVersion,
  FlowData,
  FlowNode,
  FlowEdge,
  FlowVariable,
  FlowSettings,
  ValidationResult,
} from "@/lib/canvas/types";

// ============================================
// Types (matching actual DB schema)
// ============================================

interface FlowRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  template_type: string | null;
  status: string;
  version: number;
  nodes: FlowNode[] | string;
  edges: FlowEdge[] | string;
  variables: FlowVariable[] | string;
  settings: FlowSettings | string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Production endpoint fields
  webhook_id: string | null;
  webhook_secret: string | null;
  deployed_version: number | null;
  endpoint_enabled: boolean | null;
}

interface FlowVersionRow {
  id: string;
  flow_id: string;
  version: number;
  nodes: FlowNode[] | string;
  edges: FlowEdge[] | string;
  variables: FlowVariable[] | string;
  settings: FlowSettings | string;
  created_by: string | null;
  created_at: Date;
}

export interface CreateFlowInput {
  name: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  variables?: FlowVariable[];
  settings?: Partial<FlowSettings>;
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  variables?: FlowVariable[];
  settings?: Partial<FlowSettings>;
}

// ============================================
// Default Settings
// ============================================

const DEFAULT_SETTINGS: FlowSettings = {
  defaultVoice: "21m00Tcm4TlvDq8ikWAM",
  language: "en-US",
  timeout: 30000,
  maxTurns: 20,
  recordCalls: true,
  transcribeCalls: true,
};

// ============================================
// Create Flow
// ============================================

export async function createFlow(
  organizationId: string,
  input: CreateFlowInput
): Promise<Flow> {
  const nodes = input.nodes || [
    {
      id: "start_1",
      type: "start" as const,
      position: { x: 250, y: 100 },
      data: {
        label: "Start",
        config: {
          greeting: "Hello! How can I help you today?",
        },
      },
    },
  ];

  const edges = input.edges || [];

  const variables = input.variables || [
    { id: "v1", name: "user_input", type: "string" as const, description: "Latest user input" },
    { id: "v2", name: "intent", type: "string" as const, description: "Detected user intent" },
  ];

  const settings = { ...DEFAULT_SETTINGS, ...input.settings };

  const result = await query<FlowRow>(
    `INSERT INTO flows (
      organization_id, name, description, status,
      nodes, edges, variables, settings
    ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7)
    RETURNING *`,
    [
      organizationId,
      input.name,
      input.description || null,
      JSON.stringify(nodes),
      JSON.stringify(edges),
      JSON.stringify(variables),
      JSON.stringify(settings),
    ]
  );

  return rowToFlow(result.rows[0]);
}

// ============================================
// Get Flow by ID
// ============================================

export async function getFlowById(
  flowId: string,
  organizationId: string
): Promise<Flow | null> {
  const result = await query<FlowRow>(
    `SELECT * FROM flows WHERE id = $1 AND organization_id = $2`,
    [flowId, organizationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlow(result.rows[0]);
}

// ============================================
// Get Flow by Webhook ID (for production calls)
// ============================================

export async function getFlowByWebhookId(webhookId: string): Promise<Flow | null> {
  const result = await query<FlowRow>(
    `SELECT * FROM flows WHERE webhook_id = $1 AND endpoint_enabled = true`,
    [webhookId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlow(result.rows[0]);
}

// ============================================
// Get Published Flow Version (for production)
// ============================================

export async function getPublishedFlowVersion(
  flowId: string
): Promise<FlowVersion | null> {
  // Get the flow to find deployed version
  const flowResult = await query<FlowRow>(
    `SELECT deployed_version FROM flows WHERE id = $1 AND status = 'published'`,
    [flowId]
  );

  if (flowResult.rows.length === 0 || !flowResult.rows[0].deployed_version) {
    return null;
  }

  const deployedVersion = flowResult.rows[0].deployed_version;

  const result = await query<FlowVersionRow>(
    `SELECT * FROM flow_versions WHERE flow_id = $1 AND version = $2`,
    [flowId, deployedVersion]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlowVersion(result.rows[0]);
}

// ============================================
// Toggle Endpoint Status
// ============================================

export async function setEndpointEnabled(
  flowId: string,
  organizationId: string,
  enabled: boolean
): Promise<Flow | null> {
  const result = await query<FlowRow>(
    `UPDATE flows SET endpoint_enabled = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING *`,
    [enabled, flowId, organizationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlow(result.rows[0]);
}

// ============================================
// Get Flows by Organization
// ============================================

export async function getFlowsByOrganization(
  organizationId: string,
  options?: {
    status?: "draft" | "published";
    limit?: number;
    offset?: number;
  }
): Promise<{ flows: Flow[]; total: number }> {
  const conditions: string[] = ["organization_id = $1"];
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  if (options?.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(options.status);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM flows WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const result = await query<FlowRow>(
    `SELECT * FROM flows
     WHERE ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    flows: result.rows.map(rowToFlow),
    total,
  };
}

// ============================================
// Update Flow
// ============================================

export async function updateFlow(
  flowId: string,
  organizationId: string,
  input: UpdateFlowInput
): Promise<Flow | null> {
  const current = await getFlowById(flowId, organizationId);
  if (!current) {
    return null;
  }

  const updatedNodes = input.nodes ?? current.flowData.nodes;
  const updatedEdges = input.edges ?? current.flowData.edges;
  const updatedVariables = input.variables ?? current.flowData.variables;
  const updatedSettings = { ...current.flowData.settings, ...input.settings };

  const result = await query<FlowRow>(
    `UPDATE flows SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      nodes = $3,
      edges = $4,
      variables = $5,
      settings = $6,
      updated_at = NOW()
     WHERE id = $7 AND organization_id = $8
     RETURNING *`,
    [
      input.name || null,
      input.description !== undefined ? input.description : null,
      JSON.stringify(updatedNodes),
      JSON.stringify(updatedEdges),
      JSON.stringify(updatedVariables),
      JSON.stringify(updatedSettings),
      flowId,
      organizationId,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlow(result.rows[0]);
}

// ============================================
// Delete Flow
// ============================================

export async function deleteFlow(
  flowId: string,
  organizationId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM flows WHERE id = $1 AND organization_id = $2`,
    [flowId, organizationId]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Publish Flow
// ============================================

export async function publishFlow(
  flowId: string,
  organizationId: string,
  userId: string
): Promise<FlowVersion | null> {
  const flow = await getFlowById(flowId, organizationId);
  if (!flow) {
    return null;
  }

  // Validate flow before publishing
  const validation = validateFlow(
    flow.flowData.nodes,
    flow.flowData.edges,
    flow.flowData.variables
  );

  if (!validation.valid) {
    throw new Error(`Cannot publish: ${validation.errors.map((e) => e.message).join(", ")}`);
  }

  // Get next version number
  const versionResult = await query<{ max_version: number | null }>(
    `SELECT MAX(version) as max_version FROM flow_versions WHERE flow_id = $1`,
    [flowId]
  );
  const nextVersion = (versionResult.rows[0]?.max_version ?? 0) + 1;

  // Create version snapshot
  const versionInsert = await query<FlowVersionRow>(
    `INSERT INTO flow_versions (flow_id, version, nodes, edges, variables, settings, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      flowId,
      nextVersion,
      JSON.stringify(flow.flowData.nodes),
      JSON.stringify(flow.flowData.edges),
      JSON.stringify(flow.flowData.variables),
      JSON.stringify(flow.flowData.settings),
      userId,
    ]
  );

  // Generate webhook ID if not exists
  const webhookId = generateWebhookId();
  const webhookSecret = generateWebhookSecret();

  // Update flow status, version, and webhook credentials
  await query(
    `UPDATE flows SET
      status = 'published',
      version = $1,
      published_at = NOW(),
      updated_at = NOW(),
      deployed_version = $1,
      endpoint_enabled = true,
      webhook_id = COALESCE(webhook_id, $3),
      webhook_secret = COALESCE(webhook_secret, $4)
     WHERE id = $2`,
    [nextVersion, flowId, webhookId, webhookSecret]
  );

  return rowToFlowVersion(versionInsert.rows[0]);
}

// Generate unique webhook ID (24 chars alphanumeric)
function generateWebhookId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate webhook secret (64 chars hex)
function generateWebhookSecret(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================
// Get Flow Versions
// ============================================

export async function getFlowVersions(
  flowId: string,
  organizationId: string
): Promise<FlowVersion[]> {
  const flow = await getFlowById(flowId, organizationId);
  if (!flow) {
    return [];
  }

  const result = await query<FlowVersionRow>(
    `SELECT * FROM flow_versions
     WHERE flow_id = $1
     ORDER BY version DESC`,
    [flowId]
  );

  return result.rows.map(rowToFlowVersion);
}

// ============================================
// Get Specific Version
// ============================================

export async function getFlowVersion(
  flowId: string,
  versionNumber: number,
  organizationId: string
): Promise<FlowVersion | null> {
  const flow = await getFlowById(flowId, organizationId);
  if (!flow) {
    return null;
  }

  const result = await query<FlowVersionRow>(
    `SELECT * FROM flow_versions
     WHERE flow_id = $1 AND version = $2`,
    [flowId, versionNumber]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlowVersion(result.rows[0]);
}

// ============================================
// Rollback to Version
// ============================================

export async function rollbackToVersion(
  flowId: string,
  versionNumber: number,
  organizationId: string
): Promise<Flow | null> {
  const version = await getFlowVersion(flowId, versionNumber, organizationId);
  if (!version) {
    return null;
  }

  const result = await query<FlowRow>(
    `UPDATE flows SET
      nodes = $1,
      edges = $2,
      variables = $3,
      settings = $4,
      updated_at = NOW()
     WHERE id = $5 AND organization_id = $6
     RETURNING *`,
    [
      JSON.stringify(version.flowData.nodes),
      JSON.stringify(version.flowData.edges),
      JSON.stringify(version.flowData.variables),
      JSON.stringify(version.flowData.settings),
      flowId,
      organizationId,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToFlow(result.rows[0]);
}

// ============================================
// Duplicate Flow
// ============================================

export async function duplicateFlow(
  flowId: string,
  organizationId: string
): Promise<Flow | null> {
  const original = await getFlowById(flowId, organizationId);
  if (!original) {
    return null;
  }

  return createFlow(organizationId, {
    name: `${original.name} (Copy)`,
    description: original.description,
    nodes: original.flowData.nodes,
    edges: original.flowData.edges,
    variables: original.flowData.variables,
    settings: original.flowData.settings,
  });
}

// ============================================
// Validate Flow
// ============================================

export function validateFlowData(flowData: FlowData): ValidationResult {
  return validateFlow(flowData.nodes, flowData.edges, flowData.variables);
}

// ============================================
// Import from Template
// ============================================

export async function importFromTemplate(
  organizationId: string,
  templateId: string,
  name: string
): Promise<Flow> {
  const { getTemplateById } = await import("@/lib/canvas/templates");
  const template = getTemplateById(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return createFlow(organizationId, {
    name,
    description: template.description,
    nodes: template.nodes,
    edges: template.edges,
    variables: template.variables,
    settings: template.settings,
  });
}

// ============================================
// Helper Functions
// ============================================

function parseJsonColumn<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function rowToFlow(row: FlowRow): Flow {
  const nodes = parseJsonColumn<FlowNode[]>(row.nodes);
  const edges = parseJsonColumn<FlowEdge[]>(row.edges);
  const variables = parseJsonColumn<FlowVariable[]>(row.variables);
  const settings = parseJsonColumn<FlowSettings>(row.settings);

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description || undefined,
    status: row.status as "draft" | "published",
    flowData: { nodes, edges, variables, settings },
    nodeCount: Array.isArray(nodes) ? nodes.length : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Production endpoint fields
    webhookId: row.webhook_id || undefined,
    webhookSecret: row.webhook_secret || undefined,
    deployedVersion: row.deployed_version || undefined,
    endpointEnabled: row.endpoint_enabled ?? false,
  };
}

function rowToFlowVersion(row: FlowVersionRow): FlowVersion {
  const nodes = parseJsonColumn<FlowNode[]>(row.nodes);
  const edges = parseJsonColumn<FlowEdge[]>(row.edges);
  const variables = parseJsonColumn<FlowVariable[]>(row.variables);
  const settings = parseJsonColumn<FlowSettings>(row.settings);

  return {
    id: row.id,
    flowId: row.flow_id,
    versionNumber: row.version,
    flowData: { nodes, edges, variables, settings },
    publishedAt: row.created_at,
    publishedBy: row.created_by || "",
  };
}
