/**
 * usePhoneNumberEvents Hook
 *
 * React hook for subscribing to real-time phone number events via SSE.
 *
 * @example
 * const { phoneNumbers, activeCalls, isConnected, error } = usePhoneNumberEvents();
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PhoneNumber {
  id: string;
  organizationId: string;
  number: string;
  countryCode: string;
  provider: string;
  providerId: string | null;
  friendlyName: string | null;
  capabilities: { voice: boolean; sms: boolean };
  status: "active" | "inactive" | "pending";
  monthlyCost: number;
  assignedFlowId: string | null;
  assignedFlowName?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActiveCall {
  phoneNumberId: string;
  callId: string;
  status: string;
}

interface PhoneNumberEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface UsePhoneNumberEventsResult {
  phoneNumbers: PhoneNumber[];
  activeCalls: ActiveCall[];
  isConnected: boolean;
  error: string | null;
  lastEvent: PhoneNumberEvent | null;
  reconnect: () => void;
}

interface UsePhoneNumberEventsOptions {
  enabled?: boolean;
  onEvent?: (event: PhoneNumberEvent) => void;
  onError?: (error: Error) => void;
}

export function usePhoneNumberEvents(
  options: UsePhoneNumberEventsOptions = {}
): UsePhoneNumberEventsResult {
  const { enabled = true, onEvent, onError } = options;

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<PhoneNumberEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/phone-numbers/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: PhoneNumberEvent = JSON.parse(event.data);
          setLastEvent(data);
          onEvent?.(data);

          // Handle different event types
          switch (data.type) {
            case "initial_state":
              setPhoneNumbers(data.data.phoneNumbers as PhoneNumber[]);
              setActiveCalls(data.data.activeCalls as ActiveCall[]);
              break;

            case "phone_number.created":
              setPhoneNumbers((prev) => [
                data.data.phoneNumber as PhoneNumber,
                ...prev,
              ]);
              break;

            case "phone_number.updated":
            case "phone_number.status_changed":
            case "phone_number.flow_assigned":
              setPhoneNumbers((prev) =>
                prev.map((pn) =>
                  pn.id === (data.data.phoneNumber as PhoneNumber)?.id ||
                  pn.id === data.data.phoneNumberId
                    ? { ...pn, ...(data.data.phoneNumber as Partial<PhoneNumber>) }
                    : pn
                )
              );
              break;

            case "phone_number.deleted":
              setPhoneNumbers((prev) =>
                prev.filter((pn) => pn.id !== data.data.phoneNumberId)
              );
              break;

            case "phone_number.call_started":
              setActiveCalls((prev) => [
                ...prev,
                {
                  phoneNumberId: data.data.phoneNumberId as string,
                  callId: data.data.callId as string,
                  status: "in-progress",
                },
              ]);
              break;

            case "phone_number.call_ended":
              setActiveCalls((prev) =>
                prev.filter((c) => c.callId !== data.data.callId)
              );
              break;

            case "heartbeat":
              // Just keep connection alive
              break;
          }
        } catch (parseError) {
          console.error("Failed to parse SSE event:", parseError);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        setIsConnected(false);
        setError("Connection lost. Reconnecting...");
        onError?.(new Error("SSE connection error"));

        eventSource.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error("Failed to create EventSource:", err);
      setError("Failed to connect to real-time updates");
      onError?.(err instanceof Error ? err : new Error("Failed to create EventSource"));
    }
  }, [enabled, onEvent, onError]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return {
    phoneNumbers,
    activeCalls,
    isConnected,
    error,
    lastEvent,
    reconnect,
  };
}
