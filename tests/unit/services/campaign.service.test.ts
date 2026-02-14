/**
 * Campaign Service Tests
 *
 * Unit tests for the campaign service module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { query } from "@/lib/db";
import {
  createCampaign,
  getCampaignById,
  getCampaignsByOrganization,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  addContacts,
  getContacts,
  getCampaignStats,
} from "@/services/campaign.service";
import { mockQuerySuccess, mockQueryError, mockQuerySequence, mockQueryWithRowCount } from "../../mocks/db";

describe("Campaign Service", () => {
  const mockOrgId = "org_test123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // createCampaign
  // ============================================
  describe("createCampaign", () => {
    it("should create a new campaign", async () => {
      const mockCampaign = {
        id: "camp_123",
        organization_id: mockOrgId,
        name: "Test Campaign",
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockCampaign]);

      const result = await createCampaign(mockOrgId, { name: "Test Campaign", flowId: "flow_123" });

      expect(result).toBeDefined();
      expect(result.id).toBe("camp_123");
      expect(result.name).toBe("Test Campaign");
      expect(result.status).toBe("draft");
    });

    it("should create campaign with flow assignment", async () => {
      const mockCampaign = {
        id: "camp_456",
        organization_id: mockOrgId,
        name: "Flow Campaign",
        flow_id: "flow_123",
        status: "draft",
        created_at: new Date(),
      };

      mockQuerySuccess([mockCampaign]);

      const result = await createCampaign(mockOrgId, {
        name: "Flow Campaign",
        flowId: "flow_123",
      });

      expect(result.flow_id).toBe("flow_123");
    });

    it("should create campaign with scheduling options", async () => {
      const mockCampaign = {
        id: "camp_789",
        organization_id: mockOrgId,
        name: "Scheduled Campaign",
        scheduled_start: new Date("2024-03-01"),
        scheduled_end: new Date("2024-03-31"),
        allowed_hours_start: "09:00",
        allowed_hours_end: "17:00",
        allowed_days: JSON.stringify([1, 2, 3, 4, 5]),
        timezone: "America/New_York",
        status: "draft",
        created_at: new Date(),
      };

      mockQuerySuccess([mockCampaign]);

      const result = await createCampaign(mockOrgId, {
        name: "Scheduled Campaign",
        flowId: "flow_123",
        scheduledStart: new Date("2024-03-01"),
        scheduledEnd: new Date("2024-03-31"),
        allowedHoursStart: "09:00",
        allowedHoursEnd: "17:00",
        allowedDays: [1, 2, 3, 4, 5],
        timezone: "America/New_York",
      });

      expect(result).toBeDefined();
      expect(result.timezone).toBe("America/New_York");
    });

    it("should throw error on database failure", async () => {
      mockQueryError(new Error("Database error"));

      await expect(
        createCampaign(mockOrgId, { name: "Test Campaign", flowId: "flow_123" })
      ).rejects.toThrow("Database error");
    });
  });

  // ============================================
  // getCampaignById
  // ============================================
  describe("getCampaignById", () => {
    it("should return a campaign by ID", async () => {
      const mockCampaign = {
        id: "camp_123",
        organization_id: mockOrgId,
        name: "Test Campaign",
        status: "draft",
      };

      mockQuerySuccess([mockCampaign]);

      const result = await getCampaignById("camp_123", mockOrgId);

      expect(result).toBeDefined();
      expect(result?.id).toBe("camp_123");
    });

    it("should return null for non-existent campaign", async () => {
      mockQuerySuccess([]);

      const result = await getCampaignById("non_existent", mockOrgId);

      expect(result).toBeNull();
    });

    it("should return null if campaign belongs to different org", async () => {
      mockQuerySuccess([]);

      const result = await getCampaignById("camp_123", "different_org");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getCampaignsByOrganization
  // ============================================
  describe("getCampaignsByOrganization", () => {
    it("should return all campaigns for an organization", async () => {
      const mockCampaigns = [
        { id: "camp_1", organization_id: mockOrgId, name: "Campaign 1", status: "draft" },
        { id: "camp_2", organization_id: mockOrgId, name: "Campaign 2", status: "running" },
      ];

      mockQuerySequence([
        [{ count: "2" }],
        mockCampaigns,
      ]);

      const result = await getCampaignsByOrganization(mockOrgId);

      expect(result.campaigns).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter campaigns by status", async () => {
      const mockCampaigns = [
        { id: "camp_1", organization_id: mockOrgId, status: "running" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCampaigns,
      ]);

      const result = await getCampaignsByOrganization(mockOrgId, { status: "running" });

      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].status).toBe("running");
    });

    it("should filter campaigns by flow", async () => {
      const mockCampaigns = [
        { id: "camp_1", organization_id: mockOrgId, flow_id: "flow_123" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCampaigns,
      ]);

      const result = await getCampaignsByOrganization(mockOrgId, { flowId: "flow_123" });

      expect(result.campaigns).toHaveLength(1);
    });

    it("should support pagination", async () => {
      mockQuerySequence([
        [{ count: "50" }],
        [{ id: "camp_11" }],
      ]);

      const result = await getCampaignsByOrganization(
        mockOrgId,
        {},
        { limit: 1, offset: 10 }
      );

      expect(result.total).toBe(50);
      expect(result.campaigns).toHaveLength(1);
    });
  });

  // ============================================
  // updateCampaign
  // ============================================
  describe("updateCampaign", () => {
    it("should update campaign name", async () => {
      const mockUpdatedCampaign = {
        id: "camp_123",
        organization_id: mockOrgId,
        name: "Updated Campaign",
        status: "draft",
      };

      mockQuerySuccess([mockUpdatedCampaign]);

      const result = await updateCampaign("camp_123", mockOrgId, { name: "Updated Campaign" });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Updated Campaign");
    });

    it("should update campaign scheduling", async () => {
      const mockUpdatedCampaign = {
        id: "camp_123",
        organization_id: mockOrgId,
        scheduled_start: new Date("2024-04-01"),
        concurrent_calls: 5,
      };

      mockQuerySuccess([mockUpdatedCampaign]);

      const result = await updateCampaign("camp_123", mockOrgId, {
        scheduledStart: new Date("2024-04-01"),
        concurrentCalls: 5,
      });

      expect(result?.concurrent_calls).toBe(5);
    });

    it("should return null for non-existent campaign", async () => {
      mockQuerySuccess([]);

      const result = await updateCampaign("non_existent", mockOrgId, { name: "New Name" });

      expect(result).toBeNull();
    });
  });

  // ============================================
  // deleteCampaign
  // ============================================
  describe("deleteCampaign", () => {
    it("should delete a campaign and return true", async () => {
      mockQueryWithRowCount(1);

      const result = await deleteCampaign("camp_123", mockOrgId);

      expect(result).toBe(true);
    });

    it("should return false for non-existent campaign", async () => {
      mockQueryWithRowCount(0);

      const result = await deleteCampaign("non_existent", mockOrgId);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // updateCampaignStatus
  // ============================================
  describe("updateCampaignStatus", () => {
    it("should update campaign to running status", async () => {
      mockQueryWithRowCount(1);

      await updateCampaignStatus("camp_123", "running");

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE campaigns"),
        expect.arrayContaining(["running", "camp_123"])
      );
    });

    it("should update campaign to paused status", async () => {
      mockQueryWithRowCount(1);

      await updateCampaignStatus("camp_123", "paused");

      expect(query).toHaveBeenCalled();
    });

    it("should update campaign to completed status", async () => {
      mockQueryWithRowCount(1);

      await updateCampaignStatus("camp_123", "completed");

      expect(query).toHaveBeenCalled();
    });
  });

  // ============================================
  // addContacts
  // ============================================
  describe("addContacts", () => {
    it("should add contacts to a campaign", async () => {
      mockQueryWithRowCount(3);

      const contacts = [
        { phoneNumber: "+15551234567", firstName: "John" },
        { phoneNumber: "+15559876543", firstName: "Jane" },
        { phoneNumber: "+15555551234", firstName: "Bob" },
      ];

      const result = await addContacts("camp_123", contacts);

      expect(result).toBe(3);
    });

    it("should handle empty contacts array", async () => {
      const result = await addContacts("camp_123", []);

      expect(result).toBe(0);
      expect(query).not.toHaveBeenCalled();
    });

    it("should add contacts with custom data", async () => {
      mockQueryWithRowCount(1);

      const contacts = [
        {
          phoneNumber: "+15551234567",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          customData: { company: "Acme Inc" },
        },
      ];

      const result = await addContacts("camp_123", contacts);

      expect(result).toBe(1);
    });
  });

  // ============================================
  // getContacts
  // ============================================
  describe("getContacts", () => {
    it("should return all contacts for a campaign", async () => {
      const mockContacts = [
        { id: "contact_1", campaign_id: "camp_123", phone_number: "+15551234567" },
        { id: "contact_2", campaign_id: "camp_123", phone_number: "+15559876543" },
      ];

      mockQuerySequence([
        [{ count: "2" }],
        mockContacts,
      ]);

      const result = await getContacts("camp_123");

      expect(result.contacts).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter contacts by status", async () => {
      const mockContacts = [
        { id: "contact_1", campaign_id: "camp_123", status: "pending" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockContacts,
      ]);

      const result = await getContacts("camp_123", { status: "pending" });

      expect(result.contacts).toHaveLength(1);
    });

    it("should search contacts by phone or name", async () => {
      const mockContacts = [
        { id: "contact_1", phone_number: "+15551234567", first_name: "John" },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockContacts,
      ]);

      const result = await getContacts("camp_123", { search: "John" });

      expect(result.contacts).toHaveLength(1);
    });
  });

  // ============================================
  // getCampaignStats
  // ============================================
  describe("getCampaignStats", () => {
    it("should return campaign statistics", async () => {
      // The service groups by status and counts each
      const mockStats = [
        { status: "pending", count: "50" },
        { status: "in_progress", count: "10" },
        { status: "completed", count: "30" },
        { status: "failed", count: "5" },
        { status: "dnc", count: "5" },
      ];

      mockQuerySuccess(mockStats);

      const result = await getCampaignStats("camp_123");

      expect(result.total).toBe(100);
      expect(result.pending).toBe(50);
      expect(result.completed).toBe(30);
      expect(result.failed).toBe(5);
    });

    it("should handle campaign with no contacts", async () => {
      // Empty result means no contacts
      mockQuerySuccess([]);

      const result = await getCampaignStats("camp_123");

      expect(result.total).toBe(0);
    });
  });
});
