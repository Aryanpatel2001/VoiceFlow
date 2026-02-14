import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import {
  getDecryptedCredentials,
  getIntegration,
} from "@/services/integration.service";
import type { OAuthCredentials } from "@/lib/integrations/types";

interface CalendarItem {
  id: string;
  summary: string;
  timeZone?: string;
  primary: boolean;
  accessRole?: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await getIntegration(
      session.user.organizationId,
      "google_calendar"
    );
    if (!integration || !integration.credentials || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Google Calendar is not connected" },
        { status: 404 }
      );
    }

    const credentials = (await getDecryptedCredentials(
      integration
    )) as OAuthCredentials;

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: "Failed to load calendars", details },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      items?: Array<{
        id: string;
        summary: string;
        primary?: boolean;
        accessRole?: string;
        timeZone?: string;
      }>;
    };

    const calendars: CalendarItem[] = (data.items || [])
      .map((item) => ({
        id: item.id,
        summary: item.summary || item.id,
        primary: Boolean(item.primary),
        accessRole: item.accessRole,
        timeZone: item.timeZone,
      }))
      .sort((a, b) => {
        if (a.primary) return -1;
        if (b.primary) return 1;
        return a.summary.localeCompare(b.summary);
      });

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error("[Google Calendar] List calendars error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google calendars" },
      { status: 500 }
    );
  }
}
