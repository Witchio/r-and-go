import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  ConnectedCalendarSource,
  detectVirtualMeeting,
  extractAvailableDates,
  extractEventUrl,
  geocodeLocationWithFallback,
} from '@/lib/adapters/calendar-integrations';
import { CalendarEvent } from '@/lib/types';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    // Query macOS Calendar.app for events within -15 days to +15 days of today using JXA (JavaScript for Automation)
    const jxaScript = `
      const Calendar = Application('Calendar');
      const now = new Date();
      const startWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15, 0, 0, 0);
      const endWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15, 23, 59, 59);
      const results = [];
      const cals = Calendar.calendars();
      for (let i = 0; i < cals.length; i++) {
        const cal = cals[i];
        const calName = cal.name();
        const evts = cal.events.whose({
          _and: [
            { startDate: { _greaterThan: startWindow } },
            { startDate: { _lessThan: endWindow } }
          ]
        })();
        for (let j = 0; j < evts.length; j++) {
          const e = evts[j];
          results.push({
            uid: e.uid(),
            title: e.summary(),
            start: e.startDate().toISOString(),
            end: e.endDate().toISOString(),
            location: e.location() || '',
            description: e.description() || '',
            url: e.url() || '',
            calendarName: calName
          });
        }
      }
      JSON.stringify(results);
    `;

    const { stdout } = await execFileAsync(
      'osascript',
      ['-l', 'JavaScript', '-e', jxaScript],
      { timeout: 8000 }
    );

    const rawItems = JSON.parse(stdout.trim() || '[]') as Array<{
      uid: string;
      title: string;
      start: string;
      end: string;
      location: string;
      description: string;
      url: string;
      calendarName: string;
    }>;

    const events: CalendarEvent[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const r = rawItems[i];
      const isVirtual = detectVirtualMeeting(r.location, r.description);
      const geo = isVirtual
        ? { neighborhood: 'Virtual Meeting', coordinates: undefined }
        : await geocodeLocationWithFallback(r.location);

      events.push({
        id: `macos-${r.uid}-${i}`,
        title: r.title || 'Untitled macOS Event',
        start: r.start,
        end: r.end,
        location: r.location,
        neighborhood: geo.neighborhood,
        coordinates: geo.coordinates,
        organizer: r.calendarName,
        description: r.description || undefined,
        eventUrl: extractEventUrl(r.description, r.url),
        isVirtual,
      });
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const source: ConnectedCalendarSource = {
      id: `src-macos-${Date.now()}`,
      name: 'macOS Calendar.app',
      provider: 'macos-calendar',
      color: '#f59e0b',
      lastSyncedAt: new Date().toISOString(),
      availableDates: extractAvailableDates(events),
      events,
    };

    return NextResponse.json({ source });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `macOS Calendar access error: ${err.message}. You can also export an .ics file from Calendar.app or paste an iCal/Google URL.`
            : 'Unable to read from macOS Calendar.app.',
      },
      { status: 500 }
    );
  }
}
