import { computeRouteOptionsForPair } from '../adapters/routing';
import { resolveLocationCoordinates } from '../fixtures/scenarios';
import {
  CalendarEvent,
  Conflict,
  JourneyLeg,
  ResolutionProposal,
  TravelMode,
} from '../types';

export interface ItineraryEvaluation {
  events: CalendarEvent[];
  legs: JourneyLeg[];
  conflicts: Conflict[];
}

export function getEffectiveEndIso(event: CalendarEvent): string {
  return event.effectiveEnd || event.end;
}

export function diffMinutes(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return Math.round((e - s) / 60000);
}

export function subtractMinutesIso(iso: string, minutes: number): string {
  const ms = new Date(iso).getTime() - minutes * 60000;
  return new Date(ms).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  const ms = new Date(iso).getTime() + minutes * 60000;
  return new Date(ms).toISOString();
}

export function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
    });
  } catch {
    return iso;
  }
}

export function evaluateItinerary(
  rawEvents: CalendarEvent[],
  selectedModesByLegId: Record<string, TravelMode> = {},
  bufferMinutes = 5,
  dismissedConflictIds: string[] = []
): ItineraryEvaluation {
  // Normalize coordinates if missing but location string is present
  const events: CalendarEvent[] = [...rawEvents]
    .map((evt) => {
      if (!evt.isVirtual && evt.location && evt.location.trim() && !evt.coordinates) {
        const resolved = resolveLocationCoordinates(evt.location);
        return {
          ...evt,
          neighborhood: evt.neighborhood || resolved.neighborhood,
          coordinates: resolved.coordinates,
        };
      }
      return evt;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const legs: JourneyLeg[] = [];
  const conflicts: Conflict[] = [];

  // Identify physical (in-person) events in chronological order for journey legs
  const physicalEvents = events.filter((e) => !e.isVirtual);

  for (let i = 0; i < physicalEvents.length - 1; i++) {
    const fromEvent = physicalEvents[i];
    const toEvent = physicalEvents[i + 1];
    const legId = `leg-${fromEvent.id}-${toEvent.id}`;
    const preferredMode: TravelMode = selectedModesByLegId[legId] || 'transit';

    const fromEndIso = getEffectiveEndIso(fromEvent);
    const availableWindowMinutes = diffMinutes(fromEndIso, toEvent.start);

    const hasFromLoc = Boolean(fromEvent.location && fromEvent.location.trim() && fromEvent.coordinates);
    const hasToLoc = Boolean(toEvent.location && toEvent.location.trim() && toEvent.coordinates);

    if (!hasFromLoc || !hasToLoc) {
      legs.push({
        id: legId,
        fromEventId: fromEvent.id,
        toEventId: toEvent.id,
        fromEvent,
        toEvent,
        selectedMode: preferredMode,
        selectedRoute: null,
        alternatives: [],
        availableWindowMinutes,
        bufferMinutes,
        recommendedLeaveIso: null,
        arrivalEstimateIso: null,
        slackMinutes: null,
        status: 'missing_location',
      });
      continue;
    }

    const alternatives = computeRouteOptionsForPair(fromEvent, toEvent);
    const selectedRoute =
      alternatives.find((r) => r.mode === preferredMode) || alternatives[0] || null;

    if (!selectedRoute) {
      legs.push({
        id: legId,
        fromEventId: fromEvent.id,
        toEventId: toEvent.id,
        fromEvent,
        toEvent,
        selectedMode: preferredMode,
        selectedRoute: null,
        alternatives: [],
        availableWindowMinutes,
        bufferMinutes,
        recommendedLeaveIso: null,
        arrivalEstimateIso: null,
        slackMinutes: null,
        status: 'missing_location',
      });
      continue;
    }

    // Deterministic departure formula from PRD:
    // recommended_leave = next_event_start - arrival_buffer - travel_duration
    const recommendedLeaveIso = subtractMinutesIso(
      toEvent.start,
      bufferMinutes + selectedRoute.durationMinutes
    );
    const arrivalEstimateIso = addMinutesIso(fromEndIso, selectedRoute.durationMinutes);
    const slackMinutes =
      availableWindowMinutes - selectedRoute.durationMinutes - bufferMinutes;

    let status: JourneyLeg['status'] = 'feasible';
    if (availableWindowMinutes < 0) {
      status = 'impossible';
    } else if (availableWindowMinutes < selectedRoute.durationMinutes) {
      status = 'impossible';
    } else if (slackMinutes < 0) {
      status = 'tight_buffer';
    }

    legs.push({
      id: legId,
      fromEventId: fromEvent.id,
      toEventId: toEvent.id,
      fromEvent,
      toEvent,
      selectedMode: selectedRoute.mode,
      selectedRoute,
      alternatives,
      availableWindowMinutes,
      bufferMinutes,
      recommendedLeaveIso,
      arrivalEstimateIso,
      slackMinutes,
      status,
    });

    // Generate deterministic conflicts for this leg
    if (availableWindowMinutes < 0) {
      const overlapMinutes = Math.abs(availableWindowMinutes);
      const conflictId =
        fromEvent.id === 'evt2' && toEvent.id === 'evt3'
          ? 'cf2'
          : `cf-overlap-${fromEvent.id}-${toEvent.id}`;
      if (!dismissedConflictIds.includes(conflictId)) {
        conflicts.push({
          id: conflictId,
          type: 'overlap',
          severity: 'warning',
          title:
            fromEvent.id === 'evt2' && toEvent.id === 'evt3'
              ? 'Summit may end earlier'
              : `Schedule overlap: ${fromEvent.title} & ${toEvent.title}`,
          summary: `${fromEvent.title} is scheduled until ${formatTimeShort(
            fromEndIso
          )}, overlapping ${toEvent.title} (${formatTimeShort(
            toEvent.start
          )}) by ${overlapMinutes} min. Plus ${selectedRoute.durationMinutes} min travel needed.`,
          eventIds: [fromEvent.id, toEvent.id],
          legId,
          availableMinutes: availableWindowMinutes,
          requiredMinutes: selectedRoute.durationMinutes,
          bufferMinutes,
          shortfallMinutes: overlapMinutes + selectedRoute.durationMinutes + bufferMinutes,
          status: fromEvent.eventUrl ? 'investigating' : 'new',
          investigationHypothesis: fromEvent.eventUrl
            ? `Event ${fromEvent.title} has an external schedule URL that may distinguish core program from optional networking.`
            : undefined,
        });
      }
    } else if (availableWindowMinutes < selectedRoute.durationMinutes) {
      const shortfall = selectedRoute.durationMinutes - availableWindowMinutes;
      const conflictId =
        fromEvent.id === 'evt1' && toEvent.id === 'evt2'
          ? 'cf1'
          : `cf-travel-${fromEvent.id}-${toEvent.id}`;
      if (!dismissedConflictIds.includes(conflictId)) {
        conflicts.push({
          id: conflictId,
          type: 'travel_impossible',
          severity: 'critical',
          title: 'Not enough time to get there',
          summary: `${fromEvent.title} ends at ${formatTimeShort(
            fromEndIso
          )}; ${toEvent.title} starts at ${formatTimeShort(
            toEvent.start
          )} (${availableWindowMinutes} min window). ${selectedRoute.summary} requires ~${
            selectedRoute.durationMinutes
          } min (${shortfall} min short before buffer).`,
          eventIds: [fromEvent.id, toEvent.id],
          legId,
          availableMinutes: availableWindowMinutes,
          requiredMinutes: selectedRoute.durationMinutes,
          bufferMinutes,
          shortfallMinutes: shortfall,
          status: 'new',
        });
      }
    } else if (slackMinutes < 0) {
      const conflictId = `cf-buffer-${fromEvent.id}-${toEvent.id}`;
      if (!dismissedConflictIds.includes(conflictId)) {
        conflicts.push({
          id: conflictId,
          type: 'tight_buffer',
          severity: 'warning',
          title: 'Arrival buffer below target',
          summary: `${availableWindowMinutes} min available between ${fromEvent.title} and ${toEvent.title}. Route takes ${selectedRoute.durationMinutes} min, leaving only ${
            availableWindowMinutes - selectedRoute.durationMinutes
          } min buffer (target: ${bufferMinutes} min).`,
          eventIds: [fromEvent.id, toEvent.id],
          legId,
          availableMinutes: availableWindowMinutes,
          requiredMinutes: selectedRoute.durationMinutes,
          bufferMinutes,
          shortfallMinutes: Math.abs(slackMinutes),
          status: 'new',
        });
      }
    }
  }

  // Check for missing locations on any non-virtual event
  for (const evt of physicalEvents) {
    if (!evt.location || !evt.location.trim()) {
      const conflictId = evt.id === 'evt4' ? 'cf3' : `cf-loc-${evt.id}`;
      if (!dismissedConflictIds.includes(conflictId)) {
        conflicts.push({
          id: conflictId,
          type: 'missing_location',
          severity: 'warning',
          title: 'Missing destination',
          summary: `${evt.title} (${formatTimeShort(evt.start)} – ${formatTimeShort(
            getEffectiveEndIso(evt)
          )}) has no street address or venue. Departure time cannot yet be computed.`,
          eventIds: [evt.id],
          status: 'new',
          investigationHypothesis: evt.eventUrl
            ? 'Organizer page linked in event metadata may contain confirmed venue address.'
            : undefined,
        });
      }
    }
  }

  return { events, legs, conflicts };
}

export function verifyResolutionProposal(
  currentEvents: CalendarEvent[],
  currentModes: Record<string, TravelMode>,
  bufferMinutes: number,
  dismissedConflictIds: string[],
  proposal: Omit<ResolutionProposal, 'verification'>
): ResolutionProposal['verification'] & {
  previewEvaluation: ItineraryEvaluation;
  updatedModes: Record<string, TravelMode>;
} {
  const updatedModes = { ...currentModes };
  const updatedDismissed = [...dismissedConflictIds];

  const updatedEvents = currentEvents.map((evt) => {
    if (evt.id !== proposal.targetEventId) return evt;
    const changes = proposal.proposedChanges;
    return {
      ...evt,
      effectiveEnd: changes.effectiveEnd ?? evt.effectiveEnd,
      start: changes.newStart ?? evt.start,
      end: changes.newEnd ?? evt.end,
      location: changes.newLocation ?? evt.location,
      neighborhood: changes.newNeighborhood ?? evt.neighborhood,
      coordinates: changes.newCoordinates ?? evt.coordinates,
      phases: changes.phases ?? evt.phases,
      appliedResolutionId: proposal.id,
    };
  });

  const initialEvaluation = evaluateItinerary(
    currentEvents,
    currentModes,
    bufferMinutes,
    dismissedConflictIds
  );
  const originalConflict = initialEvaluation.conflicts.find(
    (c) => c.id === proposal.conflictId
  );

  if (proposal.actionType === 'switch_travel_mode' && proposal.proposedChanges.preferredMode) {
    const matchingLeg =
      (originalConflict?.legId &&
        initialEvaluation.legs.find((l) => l.id === originalConflict.legId)) ||
      initialEvaluation.legs.find(
        (l) =>
          l.fromEventId === proposal.targetEventId || l.toEventId === proposal.targetEventId
      );
    if (matchingLeg) {
      updatedModes[matchingLeg.id] = proposal.proposedChanges.preferredMode;
    }
  }

  if (proposal.actionType === 'dismiss_conflict') {
    updatedDismissed.push(proposal.conflictId);
  }

  const previewEvaluation = evaluateItinerary(
    updatedEvents,
    updatedModes,
    bufferMinutes,
    updatedDismissed
  );

  // Locate the relevant leg for this conflict or target event
  const relevantLeg =
    (originalConflict?.legId &&
      previewEvaluation.legs.find((l) => l.id === originalConflict.legId)) ||
    previewEvaluation.legs.find(
      (l) =>
        l.fromEventId === proposal.targetEventId || l.toEventId === proposal.targetEventId
    );

  // Check if the specific conflict (or any replacement conflict on the same leg) still exists
  const sameLegConflictExists = originalConflict?.legId
    ? previewEvaluation.conflicts.some(
        (c) => c.legId === originalConflict.legId && c.type !== 'tight_buffer'
      )
    : false;

  const resolvesTargetConflict =
    !previewEvaluation.conflicts.some((c) => c.id === proposal.conflictId) &&
    !sameLegConflictExists;

  let verificationSummary = '';
  if (relevantLeg && relevantLeg.selectedRoute) {
    const leaveStr = relevantLeg.recommendedLeaveIso
      ? formatTimeShort(relevantLeg.recommendedLeaveIso)
      : 'N/A';
    const slack = relevantLeg.slackMinutes ?? 0;
    verificationSummary = resolvesTargetConflict
      ? `Verified: ${relevantLeg.selectedRoute.summary} takes ${
          relevantLeg.selectedRoute.durationMinutes
        } min inside ${relevantLeg.availableWindowMinutes} min window. Leave by ${leaveStr} (${
          slack >= 0 ? `+${slack} min spare after ${bufferMinutes}m buffer` : `${slack} min buffer`
        }).`
      : `Route re-checked: requires ${relevantLeg.selectedRoute.durationMinutes} min vs ${relevantLeg.availableWindowMinutes} min window.`;
  } else {
    verificationSummary = resolvesTargetConflict
      ? 'Verified by deterministic conflict engine: issue resolved.'
      : 'Conflict still requires attention.';
  }

  return {
    verifiedByEngine: true,
    resolvesTargetConflict,
    remainingConflictsCount: previewEvaluation.conflicts.length,
    newAvailableMinutes: relevantLeg?.availableWindowMinutes,
    newRequiredMinutes: relevantLeg?.selectedRoute?.durationMinutes,
    newSlackMinutes: relevantLeg?.slackMinutes ?? undefined,
    newRecommendedLeaveIso: relevantLeg?.recommendedLeaveIso ?? undefined,
    verificationSummary,
    previewEvaluation,
    updatedModes,
  };
}
