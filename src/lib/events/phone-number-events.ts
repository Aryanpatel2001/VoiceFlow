/**
 * Phone Number Event Emitter
 *
 * Centralized event emission for phone number real-time updates.
 * Uses a simple pub/sub pattern to avoid circular dependencies.
 *
 * @module lib/events/phone-number-events
 */

// Event types
export type PhoneNumberEventType =
  | "phone_number.created"
  | "phone_number.updated"
  | "phone_number.deleted"
  | "phone_number.call_started"
  | "phone_number.call_ended"
  | "phone_number.status_changed"
  | "phone_number.flow_assigned"
  | "heartbeat"
  | "connected"
  | "initial_state";

export interface PhoneNumberEvent {
  type: PhoneNumberEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

type EventListener = (organizationId: string, event: PhoneNumberEvent) => void;

// Global event listeners
const listeners: Set<EventListener> = new Set();

/**
 * Subscribe to phone number events
 */
export function subscribeToPhoneNumberEvents(listener: EventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Emit a phone number event to all listeners
 */
export function emitPhoneNumberEvent(
  organizationId: string,
  type: PhoneNumberEventType,
  data: Record<string, unknown>
): void {
  const event: PhoneNumberEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  listeners.forEach((listener) => {
    try {
      listener(organizationId, event);
    } catch (error) {
      console.error("Error in phone number event listener:", error);
    }
  });
}

/**
 * Helper functions for common events
 */
export const PhoneNumberEvents = {
  created: (organizationId: string, phoneNumber: Record<string, unknown>) => {
    emitPhoneNumberEvent(organizationId, "phone_number.created", { phoneNumber });
  },

  updated: (organizationId: string, phoneNumber: Record<string, unknown>, changes: Record<string, unknown>) => {
    emitPhoneNumberEvent(organizationId, "phone_number.updated", { phoneNumber, changes });
  },

  deleted: (organizationId: string, phoneNumberId: string, phoneNumber: string) => {
    emitPhoneNumberEvent(organizationId, "phone_number.deleted", {
      phoneNumberId,
      phoneNumber,
    });
  },

  statusChanged: (organizationId: string, phoneNumberId: string, oldStatus: string, newStatus: string) => {
    emitPhoneNumberEvent(organizationId, "phone_number.status_changed", {
      phoneNumberId,
      oldStatus,
      newStatus,
    });
  },

  flowAssigned: (organizationId: string, phoneNumberId: string, flowId: string | null, flowName?: string) => {
    emitPhoneNumberEvent(organizationId, "phone_number.flow_assigned", {
      phoneNumberId,
      flowId,
      flowName,
    });
  },

  callStarted: (organizationId: string, phoneNumberId: string, callId: string, callData: Record<string, unknown>) => {
    emitPhoneNumberEvent(organizationId, "phone_number.call_started", {
      phoneNumberId,
      callId,
      ...callData,
    });
  },

  callEnded: (organizationId: string, phoneNumberId: string, callId: string, duration?: number) => {
    emitPhoneNumberEvent(organizationId, "phone_number.call_ended", {
      phoneNumberId,
      callId,
      duration,
    });
  },
};
