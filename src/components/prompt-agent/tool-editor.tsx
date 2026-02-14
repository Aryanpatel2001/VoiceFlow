"use client";

import { useEffect, useState } from "react";
import type { PromptAgentTool } from "@/lib/prompt-agent/types";

interface ToolEditorProps {
  onAdd: (tool: PromptAgentTool) => void;
}

export function ToolEditor({ onAdd }: ToolEditorProps) {
  const [type, setType] = useState<PromptAgentTool["type"]>("end_call");
  const [value, setValue] = useState("");
  const [calendarOptions, setCalendarOptions] = useState<
    Array<{ id: string; summary: string; primary: boolean }>
  >([]);
  const [calendarStatus, setCalendarStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const usesCalendar =
    type === "check_availability" || type === "book_slot";

  useEffect(() => {
    let cancelled = false;

    async function loadCalendars() {
      if (!usesCalendar || calendarStatus === "ready" || calendarStatus === "loading") {
        return;
      }
      setCalendarStatus("loading");
      try {
        const res = await fetch("/api/integrations/google_calendar/calendars");
        if (!res.ok) {
          throw new Error("Failed to fetch calendars");
        }
        const data = await res.json();
        const calendars = data.calendars || [];
        if (cancelled) return;
        setCalendarOptions(calendars);
        if (!value && calendars.length > 0) {
          const primary = calendars.find((c: { primary: boolean }) => c.primary);
          setValue(primary?.id || calendars[0].id);
        }
        setCalendarStatus("ready");
      } catch {
        if (!cancelled) setCalendarStatus("error");
      }
    }

    loadCalendars();
    return () => {
      cancelled = true;
    };
  }, [usesCalendar, calendarStatus, value]);

  const addTool = () => {
    if (type === "end_call") {
      onAdd({ type: "end_call", description: "End call when completed" });
      return;
    }

    if (type === "transfer_call") {
      onAdd({
        type: "transfer_call",
        destination: value || "+15550000000",
        transferType: "cold",
      });
      return;
    }

    if (type === "http") {
      onAdd({
        type: "http",
        name: "custom_http",
        description: "Call external endpoint",
        url: value || "https://example.com/webhook",
        method: "POST",
      });
      return;
    }

    if (type === "check_availability") {
      onAdd({
        type: "check_availability",
        provider: "google_calendar",
        calendarId: value || "primary",
        defaultDurationMinutes: 30,
      });
      return;
    }

    if (type === "book_slot") {
      onAdd({
        type: "book_slot",
        provider: "google_calendar",
        calendarId: value || "primary",
        defaultDurationMinutes: 30,
      });
      return;
    }

    onAdd({
      type: "integration",
      provider: value || "hubspot",
      actionId: "hubspot.lookup_contact",
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PromptAgentTool["type"])}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background"
        >
          <option value="end_call">End Call</option>
          <option value="transfer_call">Transfer Call</option>
          <option value="check_availability">Check Availability</option>
          <option value="book_slot">Book Slot</option>
          <option value="http">HTTP</option>
          <option value="integration">Integration</option>
        </select>
        <button
          onClick={addTool}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
        >
          Add Tool
        </button>
      </div>
      {type !== "end_call" && !usesCalendar && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            type === "transfer_call"
              ? "+15550000000"
              : type === "http"
                ? "https://example.com/webhook"
                : "provider slug (e.g. hubspot)"
          }
          className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
        />
      )}
      {usesCalendar && (
        <div className="space-y-1.5">
          <select
            value={value || "primary"}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
          >
            {calendarOptions.length > 0 ? (
              calendarOptions.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                  {calendar.primary ? " (primary)" : ""}
                </option>
              ))
            ) : (
              <option value="primary">primary</option>
            )}
          </select>
          {calendarStatus === "loading" && (
            <p className="text-[11px] text-muted-foreground">Loading calendars...</p>
          )}
          {calendarStatus === "error" && (
            <p className="text-[11px] text-muted-foreground">
              Could not load calendars. Using `primary`.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
