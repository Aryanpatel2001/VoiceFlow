/**
 * Campaign Scheduler Utilities
 *
 * Checks if current time is within a campaign's allowed calling window.
 *
 * @module lib/campaign/scheduler
 */

export interface ScheduleConfig {
  allowedHoursStart: string; // "09:00"
  allowedHoursEnd: string; // "17:00"
  allowedDays: number[]; // [1,2,3,4,5] = Mon-Fri (1=Mon, 7=Sun)
  timezone: string; // "America/New_York"
}

/**
 * Check if current time is within the allowed calling window
 */
export function isWithinCallingWindow(config: ScheduleConfig): boolean {
  const now = new Date();

  // Get current time in campaign timezone
  const zonedTime = getTimeInZone(now, config.timezone);

  // Check day of week (JavaScript: 0=Sun, 1=Mon, ..., 6=Sat)
  // Campaign format: 1=Mon, 2=Tue, ..., 7=Sun
  const jsDayOfWeek = zonedTime.dayOfWeek;
  const campaignDayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek;

  if (!config.allowedDays.includes(campaignDayOfWeek)) {
    return false;
  }

  // Check time of day
  const currentTimeStr = `${zonedTime.hours.toString().padStart(2, "0")}:${zonedTime.minutes.toString().padStart(2, "0")}`;

  return (
    currentTimeStr >= config.allowedHoursStart &&
    currentTimeStr < config.allowedHoursEnd
  );
}

/**
 * Get time components in a specific timezone
 */
function getTimeInZone(
  date: Date,
  timezone: string
): {
  hours: number;
  minutes: number;
  dayOfWeek: number;
} {
  try {
    // Use Intl.DateTimeFormat to get time in timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    let hours = 0;
    let minutes = 0;
    let weekdayStr = "";

    for (const part of parts) {
      if (part.type === "hour") {
        hours = parseInt(part.value, 10);
      } else if (part.type === "minute") {
        minutes = parseInt(part.value, 10);
      } else if (part.type === "weekday") {
        weekdayStr = part.value;
      }
    }

    // Map weekday string to number
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    return {
      hours,
      minutes,
      dayOfWeek: dayMap[weekdayStr] ?? 0,
    };
  } catch (error) {
    // Fallback to local time if timezone is invalid
    console.warn(`Invalid timezone: ${timezone}, using local time`);
    return {
      hours: date.getHours(),
      minutes: date.getMinutes(),
      dayOfWeek: date.getDay(),
    };
  }
}

/**
 * Get the next available calling window
 * Returns null if no window is available (e.g., no allowed days)
 */
export function getNextCallingWindow(
  config: ScheduleConfig
): { start: Date; end: Date } | null {
  if (config.allowedDays.length === 0) {
    return null;
  }

  const now = new Date();
  const zonedTime = getTimeInZone(now, config.timezone);
  const currentTimeStr = `${zonedTime.hours.toString().padStart(2, "0")}:${zonedTime.minutes.toString().padStart(2, "0")}`;

  // Check if we're currently in a window
  const jsDayOfWeek = zonedTime.dayOfWeek;
  const campaignDayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek;

  if (config.allowedDays.includes(campaignDayOfWeek)) {
    // Check if before window start
    if (currentTimeStr < config.allowedHoursStart) {
      // Window starts later today
      return getWindowForDate(now, config);
    }

    // Check if currently in window
    if (currentTimeStr < config.allowedHoursEnd) {
      return getWindowForDate(now, config);
    }
  }

  // Find next allowed day
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const futureZoned = getTimeInZone(futureDate, config.timezone);
    const futureDayOfWeek =
      futureZoned.dayOfWeek === 0 ? 7 : futureZoned.dayOfWeek;

    if (config.allowedDays.includes(futureDayOfWeek)) {
      return getWindowForDate(futureDate, config);
    }
  }

  return null;
}

/**
 * Get the calling window for a specific date
 */
function getWindowForDate(
  date: Date,
  config: ScheduleConfig
): { start: Date; end: Date } {
  const startParts = config.allowedHoursStart.split(":");
  const endParts = config.allowedHoursEnd.split(":");

  const start = new Date(date);
  start.setHours(parseInt(startParts[0], 10), parseInt(startParts[1], 10), 0, 0);

  const end = new Date(date);
  end.setHours(parseInt(endParts[0], 10), parseInt(endParts[1], 10), 0, 0);

  return { start, end };
}

/**
 * Format schedule for display
 * e.g., "Mon-Fri, 9:00 AM - 5:00 PM EST"
 */
export function formatSchedule(config: ScheduleConfig): string {
  // Format days
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sortedDays = [...config.allowedDays].sort((a, b) => a - b);

  let daysStr: string;
  if (
    sortedDays.length === 5 &&
    sortedDays[0] === 1 &&
    sortedDays[4] === 5
  ) {
    daysStr = "Mon-Fri";
  } else if (
    sortedDays.length === 7
  ) {
    daysStr = "Every day";
  } else {
    daysStr = sortedDays
      .map((d) => dayNames[d === 7 ? 0 : d])
      .join(", ");
  }

  // Format time
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const startTime = formatTime(config.allowedHoursStart);
  const endTime = formatTime(config.allowedHoursEnd);

  // Get timezone abbreviation
  const tzAbbr = getTimezoneAbbreviation(config.timezone);

  return `${daysStr}, ${startTime} - ${endTime} ${tzAbbr}`;
}

/**
 * Get timezone abbreviation
 */
function getTimezoneAbbreviation(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
}
