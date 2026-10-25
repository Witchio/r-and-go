import { NextRequest, NextResponse } from 'next/server';
import { inflateRawSync } from 'zlib';
import {
  CalendarProviderType,
  ConnectedCalendarSource,
  extractAvailableDates,
  fetchGoogleCalendarEvents,
  parseIcsToEvents,
} from '@/lib/adapters/calendar-integrations';

/**
 * Extracts all .ics text files from a base64-encoded .zip archive (such as Google Calendar's
 * "Export calendar" .ical.zip download) using Node's built-in zlib.
 */
function extractIcsFromZipBase64(zipBase64: string): {
  icsContents: string[];
  fileNames: string[];
} {
  const buf = Buffer.from(zipBase64, 'base64');
  const icsContents: string[] = [];
  const fileNames: string[] = [];

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Uploaded file is not a valid .zip archive.');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  let ptr = cdOffset;
  for (let entry = 0; entry < totalEntries && ptr + 46 <= buf.length; entry++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;

    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const fileNameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    const fileName = buf
      .subarray(ptr + 46, ptr + 46 + fileNameLen)
      .toString('utf8');

    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (
      fileName.toLowerCase().endsWith('.ics') &&
      !fileName.includes('__MACOSX') &&
      localHeaderOffset + 30 <= buf.length
    ) {
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = buf.subarray(
        dataStart,
        dataStart + compressedSize
      );

      let content = '';
      if (compressionMethod === 0) {
        content = compressedSlice.toString('utf8');
      } else if (compressionMethod === 8) {
        content = inflateRawSync(compressedSlice).toString('utf8');
      }

      if (content.includes('BEGIN:VCALENDAR')) {
        icsContents.push(content);
        fileNames.push(fileName.replace(/\.ics$/i, ''));
      }
    }
  }

  return { icsContents, fileNames };
}

const SAMPLE_PERSONAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
X-WR-CALNAME:Personal SF Calendar (Synced)
BEGIN:VEVENT
UID:personal-evt-101@google.com
DTSTART:20261025T083000
DTEND:20261025T093000
SUMMARY:Morning Espresso & Pitch Prep
LOCATION:235 Montgomery St, Financial District, San Francisco, CA 94104
DESCRIPTION:Review slide deck before heading to Ferry Building.
END:VEVENT
BEGIN:VEVENT
UID:personal-evt-102@google.com
DTSTART:20261025T100000
DTEND:20261025T140000
SUMMARY:Gemini 4 Argon SF Hackathon @ SHACK15
LOCATION:SHACK15, 1 Ferry Building Suite 201, San Francisco, CA 94111
DESCRIPTION:Official schedule: core demo build 10:00 AM - 2:00 PM at Ferry Building.
URL:/organizer/dev-summit
END:VEVENT
BEGIN:VEVENT
UID:personal-evt-103@google.com
DTSTART:20261025T143000
DTEND:20261025T153000
SUMMARY:1:1 Co-Founder Sync
LOCATION:Moscone Center, 747 Howard St, San Francisco, CA 94103
DESCRIPTION:In-person architecture check-in at Yerba Buena / Moscone Center.
END:VEVENT
BEGIN:VEVENT
UID:personal-evt-104@google.com
DTSTART:20261025T160000
DTEND:20261025T163000
SUMMARY:Investor Update Call (Google Meet)
LOCATION:https://meet.google.com/abc-defg-hij
DESCRIPTION:Remote video call - virtual meeting.
END:VEVENT
END:VCALENDAR`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider: CalendarProviderType | 'sample-personal';
      name?: string;
      icalUrl?: string;
      icsText?: string;
      zipBase64?: string;
      calendarId?: string;
      accessToken?: string;
      apiKey?: string;
      color?: string;
      timeMinIso?: string;
      timeMaxIso?: string;
    };

    if (body.provider === 'google-api') {
      const { calendarName, events } = await fetchGoogleCalendarEvents({
        calendarId: body.calendarId,
        accessToken: body.accessToken,
        apiKey: body.apiKey,
        timeMinIso: body.timeMinIso,
        timeMaxIso: body.timeMaxIso,
      });

      const availableDates = extractAvailableDates(events);
      const source: ConnectedCalendarSource = {
        id: `src-google-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: body.name?.trim() || calendarName,
        provider: 'google-api',
        color: body.color || '#4285F4',
        lastSyncedAt: new Date().toISOString(),
        availableDates,
        events,
        syncConfig: {
          calendarId: body.calendarId || 'primary',
          accessToken: body.accessToken,
          apiKey: body.apiKey,
        },
      };

      return NextResponse.json({ source });
    }

    if (body.provider === 'ical-url') {
      if (!body.icalUrl || !body.icalUrl.trim()) {
        return NextResponse.json(
          { error: 'Please provide a valid iCal (.ics) or webcal:// URL.' },
          { status: 400 }
        );
      }

      // Normalize webcal:// to https://
      const normalizedUrl = body.icalUrl
        .trim()
        .replace(/^webcal:\/\//i, 'https://');

      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'ArgonCalendarTravelPlanner/1.0',
          Accept: 'text/calendar, text/plain, */*',
        },
      });

      if (!response.ok) {
        // Detect Google Calendar "/public/basic.ics" 404 specifically and explain why Google returns 404
        const googlePublicMatch = normalizedUrl.match(
          /calendar\.google\.com\/calendar\/ical\/([^/]+)\/public\/basic\.ics/i
        );
        if (response.status === 404 && googlePublicMatch) {
          const decodedCalId = decodeURIComponent(googlePublicMatch[1]);
          return NextResponse.json(
            {
              error: `Google Calendar returned 404 Not Found for "${decodedCalId}/public/basic.ics" because that calendar is private (not set to "Make available to public"). To connect a private or Google Workspace calendar: (1) Copy the "Secret address in iCal format" (.../private-xxxx/basic.ics) from Google Calendar Settings → Integrate calendar, OR (2) Click "Export calendar" in Google Calendar Settings and upload the downloaded .zip / .ics file in the "Upload .ics / .zip" tab, OR (3) Enable "Make available to public" in Google Calendar settings.`,
              errorCode: 'GOOGLE_PUBLIC_ICAL_404',
              calendarId: decodedCalId,
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            error: `Failed to fetch iCal feed (HTTP ${response.status}). Verify the URL is a valid "Secret address in iCal format" (.../private-xxxx/basic.ics) or a publicly shared .ics link.`,
          },
          { status: 400 }
        );
      }

      const icsText = await response.text();
      if (!icsText.includes('BEGIN:VCALENDAR')) {
        return NextResponse.json(
          {
            error:
              'The URL did not return a valid RFC 5545 iCalendar (BEGIN:VCALENDAR) feed.',
          },
          { status: 400 }
        );
      }

      // Extract X-WR-CALNAME if present
      const calNameMatch = icsText.match(/X-WR-CALNAME:([^\r\n]+)/i);
      const inferredName = calNameMatch ? calNameMatch[1].trim() : 'iCal Feed';

      const events = await parseIcsToEvents(icsText, 'ical');
      const availableDates = extractAvailableDates(events);

      const source: ConnectedCalendarSource = {
        id: `src-ical-url-${Date.now()}`,
        name: body.name?.trim() || inferredName,
        provider: 'ical-url',
        color: '#0ea5e9',
        lastSyncedAt: new Date().toISOString(),
        availableDates,
        events,
        syncConfig: {
          icalUrl: normalizedUrl,
        },
      };

      return NextResponse.json({ source });
    }

    if (body.provider === 'ical-file' || body.provider === 'sample-personal') {
      let rawIcsList: string[] = [];
      let defaultName = 'Imported .ics Calendar';

      if (body.provider === 'sample-personal') {
        rawIcsList = [SAMPLE_PERSONAL_ICS];
      } else if (body.zipBase64) {
        const extracted = extractIcsFromZipBase64(body.zipBase64);
        if (extracted.icsContents.length === 0) {
          return NextResponse.json(
            {
              error:
                'No valid .ics calendar files were found inside the uploaded .zip archive.',
            },
            { status: 400 }
          );
        }
        rawIcsList = extracted.icsContents;
        if (extracted.fileNames[0]) {
          defaultName = extracted.fileNames[0];
        }
      } else if (body.icsText) {
        rawIcsList = [body.icsText];
      }

      if (
        rawIcsList.length === 0 ||
        !rawIcsList.some((ics) => ics.includes('BEGIN:VCALENDAR'))
      ) {
        return NextResponse.json(
          { error: 'Uploaded content is not a valid .ics calendar file.' },
          { status: 400 }
        );
      }

      const firstIcs = rawIcsList[0];
      const calNameMatch = firstIcs.match(/X-WR-CALNAME:([^\r\n]+)/i);
      const inferredName = calNameMatch
        ? calNameMatch[1].trim()
        : defaultName;

      const allEvents = [];
      for (let idx = 0; idx < rawIcsList.length; idx++) {
        const evts = await parseIcsToEvents(rawIcsList[idx], `icsfile-${idx}`);
        allEvents.push(...evts);
      }
      allEvents.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      const availableDates = extractAvailableDates(allEvents);

      const source: ConnectedCalendarSource = {
        id: `src-ics-${Date.now()}`,
        name: body.name?.trim() || inferredName,
        provider: 'ical-file',
        color: '#10b981',
        lastSyncedAt: new Date().toISOString(),
        availableDates,
        events: allEvents,
      };

      return NextResponse.json({ source });
    }

    return NextResponse.json(
      { error: `Unsupported calendar provider: ${body.provider}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to sync calendar integration.',
      },
      { status: 500 }
    );
  }
}
