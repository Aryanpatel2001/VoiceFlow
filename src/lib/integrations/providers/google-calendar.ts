/**
 * Google Calendar Integration Provider
 *
 * OAuth2 integration with Google Calendar API v3.
 * Supports checking availability, booking appointments, listing events, and cancellation.
 *
 * @module lib/integrations/providers/google-calendar
 */

import type {
  IntegrationProvider,
  IntegrationAction,
  OAuthCredentials,
  ProviderCredentials,
  ActionExecutionResult,
} from "../types";
import { fetchWithTimeout } from "@/lib/security";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarProvider implements IntegrationProvider {
  slug = "google_calendar" as const;
  name = "Google Calendar";
  description = "Check availability, book appointments, and manage calendar events";
  icon = "Calendar";
  color = "#4285F4";
  category = "calendar" as const;
  requiredScopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  getAuthUrl(_organizationId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.requiredScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };
  }

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: credentials.refresh_token, // Google doesn't always return a new refresh token
      token_type: data.token_type,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope || credentials.scope,
    };
  }

  async testConnection(credentials: ProviderCredentials): Promise<boolean> {
    const creds = credentials as OAuthCredentials;
    const response = await fetchWithTimeout(`${CALENDAR_API_BASE}/calendars/primary`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    });
    return response.ok;
  }

  getActions(): IntegrationAction[] {
    return [
      {
        id: "google_calendar.check_availability",
        provider: "google_calendar",
        name: "Check Availability",
        description: "Check if a specific date/time is available on the calendar",
        category: "read",
        inputSchema: [
          { name: "date", type: "string", required: true, description: "Date to check (YYYY-MM-DD)" },
          { name: "duration_minutes", type: "number", required: false, description: "Appointment duration in minutes", default: 30 },
          { name: "calendar_id", type: "string", required: false, description: "Calendar ID", default: "primary" },
        ],
        outputSchema: [
          { name: "available", type: "boolean", required: true, description: "Whether the date has availability" },
          { name: "busy_slots", type: "object", required: true, description: "Array of busy time ranges" },
          { name: "next_available", type: "string", required: true, description: "Next available slot (ISO datetime)" },
        ],
      },
      {
        id: "google_calendar.book_appointment",
        provider: "google_calendar",
        name: "Book Appointment",
        description: "Create a new calendar event/appointment",
        category: "write",
        inputSchema: [
          { name: "title", type: "string", required: true, description: "Event title" },
          { name: "start_time", type: "string", required: true, description: "Start time (ISO datetime or YYYY-MM-DD HH:MM)" },
          { name: "duration_minutes", type: "number", required: false, description: "Duration in minutes", default: 30 },
          { name: "attendee_email", type: "email", required: false, description: "Attendee email" },
          { name: "description", type: "string", required: false, description: "Event description" },
          { name: "calendar_id", type: "string", required: false, description: "Calendar ID", default: "primary" },
        ],
        outputSchema: [
          { name: "event_id", type: "string", required: true, description: "Created event ID" },
          { name: "event_link", type: "string", required: true, description: "Link to the event" },
          { name: "confirmed", type: "boolean", required: true, description: "Whether the event was created" },
        ],
      },
      {
        id: "google_calendar.list_upcoming",
        provider: "google_calendar",
        name: "List Upcoming Events",
        description: "Get upcoming events from the calendar",
        category: "read",
        inputSchema: [
          { name: "max_results", type: "number", required: false, description: "Maximum events to return", default: 5 },
          { name: "calendar_id", type: "string", required: false, description: "Calendar ID", default: "primary" },
        ],
        outputSchema: [
          { name: "events", type: "object", required: true, description: "Array of upcoming events" },
          { name: "count", type: "number", required: true, description: "Number of events returned" },
        ],
      },
      {
        id: "google_calendar.cancel_event",
        provider: "google_calendar",
        name: "Cancel Event",
        description: "Cancel/delete a calendar event",
        category: "write",
        inputSchema: [
          { name: "event_id", type: "string", required: true, description: "Event ID to cancel" },
          { name: "calendar_id", type: "string", required: false, description: "Calendar ID", default: "primary" },
        ],
        outputSchema: [
          { name: "cancelled", type: "boolean", required: true, description: "Whether the event was cancelled" },
        ],
      },
    ];
  }

  async executeAction(
    actionId: string,
    inputs: Record<string, unknown>,
    credentials: ProviderCredentials,
    settings: Record<string, unknown> = {}
  ): Promise<ActionExecutionResult> {
    const creds = credentials as OAuthCredentials;
    const headers = { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" };

    try {
      switch (actionId) {
        case "google_calendar.check_availability":
          return await this.checkAvailability(inputs, headers, settings);
        case "google_calendar.book_appointment":
          return await this.bookAppointment(inputs, headers, settings);
        case "google_calendar.list_upcoming":
          return await this.listUpcoming(inputs, headers, settings);
        case "google_calendar.cancel_event":
          return await this.cancelEvent(inputs, headers, settings);
        default:
          return { success: false, data: {}, error: `Unknown action: ${actionId}` };
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "Google Calendar action failed",
      };
    }
  }

  // ============================================================
  // Action Implementations
  // ============================================================

  private async checkAvailability(
    inputs: Record<string, unknown>,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const date = inputs.date as string;
    const duration =
      Number(inputs.duration_minutes) ||
      Number(settings.default_duration) ||
      30;
    const calendarId =
      (inputs.calendar_id as string) ||
      (settings.default_calendar_id as string) ||
      "primary";
    const timezone = (settings.timezone as string) || "UTC";

    // Build time range for the whole day
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const response = await fetchWithTimeout(`${CALENDAR_API_BASE}/freeBusy`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: timezone,
        items: [{ id: calendarId }],
      }),
    });

    if (!response.ok) {
      throw new Error(`FreeBusy query failed: ${response.status}`);
    }

    const data = await response.json();
    const busySlots = data.calendars?.[calendarId]?.busy || [];

    // Find available slots (business hours 9am-5pm, in increments of duration)
    const availableSlots: string[] = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += duration) {
        const slotStart = new Date(`${date}T${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

        if (slotEnd.getHours() > 17 || (slotEnd.getHours() === 17 && slotEnd.getMinutes() > 0)) break;

        const isBusy = busySlots.some((busy: { start: string; end: string }) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (!isBusy) {
          availableSlots.push(slotStart.toISOString());
        }
      }
    }

    return {
      success: true,
      data: {
        available: availableSlots.length > 0,
        busy_slots: busySlots,
        next_available: availableSlots[0] || "No availability",
      },
    };
  }

  private async bookAppointment(
    inputs: Record<string, unknown>,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const title = inputs.title as string;
    const startTime = inputs.start_time as string;
    const duration =
      Number(inputs.duration_minutes) ||
      Number(settings.default_duration) ||
      30;
    const attendeeEmail = inputs.attendee_email as string;
    const description = inputs.description as string;
    const calendarId =
      (inputs.calendar_id as string) ||
      (settings.default_calendar_id as string) ||
      "primary";
    const timezone = (settings.timezone as string) || "UTC";

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const event: Record<string, unknown> = {
      summary: title,
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
    };

    if (description) event.description = description;
    if (attendeeEmail) event.attendees = [{ email: attendeeEmail }];

    const response = await fetchWithTimeout(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: "POST", headers, body: JSON.stringify(event) }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create event: ${error}`);
    }

    const created = await response.json();
    return {
      success: true,
      data: {
        event_id: created.id,
        event_link: created.htmlLink,
        confirmed: true,
      },
    };
  }

  private async listUpcoming(
    inputs: Record<string, unknown>,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const maxResults = (inputs.max_results as number) || 5;
    const calendarId =
      (inputs.calendar_id as string) ||
      (settings.default_calendar_id as string) ||
      "primary";
    const timezone = (settings.timezone as string) || "UTC";

    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
      timeZone: timezone,
    });

    const response = await fetchWithTimeout(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to list events: ${response.status}`);
    }

    const data = await response.json();
    const events = (data.items || []).map((item: Record<string, unknown>) => ({
      id: item.id,
      title: item.summary,
      start: (item.start as Record<string, string>)?.dateTime || (item.start as Record<string, string>)?.date,
      end: (item.end as Record<string, string>)?.dateTime || (item.end as Record<string, string>)?.date,
      link: item.htmlLink,
    }));

    return {
      success: true,
      data: {
        events,
        count: events.length,
      },
    };
  }

  private async cancelEvent(
    inputs: Record<string, unknown>,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const eventId = inputs.event_id as string;
    const calendarId =
      (inputs.calendar_id as string) ||
      (settings.default_calendar_id as string) ||
      "primary";

    const response = await fetchWithTimeout(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers }
    );

    return {
      success: response.ok,
      data: { cancelled: response.ok },
      error: response.ok ? undefined : `Failed to cancel event: ${response.status}`,
    };
  }
}
