import { describe, expect, it } from 'vitest';
import {
  CALIFORNIA_CORRIDOR_SAMPLE_EVENTS,
  HANDOVER_SAMPLE_EVENTS,
  isWithinCalifornia,
  resolveLocationCoordinates,
  searchLocalAddressSuggestions,
} from '../fixtures/scenarios';
import { evaluateItinerary } from '../engine/conflict-engine';
import {
  buildPlaybackTimeline,
  computeEventPlaybackDurationSeconds,
  computeViewportBounds,
  sampleTimelineAt,
} from './playback-engine';
import {
  HISTORICAL_DAY_FIXTURES,
  PREVIOUS_DAY_OCT_23_EVENTS,
  PREVIOUS_DAY_OCT_24_EVENTS,
  filterEventsOverlappingDay,
  isPastDateIso,
  shiftDateIso,
} from './day-history';
import { CalendarEvent } from '../types';

const CONFLICT_PLAYBACK_FIXTURE_EVENTS: CalendarEvent[] = [
  {
    id: 'evt1',
    title: 'Product meeting',
    start: '2026-10-25T09:00:00-07:00',
    end: '2026-10-25T10:45:00-07:00',
    location: 'Union Square, San Francisco, CA',
    neighborhood: 'Union Square',
    coordinates: { lat: 37.7879, lng: -122.4075 },
    organizer: 'Core Product Team',
    description: 'Q4 roadmap sign-off and hardware sprint review at Union Square studio.',
    isVirtual: false,
  },
  {
    id: 'evt2',
    title: 'Developer summit',
    start: '2026-10-25T11:00:00-07:00',
    end: '2026-10-25T16:00:00-07:00',
    location: 'Ferry Building, San Francisco, CA',
    neighborhood: 'Ferry Building',
    coordinates: { lat: 37.7955, lng: -122.3937 },
    organizer: 'Bay Area Systems Collective',
    description:
      'Illustrative official agenda: core talks until 14:30, optional networking 14:30–16:00',
    eventUrl: '/organizer/dev-summit',
    isVirtual: false,
  },
  {
    id: 'evt3',
    title: 'Client coffee',
    start: '2026-10-25T15:00:00-07:00',
    end: '2026-10-25T15:45:00-07:00',
    location: 'SoMa, San Francisco, CA',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7816, lng: -122.3942 },
    organizer: 'Elena Rostova (Acme Robotics)',
    description: 'In-person contract renewal discussion at South Park cafe in SoMa.',
    isVirtual: false,
  },
  {
    id: 'evt4',
    title: 'Community dinner',
    start: '2026-10-25T17:00:00-07:00',
    end: '2026-10-25T18:30:00-07:00',
    location: '',
    neighborhood: 'Location missing',
    organizer: 'SF AI Engineers Guild',
    description: 'Hosted community dinner and lightning demos. Venue link in organizer page.',
    eventUrl: '/organizer/community-dinner',
    isVirtual: false,
  },
];

describe('R10 Animated 2D Itinerary Playback Engine', () => {
  it('builds a timeline with walk, wait, and ride transit sub-segments and missing-location gaps', () => {
    const evalResult = evaluateItinerary(CONFLICT_PLAYBACK_FIXTURE_EVENTS, {}, 5);
    const timeline = buildPlaybackTimeline({
      events: evalResult.events,
      legs: evalResult.legs,
      conflicts: evalResult.conflicts,
    });

    expect(timeline.playablePhysicalEventsCount).toBe(3); // evt1, evt2, evt3 (evt4 is missing location)
    expect(timeline.totalPlaybackSeconds).toBeGreaterThan(10);

    // Check that transit leg (evt1 -> evt2) is broken into walk, wait (stationary), and ride segments
    const leg1Steps = timeline.segments.filter(
      (s) => s.legId === 'leg-evt1-evt2'
    );
    expect(leg1Steps.some((s) => s.kind === 'travel_walk')).toBe(true);
    expect(
      leg1Steps.some((s) => s.kind === 'travel_wait' && s.isStationary)
    ).toBe(true);
    expect(
      leg1Steps.some(
        (s) => s.kind === 'travel_ride' && s.travelerMode === 'transit'
      )
    ).toBe(true);

    // Check that missing-location evt4 produces an explicit unavailable_gap segment without invented geometry
    const missingGap = timeline.segments.find((s) => s.eventId === 'evt4');
    expect(missingGap?.isUnavailableGap).toBe(true);
    expect(missingGap?.pathCoordinates).toHaveLength(0);
  });

  it('accelerates long events while scaling total playback duration with more events', () => {
    const short45Min = computeEventPlaybackDurationSeconds(45);
    const long300Min = computeEventPlaybackDurationSeconds(300);

    // A 300-minute (5h) event takes longer in playback than a 45-min event,
    // but is heavily accelerated rather than 6.6x longer
    expect(long300Min).toBeGreaterThan(short45Min);
    expect(long300Min).toBeLessThan(short45Min * 2.5);

    // Adding more events increases total playback duration
    const twoEventsEval = evaluateItinerary(
      HANDOVER_SAMPLE_EVENTS.slice(0, 2),
      {},
      5
    );
    const fullDayEval = evaluateItinerary(HANDOVER_SAMPLE_EVENTS, {}, 5);

    const twoEventsTimeline = buildPlaybackTimeline({
      events: twoEventsEval.events,
      legs: twoEventsEval.legs,
      conflicts: twoEventsEval.conflicts,
    });
    const fullDayTimeline = buildPlaybackTimeline({
      events: fullDayEval.events,
      legs: fullDayEval.legs,
      conflicts: fullDayEval.conflicts,
    });

    expect(fullDayTimeline.totalPlaybackSeconds).toBeGreaterThan(
      twoEventsTimeline.totalPlaybackSeconds
    );
  });

  it('supports interactive leave_on_time vs stay_until_end decisions at conflict boundaries', () => {
    const evalResult = evaluateItinerary(CONFLICT_PLAYBACK_FIXTURE_EVENTS, {}, 5);

    // Default (staying until scheduled end of Developer summit at 16:00) results in late arrival at Client coffee (15:00)
    const stayTimeline = buildPlaybackTimeline({
      events: evalResult.events,
      legs: evalResult.legs,
      conflicts: evalResult.conflicts,
      conflictDecisions: { 'leg-evt2-evt3': 'stay_until_end' },
    });

    const evt3StaySeg = stayTimeline.segments.find((s) => s.eventId === 'evt3');
    expect(evt3StaySeg?.isLateArrival).toBe(true);
    expect(evt3StaySeg?.lateByMinutes).toBe(76); // 16:00 + 16m transit = 16:16 arrival vs 15:00 start

    // Choosing interactive 'leave_on_time' departs Developer summit at recommendedLeaveIso (14:39) and arrives on time!
    const leaveOnTimeTimeline = buildPlaybackTimeline({
      events: evalResult.events,
      legs: evalResult.legs,
      conflicts: evalResult.conflicts,
      conflictDecisions: { 'leg-evt2-evt3': 'leave_on_time' },
    });

    const evt3OnTimeSeg = leaveOnTimeTimeline.segments.find(
      (s) => s.eventId === 'evt3' && s.kind === 'event_attendance'
    );
    expect(evt3OnTimeSeg?.isLateArrival).toBe(false);
    expect(evt3OnTimeSeg?.lateByMinutes).toBe(0);
  });

  it('produces identical deterministic state when seeking to any timestamp', () => {
    const evalResult = evaluateItinerary(PREVIOUS_DAY_OCT_24_EVENTS, {}, 5);
    const timeline = buildPlaybackTimeline({
      events: evalResult.events,
      legs: evalResult.legs,
      conflicts: evalResult.conflicts,
      isPastDay: true,
    });

    const midTime = timeline.totalPlaybackSeconds * 0.55;
    const sampleA = sampleTimelineAt(timeline, midTime);
    const sampleB = sampleTimelineAt(timeline, midTime);

    expect(sampleA).toEqual(sampleB);
    expect(sampleA.coordinates).not.toBeNull();
    expect(sampleA.svgPoint).not.toBeNull();
  });

  it('updates playback segments and route geometry when the selected transport mode changes', () => {
    const transitEval = evaluateItinerary(
      HANDOVER_SAMPLE_EVENTS,
      { 'leg-evt1-evt2': 'transit' },
      5
    );
    const bikeEval = evaluateItinerary(
      HANDOVER_SAMPLE_EVENTS,
      { 'leg-evt1-evt2': 'bicycling' },
      5
    );

    const transitTimeline = buildPlaybackTimeline({
      events: transitEval.events,
      legs: transitEval.legs,
      conflicts: transitEval.conflicts,
    });
    const bikeTimeline = buildPlaybackTimeline({
      events: bikeEval.events,
      legs: bikeEval.legs,
      conflicts: bikeEval.conflicts,
    });

    const transitSteps = transitTimeline.segments.filter(
      (s) => s.legId === 'leg-evt1-evt2'
    );
    const bikeSteps = bikeTimeline.segments.filter(
      (s) => s.legId === 'leg-evt1-evt2' && s.kind === 'travel_ride'
    );

    expect(transitSteps.length).toBeGreaterThanOrEqual(4); // walk, wait, ride, walk
    expect(bikeSteps.length).toBe(1);
    expect(bikeSteps[0].travelerMode).toBe('bicycling');
  });

  it('starts playback from the user-specified Home address when provided, and starts at Event 1 when omitted', () => {
    const evalResult = evaluateItinerary(HANDOVER_SAMPLE_EVENTS, {}, 5);
    const withHomeTimeline = buildPlaybackTimeline({
      events: evalResult.events,
      legs: evalResult.legs,
      conflicts: evalResult.conflicts,
      homeOrigin: {
        address: '450 Hayes St, Hayes Valley, San Francisco, CA',
        neighborhood: 'Hayes Valley',
        coordinates: { lat: 37.7766, lng: -122.4232 },
        preferredMode: 'transit',
      },
      bufferMinutes: 5,
    });

    expect(withHomeTimeline.homeLeg).not.toBeNull();
    expect(withHomeTimeline.segments[0].id).toBe('seg-home-origin-start');
    expect(
      withHomeTimeline.segments.some((s) => s.legId === 'leg-home-origin')
    ).toBe(true);

    const startSample = sampleTimelineAt(withHomeTimeline, 0);
    expect(startSample.coordinates).toEqual({
      lat: 37.7766,
      lng: -122.4232,
    });

    // When the last event has coordinates (e.g., PREVIOUS_DAY_OCT_24_EVENTS), homeReturnLeg and end-of-day home destination segment are automatically appended
    const oct24Eval = evaluateItinerary(PREVIOUS_DAY_OCT_24_EVENTS, {}, 5);
    const oct24WithHome = buildPlaybackTimeline({
      events: oct24Eval.events,
      legs: oct24Eval.legs,
      conflicts: oct24Eval.conflicts,
      homeOrigin: {
        address: '450 Hayes St, Hayes Valley, San Francisco, CA',
        neighborhood: 'Hayes Valley',
        coordinates: { lat: 37.7766, lng: -122.4232 },
        preferredMode: 'transit',
        preferredReturnMode: 'driving',
      },
      bufferMinutes: 5,
    });

    expect(oct24WithHome.homeReturnLeg).not.toBeNull();
    expect(oct24WithHome.homeReturnLeg?.selectedMode).toBe('driving');
    expect(oct24WithHome.homeReturnLeg?.toEventId).toBe('evt-home-return');
    const lastSeg = oct24WithHome.segments[oct24WithHome.segments.length - 1];
    expect(lastSeg.id).toBe('seg-home-return-end');
    expect(lastSeg.eventId).toBe('evt-home-return');
  });
});

describe('R11 Previous-Day Browsing & Timezone/Cross-Midnight Filtering', () => {
  it('shifts dates and identifies past dates accurately', () => {
    expect(shiftDateIso('2026-10-25', -1)).toBe('2026-10-24');
    expect(shiftDateIso('2026-10-24', 1)).toBe('2026-10-25');
    expect(isPastDateIso('2026-10-24', '2026-10-25')).toBe(true);
    expect(isPastDateIso('2026-10-25', '2026-10-25')).toBe(false);
  });

  it('includes cross-midnight events in both overlapping calendar dates', () => {
    const combinedPool = [
      ...PREVIOUS_DAY_OCT_23_EVENTS,
      ...PREVIOUS_DAY_OCT_24_EVENTS,
    ];

    const oct23Filtered = filterEventsOverlappingDay(
      combinedPool,
      '2026-10-23',
      'America/Los_Angeles'
    );
    const oct24Filtered = filterEventsOverlappingDay(
      combinedPool,
      '2026-10-24',
      'America/Los_Angeles'
    );

    // oct23-evt3 runs from 2026-10-23T21:30-07:00 to 2026-10-24T00:45-07:00, so it overlaps both Oct 23 and Oct 24!
    expect(oct23Filtered.some((e) => e.id === 'oct23-evt3')).toBe(true);
    expect(oct24Filtered.some((e) => e.id === 'oct23-evt3')).toBe(true);
  });

  it('provides distinct previous-day and empty-day fixtures', () => {
    expect(HISTORICAL_DAY_FIXTURES['2026-10-24'].events.length).toBe(4);
    expect(HISTORICAL_DAY_FIXTURES['2026-10-22'].events.length).toBe(0);
  });
});

describe('California Regional Viewport Bounds, Geocoding & Routing', () => {
  it('resolves California landmarks and city centers across Silicon Valley, Bay Area, and SoCal', () => {
    const stanford = resolveLocationCoordinates('Stanford University, Palo Alto, CA');
    expect(stanford.coordinates?.lat).toBeCloseTo(37.4275, 3);
    expect(stanford.coordinates?.lng).toBeCloseTo(-122.1697, 3);
    expect(isWithinCalifornia(stanford.coordinates)).toBe(true);

    const googleplex = resolveLocationCoordinates('Googleplex, Mountain View, CA');
    expect(googleplex.coordinates?.lat).toBeCloseTo(37.422, 3);
    expect(isWithinCalifornia(googleplex.coordinates)).toBe(true);

    const santaMonica = resolveLocationCoordinates('Ocean Ave, Santa Monica, CA');
    expect(santaMonica.coordinates?.lat).toBeCloseTo(34.0195, 2);
    expect(isWithinCalifornia(santaMonica.coordinates)).toBe(true);
  });

  it('returns ranked, deduplicated address autocomplete suggestions for partial street and neighborhood queries', () => {
    const defaultSuggestions = searchLocalAddressSuggestions('', 6);
    expect(defaultSuggestions.length).toBe(6);

    const hayesMatches = searchLocalAddressSuggestions('450 Hayes', 6);
    expect(hayesMatches.length).toBeGreaterThanOrEqual(1);
    expect(hayesMatches[0].address).toContain(
      '450 Hayes St, Hayes Valley, San Francisco, CA'
    );
    expect(hayesMatches[0].neighborhood).toBe('Hayes Valley');

    const nobHillMatches = searchLocalAddressSuggestions('Nob Hill', 6);
    expect(
      nobHillMatches.some((m) => m.address.includes('1100 California St'))
    ).toBe(true);
  });

  it('computes dynamic California regional viewport bounds and transit routes for Silicon Valley -> SF', () => {
    const evalCalifornia = evaluateItinerary(
      CALIFORNIA_CORRIDOR_SAMPLE_EVENTS,
      {},
      5
    );
    expect(evalCalifornia.legs.length).toBe(3);
    expect(evalCalifornia.legs[0].selectedRoute?.provider).toBe(
      'global-route-matrix'
    );

    const bounds = computeViewportBounds(
      evalCalifornia.events,
      evalCalifornia.legs
    );
    expect(bounds.isSanFrancisco).toBe(false);
    expect(bounds.regionLabel).toContain('CA');
    expect(bounds.minLat).toBeGreaterThan(37.2);
    expect(bounds.maxLat).toBeLessThan(38.0);

    const timeline = buildPlaybackTimeline({
      events: evalCalifornia.events,
      legs: evalCalifornia.legs,
      conflicts: evalCalifornia.conflicts,
    });
    expect(timeline.viewportBounds.isSanFrancisco).toBe(false);

    const midSample = sampleTimelineAt(
      timeline,
      timeline.totalPlaybackSeconds * 0.5
    );
    expect(midSample.svgPoint).not.toBeNull();
    expect(midSample.svgPoint!.x).toBeGreaterThanOrEqual(40);
    expect(midSample.svgPoint!.x).toBeLessThanOrEqual(960);
  });
});
