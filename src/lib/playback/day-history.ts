import { CalendarEvent, TravelMode } from '../types';

export interface DayFixtureRecord {
  dateIso: string; // YYYY-MM-DD in active timezone
  dateLabel: string;
  dayTitle: string;
  daySubtitle: string;
  isHistoricalMock: boolean;
  events: CalendarEvent[];
  defaultModes?: Record<string, TravelMode>;
}

export const TODAY_DATE_ISO = '2026-10-25';
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Previous Day 1 Fixture: Saturday, October 24, 2026
 * 4 physical destinations across SF with playable route corridors and conflict-free transitions.
 */
export const PREVIOUS_DAY_OCT_24_EVENTS: CalendarEvent[] = [
  {
    id: 'oct24-evt1',
    title: 'Embarcadero Run Club & Espresso',
    start: '2026-10-24T08:30:00-07:00',
    end: '2026-10-24T09:45:00-07:00',
    location: '1 Ferry Building, The Embarcadero, San Francisco, CA 94111',
    neighborhood: 'Ferry Building',
    coordinates: { lat: 37.7955, lng: -122.3937 },
    organizer: 'SF Founders Run Club',
    description: 'Morning waterfront warm-up and coffee at Ferry Building plaza.',
    isVirtual: false,
  },
  {
    id: 'oct24-evt2',
    title: 'Argon Model Architecture Workshop',
    start: '2026-10-24T10:15:00-07:00',
    end: '2026-10-24T13:15:00-07:00',
    location: 'Moscone Center, 747 Howard St, San Francisco, CA 94103',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7841, lng: -122.4014 },
    organizer: 'DeepMind DevRel Team',
    description:
      'Hands-on structured extraction and deterministic tool verification workshop at Moscone West.',
    isVirtual: false,
  },
  {
    id: 'oct24-evt3',
    title: 'Design Critique & Prototype Review',
    start: '2026-10-24T13:45:00-07:00',
    end: '2026-10-24T15:15:00-07:00',
    location: '333 Post St, Union Square, San Francisco, CA 94108',
    neighborhood: 'Union Square',
    coordinates: { lat: 37.7879, lng: -122.4075 },
    organizer: 'Product Design Guild',
    description:
      'Afternoon design review at Union Square studio with comfortable transit buffer from SoMa.',
    isVirtual: false,
  },
  {
    id: 'oct24-evt4',
    title: 'Mission Rooftop Taco Social',
    start: '2026-10-24T16:00:00-07:00',
    end: '2026-10-24T18:00:00-07:00',
    location: '500 Valencia St, Mission District, San Francisco, CA 94110',
    neighborhood: 'Mission District',
    coordinates: { lat: 37.7648, lng: -122.4195 },
    organizer: 'Bay Area Builders',
    description: 'Evening team dinner at 16th & Valencia.',
    isVirtual: false,
  },
];

/**
 * Previous Day 2 Fixture: Friday, October 23, 2026
 * Includes a cross-midnight late-night deployment event that overlaps into Oct 24!
 */
export const PREVIOUS_DAY_OCT_23_EVENTS: CalendarEvent[] = [
  {
    id: 'oct23-evt1',
    title: 'Venture Partner Pitch Rehearsal',
    start: '2026-10-23T09:30:00-07:00',
    end: '2026-10-23T11:00:00-07:00',
    location: '235 Montgomery St, Financial District, San Francisco, CA 94104',
    neighborhood: 'Financial District',
    coordinates: { lat: 37.7894, lng: -122.4014 },
    organizer: 'Benchmark & Friends',
    description: 'Deck review on Montgomery St.',
    isVirtual: false,
  },
  {
    id: 'oct23-evt2',
    title: 'Civic Tech Open Data Sync',
    start: '2026-10-23T11:30:00-07:00',
    end: '2026-10-23T13:00:00-07:00',
    location: '1 Dr Carlton B Goodlett Pl, Civic Center, San Francisco, CA 94102',
    neighborhood: 'Civic Center',
    coordinates: { lat: 37.7793, lng: -122.4175 },
    organizer: 'DataSF Transit Team',
    description: 'GTFS transit feed & Muni reliability discussion.',
    isVirtual: false,
  },
  {
    id: 'oct23-evt3',
    title: 'Waterfront Hardware Demo & Late Night Hack',
    start: '2026-10-23T21:30:00-07:00',
    end: '2026-10-24T00:45:00-07:00', // Cross-midnight event!
    location: 'Pier 27 Cruise Terminal, 27 The Embarcadero, San Francisco, CA 94111',
    neighborhood: 'North Waterfront',
    coordinates: { lat: 37.8065, lng: -122.4018 },
    organizer: 'SF Hardware Collective',
    description:
      'Cross-midnight build session stretching from Friday 9:30 PM to Saturday 12:45 AM.',
    isVirtual: false,
  },
];

export const HISTORICAL_DAY_FIXTURES: Record<string, DayFixtureRecord> = {
  '2026-10-24': {
    dateIso: '2026-10-24',
    dateLabel: 'SATURDAY · OCT 24',
    dayTitle: 'Hackathon Kickoff & Design Critique',
    daySubtitle:
      'Reconstructed past day · 4 SF stops (Ferry Building → SoMa → Union Square → Mission)',
    isHistoricalMock: true,
    events: PREVIOUS_DAY_OCT_24_EVENTS,
  },
  '2026-10-23': {
    dateIso: '2026-10-23',
    dateLabel: 'FRIDAY · OCT 23',
    dayTitle: 'Partner Pitch & Cross-Midnight Build',
    daySubtitle:
      'Reconstructed past day · Includes cross-midnight Pier 27 session (9:30 PM – 12:45 AM)',
    isHistoricalMock: true,
    events: PREVIOUS_DAY_OCT_23_EVENTS,
  },
  '2026-10-22': {
    dateIso: '2026-10-22',
    dateLabel: 'THURSDAY · OCT 22',
    dayTitle: 'No Scheduled Events (Focus Day)',
    daySubtitle: 'Empty calendar day fixture · Verified zero commitments',
    isHistoricalMock: true,
    events: [],
  },
};

/**
 * Shifts a YYYY-MM-DD date string by `deltaDays` (e.g., -1 for previous day, +1 for next day).
 */
export function shiftDateIso(dateIso: string, deltaDays: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns true if `dateIso` is strictly before `todayIso`.
 */
export function isPastDateIso(
  dateIso: string,
  todayIso: string = TODAY_DATE_ISO
): boolean {
  return dateIso < todayIso;
}

/**
 * Formats a YYYY-MM-DD string into a readable badge (e.g. "SATURDAY · OCT 24, 2026").
 */
export function formatDateHeading(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

/**
 * Computes the UTC epoch millisecond interval `[dayStartMs, dayEndMs)` for a given
 * `YYYY-MM-DD` calendar date in the target IANA timezone, properly handling DST transitions.
 */
export function getDayBoundsInTimezone(
  dateIso: string,
  timeZone: string = DEFAULT_TIMEZONE
): { dayStartMs: number; dayEndMs: number } {
  const getLocalOffsetMs = (utcMs: number): number => {
    const dt = new Date(utcMs);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = Number(p.value);
    }
    const hour = map.hour === 24 ? 0 : map.hour;
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      hour,
      map.minute,
      map.second
    );
    return asUtc - utcMs;
  };

  const [y, m, d] = dateIso.split('-').map(Number);
  const approxStartUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const startOffset = getLocalOffsetMs(approxStartUtc);
  const dayStartMs = approxStartUtc - startOffset;

  const approxEndUtc = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  const endOffset = getLocalOffsetMs(approxEndUtc);
  const dayEndMs = approxEndUtc - endOffset;

  return { dayStartMs, dayEndMs };
}

/**
 * Filters a pool of calendar events to those that overlap the selected date's
 * [00:00, 24:00) interval in the active timezone, including cross-midnight events (R11).
 */
export function filterEventsOverlappingDay(
  allEvents: CalendarEvent[],
  dateIso: string,
  timeZone: string = DEFAULT_TIMEZONE
): CalendarEvent[] {
  const { dayStartMs, dayEndMs } = getDayBoundsInTimezone(dateIso, timeZone);

  return allEvents
    .filter((evt) => {
      const evtStartMs = new Date(evt.start).getTime();
      const evtEndMs = new Date(evt.effectiveEnd || evt.end).getTime();
      // An event overlaps the selected day if it starts before dayEnd and ends after dayStart
      return evtStartMs < dayEndMs && evtEndMs > dayStartMs;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
