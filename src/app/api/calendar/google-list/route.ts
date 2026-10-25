import { NextRequest, NextResponse } from 'next/server';

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  backgroundColor: string;
  accessRole: string;
  timeZone?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      accessToken?: string;
    };

    const rawToken =
      body.accessToken?.trim() ||
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN?.trim() ||
      '';

    if (!rawToken) {
      return NextResponse.json(
        {
          error:
            'Missing Google OAuth access token. Please sign in with Google first.',
        },
        { status: 401 }
      );
    }

    const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&showHidden=false',
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            error:
              'Google OAuth token is expired or lacks calendar.readonly permission. Please sign in with Google again.',
            details: errBody.slice(0, 200),
          },
          { status: res.status }
        );
      }
      return NextResponse.json(
        {
          error: `Google Calendar API returned HTTP ${res.status}: ${errBody.slice(0, 200)}`,
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        summaryOverride?: string;
        description?: string;
        primary?: boolean;
        backgroundColor?: string;
        accessRole?: string;
        timeZone?: string;
        deleted?: boolean;
      }>;
    };

    const items = (data.items || []).filter((item) => !item.deleted);

    const calendars: GoogleCalendarListItem[] = items
      .map((item) => ({
        id: item.id,
        summary:
          item.summaryOverride ||
          item.summary ||
          (item.primary ? 'Primary Calendar' : item.id),
        description: item.description,
        primary: Boolean(item.primary),
        backgroundColor: item.backgroundColor || '#4285F4',
        accessRole: item.accessRole || 'reader',
        timeZone: item.timeZone,
      }))
      .sort((a, b) => {
        if (a.primary && !b.primary) return -1;
        if (!a.primary && b.primary) return 1;
        return a.summary.localeCompare(b.summary);
      });

    const primaryCal = calendars.find((c) => c.primary);
    const accountEmail = primaryCal?.id || calendars[0]?.id || 'Google Account';

    return NextResponse.json({
      accountEmail,
      calendars,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to list calendars from Google.',
      },
      { status: 500 }
    );
  }
}
