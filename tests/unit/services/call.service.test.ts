/**
 * Call Service Tests
 *
 * Unit tests for the call service module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { query, getClient } from "@/lib/db";
import {
  createCall,
  getCallById,
  getCallsByOrganization,
  updateCall,
  getRecentCalls,
  getActiveCalls,
  getCallStats,
  createCallEvent,
  getCallWithEvents,
} from "@/services/call.service";
import { mockQuerySuccess, mockQueryError, mockQuerySequence, mockClient } from "../../mocks/db";

describe("Call Service", () => {
  const mockOrgId = "org_test123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // createCall
  // ============================================
  describe("createCall", () => {
    it("should create a new inbound call", async () => {
      const mockCall = {
        id: "call_123",
        organization_id: mockOrgId,
        direction: "inbound",
        caller_number: "+15551234567",
        callee_number: "+15559876543",
        status: "initiated",
        started_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockCall]);

      const result = await createCall({
        organizationId: mockOrgId,
        direction: "inbound",
        callerNumber: "+15551234567",
        calleeNumber: "+15559876543",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("call_123");
      expect(result.direction).toBe("inbound");
      expect(result.status).toBe("initiated");
    });

    it("should create an outbound call with flow and phone number", async () => {
      const mockCall = {
        id: "call_456",
        organization_id: mockOrgId,
        direction: "outbound",
        caller_number: "+15559876543",
        callee_number: "+15551234567",
        flow_id: "flow_123",
        phone_number_id: "pn_123",
        status: "initiated",
        metadata: JSON.stringify({ campaign: "test" }),
        started_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockCall]);

      const result = await createCall({
        organizationId: mockOrgId,
        direction: "outbound",
        callerNumber: "+15559876543",
        calleeNumber: "+15551234567",
        flowId: "flow_123",
        phoneNumberId: "pn_123",
        metadata: { campaign: "test" },
      });

      expect(result).toBeDefined();
      expect(result.direction).toBe("outbound");
      expect(result.flow_id).toBe("flow_123");
    });

    it("should throw error on database failure", async () => {
      mockQueryError(new Error("Database error"));

      await expect(
        createCall({
          organizationId: mockOrgId,
          direction: "inbound",
          callerNumber: "+15551234567",
          calleeNumber: "+15559876543",
        })
      ).rejects.toThrow("Database error");
    });
  });

  // ============================================
  // getCallById
  // ============================================
  describe("getCallById", () => {
    it("should return a call by ID", async () => {
      const mockCall = {
        id: "call_123",
        organization_id: mockOrgId,
        direction: "inbound",
        status: "completed",
        duration_seconds: 120,
        created_at: new Date(),
      };

      mockQuerySuccess([mockCall]);

      const result = await getCallById("call_123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("call_123");
    });

    it("should return null for non-existent call", async () => {
      mockQuerySuccess([]);

      const result = await getCallById("non_existent");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getCallsByOrganization
  // ============================================
  describe("getCallsByOrganization", () => {
    it("should return all calls for an organization", async () => {
      const mockCalls = [
        { id: "call_1", organization_id: mockOrgId, status: "completed" },
        { id: "call_2", organization_id: mockOrgId, status: "in_progress" },
      ];

      mockQuerySequence([
        [{ count: "2" }],
        mockCalls,
      ]);

      const result = await getCallsByOrganization(mockOrgId);

      expect(result.calls).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter calls by status", async () => {
      const mockCalls = [
        { id: "call_1", organization_id: mockOrgId, status: "completed" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCalls,
      ]);

      const result = await getCallsByOrganization(mockOrgId, { status: "completed" });

      expect(result.calls).toHaveLength(1);
      expect(result.calls[0].status).toBe("completed");
    });

    it("should filter calls by direction", async () => {
      const mockCalls = [
        { id: "call_1", organization_id: mockOrgId, direction: "inbound" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCalls,
      ]);

      const result = await getCallsByOrganization(mockOrgId, { direction: "inbound" });

      expect(result.calls).toHaveLength(1);
    });

    it("should filter calls by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockQuerySequence([
        [{ count: "5" }],
        [{ id: "call_1" }, { id: "call_2" }],
      ]);

      const result = await getCallsByOrganization(mockOrgId, { startDate, endDate });

      expect(result.total).toBe(5);
    });

    it("should support pagination", async () => {
      mockQuerySequence([
        [{ count: "100" }],
        [{ id: "call_51" }],
      ]);

      const result = await getCallsByOrganization(
        mockOrgId,
        {},
        { limit: 1, offset: 50 }
      );

      expect(result.total).toBe(100);
      expect(result.calls).toHaveLength(1);
    });
  });

  // ============================================
  // updateCall
  // ============================================
  describe("updateCall", () => {
    it("should update call status", async () => {
      const mockUpdatedCall = {
        id: "call_123",
        status: "completed",
        ended_at: new Date(),
      };

      mockQuerySuccess([mockUpdatedCall]);

      const result = await updateCall("call_123", { status: "completed" });

      expect(result).toBeDefined();
      expect(result?.status).toBe("completed");
    });

    it("should update call duration and transcript", async () => {
      const mockUpdatedCall = {
        id: "call_123",
        status: "completed",
        duration_seconds: 180,
        transcript: "Hello, how can I help?",
      };

      mockQuerySuccess([mockUpdatedCall]);

      const result = await updateCall("call_123", {
        durationSeconds: 180,
        transcript: "Hello, how can I help?",
      });

      expect(result?.duration_seconds).toBe(180);
      expect(result?.transcript).toBe("Hello, how can I help?");
    });

    it("should update sentiment and intent", async () => {
      const mockUpdatedCall = {
        id: "call_123",
        sentiment_score: 0.8,
        sentiment_label: "positive",
        primary_intent: "book_appointment",
        intent_confidence: 0.95,
      };

      mockQuerySuccess([mockUpdatedCall]);

      const result = await updateCall("call_123", {
        sentimentScore: 0.8,
        sentimentLabel: "positive",
        primaryIntent: "book_appointment",
        intentConfidence: 0.95,
      });

      expect(result?.sentiment_score).toBe(0.8);
      expect(result?.primary_intent).toBe("book_appointment");
    });

    it("should return null for non-existent call", async () => {
      mockQuerySuccess([]);

      const result = await updateCall("non_existent", { status: "completed" });

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getRecentCalls
  // ============================================
  describe("getRecentCalls", () => {
    it("should return recent calls with default limit", async () => {
      const mockCalls = Array.from({ length: 10 }, (_, i) => ({
        id: `call_${i}`,
        organization_id: mockOrgId,
        started_at: new Date(Date.now() - i * 60000),
      }));

      mockQuerySuccess(mockCalls);

      const result = await getRecentCalls(mockOrgId);

      expect(result).toHaveLength(10);
    });

    it("should respect custom limit", async () => {
      const mockCalls = Array.from({ length: 5 }, (_, i) => ({
        id: `call_${i}`,
        organization_id: mockOrgId,
      }));

      mockQuerySuccess(mockCalls);

      const result = await getRecentCalls(mockOrgId, 5);

      expect(result).toHaveLength(5);
    });
  });

  // ============================================
  // getActiveCalls
  // ============================================
  describe("getActiveCalls", () => {
    it("should return only active calls", async () => {
      const mockCalls = [
        { id: "call_1", status: "in_progress" },
        { id: "call_2", status: "ringing" },
      ];

      mockQuerySuccess(mockCalls);

      const result = await getActiveCalls(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result.every((c) => ["in_progress", "ringing", "initiated"].includes(c.status))).toBe(true);
    });

    it("should return empty array when no active calls", async () => {
      mockQuerySuccess([]);

      const result = await getActiveCalls(mockOrgId);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================
  // getCallStats
  // ============================================
  describe("getCallStats", () => {
    it("should return call statistics", async () => {
      const mockStats = {
        total_calls: "100",
        completed_calls: "85",
        missed_calls: "10",
        avg_duration: "180.5",
        total_duration: "15345",
      };

      mockQuerySuccess([mockStats]);

      const result = await getCallStats(mockOrgId);

      expect(result.totalCalls).toBe(100);
      expect(result.completedCalls).toBe(85);
      expect(result.missedCalls).toBe(10);
      expect(result.avgDuration).toBeCloseTo(180.5);
      expect(result.totalDuration).toBe(15345);
    });

    it("should handle zero calls gracefully", async () => {
      const mockStats = {
        total_calls: "0",
        completed_calls: "0",
        missed_calls: "0",
        avg_duration: null,
        total_duration: null,
      };

      mockQuerySuccess([mockStats]);

      const result = await getCallStats(mockOrgId);

      expect(result.totalCalls).toBe(0);
      expect(result.avgDuration).toBe(0);
    });

    it("should filter by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const mockStats = {
        total_calls: "50",
        completed_calls: "45",
        missed_calls: "3",
        avg_duration: "200",
        total_duration: "9000",
      };

      mockQuerySuccess([mockStats]);

      const result = await getCallStats(mockOrgId, startDate, endDate);

      expect(result.totalCalls).toBe(50);
    });
  });

  // ============================================
  // createCallEvent
  // ============================================
  describe("createCallEvent", () => {
    it("should create a transcript event", async () => {
      const mockEvent = {
        id: "event_123",
        call_id: "call_123",
        event_type: "transcript",
        speaker: "caller",
        content: "Hello, I need help",
        timestamp: new Date(),
      };

      mockQuerySuccess([mockEvent]);

      const result = await createCallEvent({
        callId: "call_123",
        eventType: "transcript",
        speaker: "caller",
        content: "Hello, I need help",
      });

      expect(result).toBeDefined();
      expect(result.event_type).toBe("transcript");
      expect(result.speaker).toBe("caller");
    });

    it("should create an intent event with confidence", async () => {
      const mockEvent = {
        id: "event_456",
        call_id: "call_123",
        event_type: "intent",
        intent: "book_appointment",
        confidence: 0.95,
        timestamp: new Date(),
      };

      mockQuerySuccess([mockEvent]);

      const result = await createCallEvent({
        callId: "call_123",
        eventType: "intent",
        intent: "book_appointment",
        confidence: 0.95,
      });

      expect(result.intent).toBe("book_appointment");
      expect(result.confidence).toBe(0.95);
    });
  });

  // ============================================
  // getCallWithEvents
  // ============================================
  describe("getCallWithEvents", () => {
    it("should return call with all events", async () => {
      const mockCall = {
        id: "call_123",
        organization_id: mockOrgId,
        status: "completed",
      };

      const mockEvents = [
        { id: "event_1", call_id: "call_123", event_type: "connected" },
        { id: "event_2", call_id: "call_123", event_type: "transcript" },
        { id: "event_3", call_id: "call_123", event_type: "ended" },
      ];

      const clientMock = mockClient();
      clientMock.query
        .mockResolvedValueOnce({ rows: [mockCall] })
        .mockResolvedValueOnce({ rows: mockEvents });

      const result = await getCallWithEvents("call_123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("call_123");
      expect(result?.events).toHaveLength(3);
      expect(clientMock.release).toHaveBeenCalled();
    });

    it("should return null for non-existent call", async () => {
      const clientMock = mockClient();
      clientMock.query.mockResolvedValueOnce({ rows: [] });

      const result = await getCallWithEvents("non_existent");

      expect(result).toBeNull();
    });
  });
});
