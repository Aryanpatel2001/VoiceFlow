/**
 * Phone Numbers Batch Operations API
 *
 * POST /api/phone-numbers/batch - Execute batch operations
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  batchAssignFlow,
  batchDeletePhoneNumbers,
  batchUpdateStatus,
  getPhoneNumbers,
} from "@/services/phone.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";
import { z } from "zod";

const batchAssignSchema = z.object({
  action: z.literal("assign_flow"),
  phoneNumberIds: z.array(z.string().uuid()).min(1).max(50),
  flowId: z.string().uuid().nullable(),
});

const batchDeleteSchema = z.object({
  action: z.literal("delete"),
  phoneNumberIds: z.array(z.string().uuid()).min(1).max(50),
  forceDelete: z.boolean().optional(),
});

const batchStatusSchema = z.object({
  action: z.literal("update_status"),
  phoneNumberIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["active", "inactive"]),
});

const batchRequestSchema = z.union([
  batchAssignSchema,
  batchDeleteSchema,
  batchStatusSchema,
]);

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - write operations (stricter for batch)
    const rateLimitResponse = applyRateLimit(request, "write", "phone-numbers/batch");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = batchRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const requestMeta = getRequestMetadata(request);

    // Get current phone numbers for audit logging
    const currentNumbers = await getPhoneNumbers(user.organizationId);
    const numbersMap = new Map(currentNumbers.map((n) => [n.id, n]));

    switch (data.action) {
      case "assign_flow": {
        const result = await batchAssignFlow(
          data.phoneNumberIds,
          user.organizationId,
          data.flowId
        );

        // Audit log
        await createAuditLog({
          organizationId: user.organizationId,
          userId: user.id,
          action: "phone_number.batch_assign_flow",
          entityType: "phone_number",
          newValues: {
            phoneNumberIds: data.phoneNumberIds,
            flowId: data.flowId,
            successCount: result.success.length,
            failedCount: result.failed.length,
          },
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        });

        return NextResponse.json({
          message: "Batch assign completed",
          result,
        });
      }

      case "delete": {
        const result = await batchDeletePhoneNumbers(
          data.phoneNumberIds,
          user.organizationId,
          { forceDelete: data.forceDelete }
        );

        // Audit log with details of deleted numbers
        const deletedNumbers = result.success
          .map((id) => numbersMap.get(id))
          .filter(Boolean)
          .map((n) => ({ id: n!.id, number: n!.number, provider: n!.provider }));

        await createAuditLog({
          organizationId: user.organizationId,
          userId: user.id,
          action: "phone_number.batch_delete",
          entityType: "phone_number",
          oldValues: { deletedNumbers },
          newValues: {
            successCount: result.success.length,
            failedCount: result.failed.length,
            forceDelete: data.forceDelete,
          },
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        });

        return NextResponse.json({
          message: "Batch delete completed",
          result,
        });
      }

      case "update_status": {
        const result = await batchUpdateStatus(
          data.phoneNumberIds,
          user.organizationId,
          data.status
        );

        // Audit log
        await createAuditLog({
          organizationId: user.organizationId,
          userId: user.id,
          action: "phone_number.batch_update_status",
          entityType: "phone_number",
          newValues: {
            phoneNumberIds: data.phoneNumberIds,
            status: data.status,
            successCount: result.success.length,
            failedCount: result.failed.length,
          },
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        });

        return NextResponse.json({
          message: "Batch status update completed",
          result,
        });
      }
    }
  } catch (error) {
    console.error("Batch operation error:", error);
    return NextResponse.json(
      { error: "Failed to execute batch operation" },
      { status: 500 }
    );
  }
}
