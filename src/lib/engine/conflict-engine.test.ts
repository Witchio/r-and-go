import { describe, expect, it } from 'vitest';
import { runConflictInvestigation } from '../adapters/argon';
import { parseIcsToEvents } from '../adapters/calendar-integrations';
import {
  CALIFORNIA_CORRIDOR_SAMPLE_EVENTS,
  FOUNDER_STRESS_TEST_EVENTS,
  HANDOVER_SAMPLE_EVENTS,
  SCENARIO_PRESETS,
} from '../fixtures/scenarios';
import {
  PREVIOUS_DAY_OCT_23_EVENTS,
  PREVIOUS_DAY_OCT_24_EVENTS,
} from '../playback/day-history';
import { CalendarEvent } from '../types';
import { evaluateItinerary, verifyResolutionProposal } from './conflict-engine';

const CONFLICT_TEST_FIXTURE_EVENTS: CalendarEvent[] = [
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

describe('Deterministic Conflict & Departure Engine', () => {
  it('verifies all built-in demo calendars and historical fixtures have zero conflicts', () => {
    for (const preset of SCENARIO_PRESETS) {
      const evaluation = evaluateItinerary(preset.events, {}, 5);
      expect(evaluation.conflicts).toEqual([]);
      expect(evaluation.legs.every((l) => l.status === 'feasible')).toBe(true);
    }

    const handoverEval = evaluateItinerary(HANDOVER_SAMPLE_EVENTS, {}, 5);
    expect(handoverEval.conflicts).toHaveLength(0);
    expect(handoverEval.legs).toHaveLength(3);

    const founderEval = evaluateItinerary(FOUNDER_STRESS_TEST_EVENTS, {}, 5);
    expect(founderEval.conflicts).toHaveLength(0);
    expect(founderEval.legs).toHaveLength(2);

    const caCorridorEval = evaluateItinerary(CALIFORNIA_CORRIDOR_SAMPLE_EVENTS, {}, 5);
    expect(caCorridorEval.conflicts).toHaveLength(0);
    expect(caCorridorEval.legs).toHaveLength(3);

    const oct24Eval = evaluateItinerary(PREVIOUS_DAY_OCT_24_EVENTS, {}, 5);
    expect(oct24Eval.conflicts).toHaveLength(0);
    expect(oct24Eval.legs.every((l) => l.status === 'feasible')).toBe(true);

    const oct23Eval = evaluateItinerary(PREVIOUS_DAY_OCT_23_EVENTS, {}, 5);
    expect(oct23Eval.conflicts).toHaveLength(0);
    expect(oct23Eval.legs.every((l) => l.status === 'feasible')).toBe(true);
  });

  it('detects the exact 3 conflicts when evaluating an unadjusted conflict fixture', () => {
    const result = evaluateItinerary(CONFLICT_TEST_FIXTURE_EVENTS, {}, 5);

    expect(result.conflicts.map((c) => c.id)).toEqual(['cf1', 'cf2', 'cf3']);

    const cf1 = result.conflicts.find((c) => c.id === 'cf1')!;
    expect(cf1.type).toBe('travel_impossible');
    expect(cf1.severity).toBe('critical');
    expect(cf1.availableMinutes).toBe(15);
    expect(cf1.requiredMinutes).toBe(25);

    const cf2 = result.conflicts.find((c) => c.id === 'cf2')!;
    expect(cf2.type).toBe('overlap');
    expect(cf2.eventIds).toEqual(['evt2', 'evt3']);

    const cf3 = result.conflicts.find((c) => c.id === 'cf3')!;
    expect(cf3.type).toBe('missing_location');
    expect(cf3.eventIds).toEqual(['evt4']);
  });

  it('proves leaving Developer Summit after required talks (14:30) resolves cf2 overlap and makes SoMa coffee reachable', () => {
    const verification = verifyResolutionProposal(
      CONFLICT_TEST_FIXTURE_EVENTS,
      {},
      5,
      [],
      {
        id: 'prop-leave-early',
        conflictId: 'cf2',
        title: 'Leave Developer summit at 2:30 PM after required talks',
        description: 'Official agenda confirms 2:30–4:00 PM is optional patio networking.',
        actionType: 'leave_optional_phase',
        targetEventId: 'evt2',
        proposedChanges: {
          effectiveEnd: '2026-10-25T14:30:00-07:00',
        },
        requiresCalendarWrite: false,
      }
    );

    expect(verification.verifiedByEngine).toBe(true);
    expect(verification.resolvesTargetConflict).toBe(true);
    expect(verification.newAvailableMinutes).toBe(30); // 14:30 to 15:00
    expect(verification.newRequiredMinutes).toBe(16);  // Ferry Building -> SoMa transit
    expect(verification.newSlackMinutes).toBe(9);      // 30 - 16 - 5 buffer = +9 min spare
  });

  it('proves switching Union Square -> Ferry Building to Bicycling resolves cf1 impossible travel', () => {
    const verification = verifyResolutionProposal(
      CONFLICT_TEST_FIXTURE_EVENTS,
      {},
      5,
      [],
      {
        id: 'prop-bike-leg1',
        conflictId: 'cf1',
        title: 'Switch to Protected Market St Bikeway (9 min)',
        description: 'Bay Wheels e-bike takes 9 min vs 25 min on Muni transit.',
        actionType: 'switch_travel_mode',
        targetEventId: 'evt1',
        proposedChanges: {
          preferredMode: 'bicycling',
        },
        requiresCalendarWrite: false,
      }
    );

    expect(verification.resolvesTargetConflict).toBe(true);
    expect(verification.newAvailableMinutes).toBe(15);
    expect(verification.newRequiredMinutes).toBe(9);
    expect(verification.newSlackMinutes).toBe(1); // 15 - 9 - 5 buffer = +1 min spare
  });

  it('does not flag virtual meetings as physical travel journeys', () => {
    const result = evaluateItinerary(FOUNDER_STRESS_TEST_EVENTS, {}, 5);
    // st2 is virtual, so legs should connect st1 -> st3 and st3 -> st4 directly
    expect(result.legs.map((l) => `${l.fromEventId}->${l.toEventId}`)).toEqual([
      'st1->st3',
      'st3->st4',
    ]);
  });

  it('investigates cf2 via Argon adapter, extracts required vs optional phases, and verifies resolution', async () => {
    const inv = await runConflictInvestigation({
      conflictId: 'cf2',
      events: CONFLICT_TEST_FIXTURE_EVENTS,
      selectedModes: {},
      bufferMinutes: 5,
    });

    expect(inv.confidence).toBe('confirmed');
    expect(inv.discoveredPhases).toHaveLength(2);
    expect(inv.discoveredPhases[0].optionality).toBe('required');
    expect(inv.discoveredPhases[1].optionality).toBe('optional');

    const leaveEarlyProp = inv.proposals.find(
      (p) => p.actionType === 'leave_optional_phase'
    );
    expect(leaveEarlyProp).toBeDefined();
    expect(leaveEarlyProp?.verification.resolvesTargetConflict).toBe(true);
  });

  it('investigates cf3 (Community dinner) without assuming dinner is optional, and discovers SHACK15 address', async () => {
    const inv = await runConflictInvestigation({
      conflictId: 'cf3',
      events: CONFLICT_TEST_FIXTURE_EVENTS,
      selectedModes: {},
      bufferMinutes: 5,
    });

    expect(inv.confidence).toBe('confirmed');
    expect(inv.discoveredLocation?.address).toContain('SHACK15');
    // Guardrail check: Community dinner must remain required
    expect(inv.discoveredPhases[0]?.optionality).toBe('required');
  });

  it('parses RFC 5545 .ics calendar feeds, geocodes SF venues, and detects virtual meetings', async () => {
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-1
DTSTART:20261025T090000
DTEND:20261025T103000
SUMMARY:Morning Coffee Sync
LOCATION:Union Square, San Francisco, CA
END:VEVENT
BEGIN:VEVENT
UID:test-2
DTSTART:20261025T110000
DTEND:20261025T120000
SUMMARY:Remote Team Standup
LOCATION:https://zoom.us/j/123456
END:VEVENT
END:VCALENDAR`;

    const events = await parseIcsToEvents(sampleIcs, 'test');
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Morning Coffee Sync');
    expect(events[0].neighborhood).toBe('Union Square');
    expect(events[0].isVirtual).toBe(false);
    expect(events[1].title).toBe('Remote Team Standup');
    expect(events[1].isVirtual).toBe(true);
  });
});
