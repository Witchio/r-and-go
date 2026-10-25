import {
  AddressSuggestion,
  CALIFORNIA_BOUNDS,
  clampToCalifornia,
  ensureCompleteEventAddress,
  GLOBAL_CITY_CENTERS,
  GLOBAL_LOCATIONS,
  resolveLocationCoordinates,
  searchLocalAddressSuggestions,
  SF_LOCATIONS,
} from '../fixtures/scenarios';
import { CalendarEvent, GeoCoordinates } from '../types';

export type CalendarProviderType =
  | 'demo'
  | 'google-api'
  | 'ical-url'
  | 'ical-file'
  | 'macos-calendar';

export interface ConnectedCalendarSource {
  id: string;
  name: string;
  provider: CalendarProviderType;
  color: string;
  lastSyncedAt: string;
  availableDates: string[]; // YYYY-MM-DD sorted list of dates with events
  events: CalendarEvent[];
  syncConfig?: {
    icalUrl?: string;
    calendarId?: string;
    accessToken?: string;
    apiKey?: string;
  };
}

// Detect if an event is virtual from its location or description
export function detectVirtualMeeting(location?: string, description?: string): boolean {
  const combined = `${location || ''} ${description || ''}`.toLowerCase();
  if (!location || !location.trim()) {
    return (
      combined.includes('zoom.us/') ||
      combined.includes('meet.google.com/') ||
      combined.includes('teams.microsoft.com/')
    );
  }
  const loc = location.toLowerCase().trim();
  return (
    loc.startsWith('http://') ||
    loc.startsWith('https://') ||
    loc.includes('zoom.us') ||
    loc.includes('meet.google.com') ||
    loc.includes('teams.microsoft.com') ||
    loc === 'online' ||
    loc === 'virtual' ||
    loc === 'remote'
  );
}

// Extract an official event/agenda URL from description if present
export function extractEventUrl(description?: string, explicitUrl?: string): string | undefined {
  if (explicitUrl && explicitUrl.trim()) return explicitUrl.trim();
  if (!description) return undefined;
  const match = description.match(/https?:\/\/[^\s)>"]+/i);
  if (!match) return undefined;
  const url = match[0];
  // Ignore pure video call links when looking for an event schedule page
  if (
    url.includes('zoom.us') ||
    url.includes('meet.google.com') ||
    url.includes('teams.microsoft.com')
  ) {
    return undefined;
  }
  return url;
}

// Instant, zero-latency California geocoding resolver (no external network lag)
const geocodeCache = new Map<string, { neighborhood: string; coordinates?: GeoCoordinates }>();

export async function geocodeLocationWithFallback(location?: string): Promise<{
  neighborhood: string;
  coordinates?: GeoCoordinates;
}> {
  if (!location || !location.trim()) {
    return { neighborhood: 'Location missing', coordinates: undefined };
  }

  const trimmed = location.trim();
  const lower = trimmed.toLowerCase();

  if (geocodeCache.has(lower)) {
    return geocodeCache.get(lower)!;
  }

  const resolved = resolveLocationCoordinates(trimmed);
  geocodeCache.set(lower, resolved);
  return resolved;
}

const autocompleteCache = new Map<string, AddressSuggestion[]>();

export async function autocompleteAddresses(
  query: string,
  limit: number = 6
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  const localMatches = searchLocalAddressSuggestions(trimmed, limit);

  if (trimmed.length < 2) {
    return localMatches;
  }

  const cacheKey = trimmed.toLowerCase();
  if (autocompleteCache.has(cacheKey)) {
    return autocompleteCache.get(cacheKey)!;
  }

  const combined: AddressSuggestion[] = [...localMatches];
  const seenAddresses = new Set(
    localMatches.map((m) => m.address.toLowerCase())
  );

  // If fewer than limit local matches exist, enrich with OpenStreetMap Nominatim address search
  if (combined.length < limit) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const hasExplicitCity =
        trimmed.includes(',') ||
        Object.keys(GLOBAL_CITY_CENTERS).some((c) =>
          cacheKey.includes(c)
        );
      const searchQuery = encodeURIComponent(
        hasExplicitCity ? trimmed : `${trimmed}, San Francisco, CA`
      );
      const viewbox = `${CALIFORNIA_BOUNDS.minLng},${CALIFORNIA_BOUNDS.maxLat},${CALIFORNIA_BOUNDS.maxLng},${CALIFORNIA_BOUNDS.minLat}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&viewbox=${viewbox}&bounded=0&q=${searchQuery}`,
        {
          headers: {
            'User-Agent': 'ArgonCalendarTravelPlanner/1.0 (SF-Hackathon)',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as Array<{
          place_id: number;
          lat: string;
          lon: string;
          display_name: string;
          name?: string;
          address?: {
            house_number?: string;
            road?: string;
            neighbourhood?: string;
            suburb?: string;
            city?: string;
            town?: string;
            state?: string;
          };
        }>;

        for (const item of data || []) {
          if (combined.length >= limit) break;
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

          const addr = item.address || {};
          const streetPart = [addr.house_number, addr.road]
            .filter(Boolean)
            .join(' ')
            .trim();
          const primaryText =
            streetPart ||
            item.name ||
            item.display_name.split(',')[0]?.trim() ||
            trimmed;
          const neighborhood =
            addr.neighbourhood ||
            addr.suburb ||
            addr.city ||
            addr.town ||
            primaryText;
          const cityLabel = addr.city || addr.town || 'San Francisco';
          const secondaryParts = [
            neighborhood !== cityLabel ? neighborhood : null,
            cityLabel,
            'CA',
          ].filter(Boolean);
          const secondaryText = secondaryParts.join(', ');
          const cleanAddress = `${primaryText}, ${secondaryText}`;

          if (seenAddresses.has(cleanAddress.toLowerCase())) continue;
          seenAddresses.add(cleanAddress.toLowerCase());

          combined.push({
            id: `osm-${item.place_id}`,
            address: cleanAddress,
            primaryText,
            secondaryText,
            neighborhood,
            coordinates: clampToCalifornia({ lat, lng }),
          });
        }
      }
    } catch {
      // Gracefully fall back to localMatches when offline or timed out
    }
  }

  const finalResults = combined.slice(0, limit);
  autocompleteCache.set(cacheKey, finalResults);
  return finalResults;
}

// Unfold RFC 5545 multi-line fields (lines starting with space or tab continue previous line)
function unfoldIcsLines(rawIcs: string): string[] {
  const normalized = rawIcs.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  return unfolded.split('\n');
}

function unescapeIcsText(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// Parse RFC 5545 DTSTART / DTEND value into ISO 8601 string
export function parseIcsDateTime(rawPropKey: string, rawVal: string): string | null {
  const val = rawVal.trim();
  if (!val) return null;

  // Format 1: YYYYMMDD (All-day event) -> set to 09:00 local PDT (-07:00)
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4);
    const m = val.slice(4, 6);
    const d = val.slice(6, 8);
    return `${y}-${m}-${d}T09:00:00-07:00`;
  }

  // Format 2: YYYYMMDDTHHMMSSZ (UTC) or YYYYMMDDTHHMMSS (local)
  const match = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (match) {
    const [, y, m, d, hh, mm, ss, isUtc] = match;
    if (isUtc === 'Z') {
      const isoUtc = `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`;
      return new Date(isoUtc).toISOString();
    }
    // Treat floating or America/Los_Angeles local times as -07:00 PDT
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}-07:00`;
  }

  // Fallback to Date.parse
  const parsed = Date.parse(val);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}

export const DEFAULT_SYNC_WINDOW_DAYS = 15;

export function getSyncWindowBounds(
  centerMs: number = Date.now(),
  days: number = DEFAULT_SYNC_WINDOW_DAYS
): { timeMinMs: number; timeMaxMs: number; timeMinIso: string; timeMaxIso: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const timeMinMs = centerMs - days * dayMs;
  const timeMaxMs = centerMs + days * dayMs;
  return {
    timeMinMs,
    timeMaxMs,
    timeMinIso: new Date(timeMinMs).toISOString(),
    timeMaxIso: new Date(timeMaxMs).toISOString(),
  };
}

// Parse an RFC 5545 .ics string into normalized CalendarEvent[] within [-15 days, +15 days]
export async function parseIcsToEvents(
  icsText: string,
  sourcePrefix = 'ical',
  windowDays = DEFAULT_SYNC_WINDOW_DAYS
): Promise<CalendarEvent[]> {
  const lines = unfoldIcsLines(icsText);
  const rawEvents: Array<Record<string, { key: string; value: string }>> = [];
  let current: Record<string, { key: string; value: string }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (current) {
        rawEvents.push(current);
      }
      current = null;
      continue;
    }
    if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const fullKey = line.slice(0, colonIdx).trim();
        const baseKey = fullKey.split(';')[0].toUpperCase();
        const value = line.slice(colonIdx + 1);
        current[baseKey] = { key: fullKey, value };
      }
    }
  }

  // First pass: extract raw timestamps and metadata without geocoding yet
  const candidateItems: Array<{
    index: number;
    startIso: string;
    endIso: string;
    startMs: number;
    endMs: number;
    title: string;
    location: string;
    description?: string;
    explicitUrl?: string;
    uid: string;
  }> = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];
    const dtStartProp = item['DTSTART'];
    if (!dtStartProp) continue;

    const startIso = parseIcsDateTime(dtStartProp.key, dtStartProp.value);
    if (!startIso) continue;

    const dtEndProp = item['DTEND'];
    let endIso = dtEndProp
      ? parseIcsDateTime(dtEndProp.key, dtEndProp.value)
      : null;
    if (!endIso) {
      endIso = new Date(new Date(startIso).getTime() + 3600 * 1000).toISOString();
    }

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;

    const title = item['SUMMARY']
      ? unescapeIcsText(item['SUMMARY'].value)
      : 'Untitled Calendar Event';
    const location = item['LOCATION']
      ? unescapeIcsText(item['LOCATION'].value)
      : '';
    const description = item['DESCRIPTION']
      ? unescapeIcsText(item['DESCRIPTION'].value)
      : undefined;
    const explicitUrl = item['URL']
      ? unescapeIcsText(item['URL'].value)
      : undefined;
    const uid = item['UID']
      ? unescapeIcsText(item['UID'].value).replace(/[^a-zA-Z0-9_-]/g, '')
      : `${i + 1}`;

    candidateItems.push({
      index: i,
      startIso,
      endIso,
      startMs,
      endMs,
      title,
      location,
      description,
      explicitUrl,
      uid,
    });
  }

  // Filter to [-15 days, +15 days] around Date.now().
  // If 0 events fall in [-15d, +15d] around Date.now() (e.g. if the calendar's active events are in another month),
  // center the [-15d, +15d] window around the calendar's latest event date.
  const primaryWindow = getSyncWindowBounds(Date.now(), windowDays);
  let windowedItems = candidateItems.filter(
    (c) => c.endMs >= primaryWindow.timeMinMs && c.startMs <= primaryWindow.timeMaxMs
  );

  if (windowedItems.length === 0 && candidateItems.length > 0) {
    const sortedByStart = [...candidateItems].sort((a, b) => a.startMs - b.startMs);
    const latestMs = sortedByStart[sortedByStart.length - 1].startMs;
    const fallbackWindow = getSyncWindowBounds(latestMs, windowDays);
    windowedItems = candidateItems.filter(
      (c) =>
        c.endMs >= fallbackWindow.timeMinMs && c.startMs <= fallbackWindow.timeMaxMs
    );
  }

  const parsedEvents: CalendarEvent[] = [];

  for (const c of windowedItems) {
    const isVirtual = detectVirtualMeeting(c.location, c.description);
    const eventUrl = extractEventUrl(c.description, c.explicitUrl);

    const geo = isVirtual
      ? { neighborhood: 'Virtual Meeting', coordinates: undefined }
      : await geocodeLocationWithFallback(c.location);

    parsedEvents.push(
      ensureCompleteEventAddress(
        {
          id: `${sourcePrefix}-${c.uid}-${c.index}`,
          title: c.title,
          start: c.startIso,
          end: c.endIso,
          location: isVirtual ? c.location || 'Virtual Meeting' : c.location,
          neighborhood: geo.neighborhood,
          coordinates: geo.coordinates,
          description: c.description,
          eventUrl,
          isVirtual,
        },
        c.index
      )
    );
  }

  return parsedEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

// Fetch events from Google Calendar REST API v3 within [-15 days, +15 days]
export async function fetchGoogleCalendarEvents(params: {
  calendarId?: string;
  accessToken?: string;
  apiKey?: string;
  timeMinIso?: string;
  timeMaxIso?: string;
}): Promise<{ calendarName: string; events: CalendarEvent[] }> {
  const calendarId = encodeURIComponent(params.calendarId || 'primary');
  const accessToken =
    params.accessToken || process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const apiKey = params.apiKey || process.env.GOOGLE_MAPS_API_KEY;

  if (!accessToken && !apiKey) {
    throw new Error(
      'Please provide a Google OAuth Access Token (or API Key for a public calendar), or use your Google Calendar Secret Address in iCal (.ics) format.'
    );
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken.replace(/^Bearer\s+/i, '').trim()}`;
  }

  type GCalEventItem = {
    id: string;
    status?: string;
    summary?: string;
    description?: string;
    location?: string;
    htmlLink?: string;
    hangoutLink?: string;
    organizer?: { displayName?: string; email?: string };
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };

  type GCalResponse = {
    summary?: string;
    nextPageToken?: string;
    items?: GCalEventItem[];
  };

  const fetchWindow = async (
    timeMin?: string,
    timeMax?: string
  ): Promise<{ summary?: string; items: GCalEventItem[] }> => {
    const collected: GCalEventItem[] = [];
    let summary: string | undefined;
    let pageToken: string | undefined;

    // Follow up to 3 pages (up to 750 events) so every event in the [-15d, +15d] window is captured
    for (let page = 0; page < 3; page++) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
      );
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');
      if (timeMin) url.searchParams.set('timeMin', timeMin);
      if (timeMax) url.searchParams.set('timeMax', timeMax);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      if (apiKey && !accessToken) {
        url.searchParams.set('key', apiKey);
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(
          `Google Calendar API returned ${res.status}: ${errBody.slice(0, 200)}`
        );
      }
      const data = (await res.json()) as GCalResponse;
      if (data.summary) summary = data.summary;
      if (data.items && data.items.length > 0) {
        collected.push(...data.items);
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return { summary, items: collected };
  };

  // Default to [-15 days, +15 days] around today
  const defaultBounds = getSyncWindowBounds(Date.now(), DEFAULT_SYNC_WINDOW_DAYS);
  const effectiveTimeMin = params.timeMinIso || defaultBounds.timeMinIso;
  const effectiveTimeMax = params.timeMaxIso || defaultBounds.timeMaxIso;

  let data = await fetchWindow(effectiveTimeMin, effectiveTimeMax);

  // If [-15d, +15d] around the current clock has 0 events (e.g. if the environment clock is simulated
  // at Oct 2026 while the user's real calendar events are in another month of 2026), locate the latest
  // active event in 2025-2026 and take [-15 days, +15 days] around that date.
  if (data.items.length === 0 && !params.timeMinIso && !params.timeMaxIso) {
    const probe = await fetchWindow('2026-01-01T00:00:00Z', undefined);
    const activeProbe = probe.items.filter((it) => it.status !== 'cancelled');
    if (activeProbe.length > 0) {
      const lastEvt = activeProbe[activeProbe.length - 1];
      const rawLast = lastEvt.start?.dateTime || lastEvt.start?.date;
      const anchorMs = rawLast ? new Date(rawLast).getTime() : NaN;
      if (!Number.isNaN(anchorMs)) {
        const centered = getSyncWindowBounds(anchorMs, DEFAULT_SYNC_WINDOW_DAYS);
        data = await fetchWindow(centered.timeMinIso, centered.timeMaxIso);
      } else {
        data = probe;
      }
    }
  }

  const items = (data.items || []).filter((it) => it.status !== 'cancelled');
  const normalized: CalendarEvent[] = [];

  for (const item of items) {
    const rawStart = item.start?.dateTime || (item.start?.date ? `${item.start.date}T09:00:00-07:00` : null);
    const rawEnd = item.end?.dateTime || (item.end?.date ? `${item.end.date}T10:00:00-07:00` : null);
    if (!rawStart || !rawEnd) continue;

    const location = item.location || '';
    const isVirtual =
      Boolean(item.hangoutLink) ||
      detectVirtualMeeting(location, item.description);
    const geo = isVirtual
      ? { neighborhood: 'Virtual Meeting', coordinates: undefined }
      : await geocodeLocationWithFallback(location);

    normalized.push(
      ensureCompleteEventAddress(
        {
          id: `gcal-${item.id}`,
          title: item.summary || 'Busy / Untitled Event',
          start: new Date(rawStart).toISOString(),
          end: new Date(rawEnd).toISOString(),
          location: isVirtual ? item.hangoutLink || location || 'Google Meet' : location,
          neighborhood: geo.neighborhood,
          coordinates: geo.coordinates,
          organizer: item.organizer?.displayName || item.organizer?.email,
          description: item.description,
          eventUrl: extractEventUrl(item.description),
          isVirtual,
        },
        normalized.length
      )
    );
  }

  return {
    calendarName: data.summary || params.calendarId || 'Google Calendar',
    events: normalized,
  };
}

// Group events by local date (YYYY-MM-DD in America/Los_Angeles)
export function getLocalDateKey(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    // ignore
  }
  return iso.slice(0, 10);
}

export function extractAvailableDates(events: CalendarEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    set.add(getLocalDateKey(e.start));
  }
  return Array.from(set).sort();
}
