import {
  CalendarEvent,
  Conflict,
  GeoCoordinates,
  JourneyLeg,
  RouteOption,
  TravelMode,
} from '../types';
import { computeRouteOptionsForPair } from '../adapters/routing';
import {
  addMinutesIso,
  diffMinutes,
  formatTimeShort,
  getEffectiveEndIso,
  subtractMinutesIso,
} from '../engine/conflict-engine';

export interface HomeOriginSpec {
  address: string;
  neighborhood: string;
  coordinates: GeoCoordinates;
  preferredMode?: TravelMode;
  preferredReturnMode?: TravelMode;
}
import {
  EnrichedModeRoute,
  buildModeSpecificRoute,
  isWithinSanFrancisco,
} from './sf-transit-network';
import { clampToCalifornia } from '../fixtures/scenarios';

export interface MapViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  isSanFrancisco: boolean;
  regionLabel: string;
}

export const SF_DEFAULT_BOUNDS: MapViewportBounds = {
  minLat: 37.762,
  maxLat: 37.809,
  minLng: -122.425,
  maxLng: -122.383,
  isSanFrancisco: true,
  regionLabel: 'San Francisco, CA',
};

/**
 * Computes the optimal geographic bounding box for any set of events across California.
 * Preserves the exact calibrated Downtown SF bounds when all coordinates are in SF,
 * and dynamically fits the bounding box (with aspect ratio adjustment) for Bay Area & California regions.
 */
export function computeViewportBounds(
  events: CalendarEvent[],
  legs: JourneyLeg[] = []
): MapViewportBounds {
  const coords: GeoCoordinates[] = [];
  for (const e of events) {
    if (!e.isVirtual && e.coordinates) {
      coords.push(clampToCalifornia(e.coordinates));
    }
  }
  for (const l of legs) {
    if (l.selectedRoute?.coordinates) {
      for (const [lat, lng] of l.selectedRoute.coordinates) {
        coords.push(clampToCalifornia({ lat, lng }));
      }
    }
  }

  if (coords.length === 0) {
    return SF_DEFAULT_BOUNDS;
  }

  const allInSf = coords.every((c) => isWithinSanFrancisco(c));
  if (allInSf) {
    return SF_DEFAULT_BOUNDS;
  }

  let rawMinLat = Infinity;
  let rawMaxLat = -Infinity;
  let rawMinLng = Infinity;
  let rawMaxLng = -Infinity;

  for (const c of coords) {
    if (c.lat < rawMinLat) rawMinLat = c.lat;
    if (c.lat > rawMaxLat) rawMaxLat = c.lat;
    if (c.lng < rawMinLng) rawMinLng = c.lng;
    if (c.lng > rawMaxLng) rawMaxLng = c.lng;
  }

  const centerLat = (rawMinLat + rawMaxLat) / 2;
  const centerLng = (rawMinLng + rawMaxLng) / 2;
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));

  // Ensure a sensible minimum city neighborhood span (~3 km) if only 1 event is plotted
  let latSpan = Math.max(0.028, (rawMaxLat - rawMinLat) * 1.38);
  let lngSpan = Math.max(0.028 / cosLat, (rawMaxLng - rawMinLng) * 1.38);

  // Match the 860x760 inner SVG canvas aspect ratio adjusted by cos(centerLat)
  const targetRatio = 860 / 760;
  const currentRatio = (lngSpan * cosLat) / latSpan;
  if (currentRatio < targetRatio) {
    lngSpan = (latSpan * targetRatio) / cosLat;
  } else {
    latSpan = (lngSpan * cosLat) / targetRatio;
  }

  // Infer a clean California region label
  let regionLabel = 'California Regional View';
  if (
    centerLat >= 37.15 &&
    centerLat <= 38.45 &&
    centerLng >= -122.75 &&
    centerLng <= -121.65
  ) {
    regionLabel = 'SF Bay Area & Silicon Valley, CA';
  } else if (centerLat < 35.0) {
    regionLabel = 'Southern California, CA';
  } else {
    const firstPhysical = events.find((e) => !e.isVirtual && e.location);
    if (firstPhysical?.location) {
      const parts = firstPhysical.location
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      regionLabel =
        parts.length >= 2
          ? parts.slice(-2).join(', ')
          : parts[0] || 'California Regional View';
    }
  }

  return {
    minLat: Number((centerLat - latSpan / 2).toFixed(6)),
    maxLat: Number((centerLat + latSpan / 2).toFixed(6)),
    minLng: Number((centerLng - lngSpan / 2).toFixed(6)),
    maxLng: Number((centerLng + lngSpan / 2).toFixed(6)),
    isSanFrancisco: false,
    regionLabel,
  };
}

export type ConflictDecisionChoice = 'leave_on_time' | 'stay_until_end';

export type TravelerActivityMode =
  | 'at_event'
  | 'walking'
  | 'waiting'
  | 'transit'
  | 'driving'
  | 'bicycling'
  | 'virtual'
  | 'unavailable';

export interface PlaybackDecisionPoint {
  id: string;
  legId: string;
  conflictId?: string;
  fromEventId: string;
  toEventId: string;
  fromEventTitle: string;
  toEventTitle: string;
  decisionTimeIso: string;
  decisionTimeLabel: string;
  scheduledEndIso: string;
  scheduledEndLabel: string;
  nextEventStartIso: string;
  nextEventStartLabel: string;
  travelDurationMinutes: number;
  bufferMinutes: number;
  lateArrivalMinutesIfStay: number;
  playbackTimeSeconds: number;
  coordinates?: GeoCoordinates;
}

export interface PlaybackSegment {
  id: string;
  kind:
    | 'event_attendance'
    | 'travel_walk'
    | 'travel_wait'
    | 'travel_ride'
    | 'arrival_buffer_wait'
    | 'virtual_event'
    | 'unavailable_gap';
  travelerMode: TravelerActivityMode;
  label: string;
  sublabel: string;
  eventId?: string;
  legId?: string;
  conflictId?: string;
  startIso: string;
  endIso: string;
  realDurationMinutes: number;
  playbackStartSeconds: number;
  playbackEndSeconds: number;
  playbackDurationSeconds: number;
  /** Ratio of simulated real-world seconds per 1 playback second (for UI speed badge) */
  clockAccelerationFactor: number;
  /** Polyline path for moving segments, or single coordinate for stationary segments */
  pathCoordinates: [number, number][];
  isStationary: boolean;
  isAcceleratedEvent: boolean;
  isConflictFlagged: boolean;
  isLateArrival: boolean;
  lateByMinutes: number;
  isUnavailableGap: boolean;
  isUnderground?: boolean;
  depthFeet?: number;
  stationName?: string;
  vehicleLabel?: string;
  appliedDecision?: ConflictDecisionChoice;
}

export interface PlaybackTimeline {
  segments: PlaybackSegment[];
  decisionPoints: PlaybackDecisionPoint[];
  modeRoutesByLegId: Record<string, EnrichedModeRoute>;
  viewportBounds: MapViewportBounds;
  homeOrigin: HomeOriginSpec | null;
  homeLeg: JourneyLeg | null;
  homeReturnLeg: JourneyLeg | null;
  totalPlaybackSeconds: number;
  totalRealMinutes: number;
  dayStartIso: string | null;
  dayEndIso: string | null;
  playablePhysicalEventsCount: number;
  hasUnresolvedConflicts: boolean;
  hasMissingDataGaps: boolean;
  provenanceLabel: string;
}

export interface PlaybackSampleState {
  playbackTimeSeconds: number;
  progressFraction: number;
  simulatedTimeIso: string;
  simulatedClockLabel: string;
  activeSegment: PlaybackSegment | null;
  travelerMode: TravelerActivityMode;
  coordinates: GeoCoordinates | null;
  svgPoint: { x: number; y: number } | null;
  headingDegrees: number;
  activeEventId: string | null;
  activeLegId: string | null;
  clockAccelerationFactor: number;
  isConflictFlagged: boolean;
  isLateArrival: boolean;
  lateByMinutes: number;
  isUnavailableGap: boolean;
  triggeredDecisionPoint: PlaybackDecisionPoint | null;
}

/**
 * Projects any latitude/longitude to the 1055x900 SVG coordinate space using the active viewport bounds
 * (defaults to Downtown San Francisco bounds when omitted).
 * Retains sub-pixel precision so requestAnimationFrame interpolation is silky smooth.
 */
export function projectLatLngToSvgSubpixel(
  coord: GeoCoordinates,
  bounds: MapViewportBounds = SF_DEFAULT_BOUNDS
): {
  x: number;
  y: number;
} {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const lngRange = Math.max(0.0001, maxLng - minLng);
  const latRange = Math.max(0.0001, maxLat - minLat);

  const normX = (coord.lng - minLng) / lngRange;
  const normY = 1 - (coord.lat - minLat) / latRange;

  return {
    x: Number((60 + normX * 860).toFixed(2)),
    y: Number((70 + normY * 760).toFixed(2)),
  };
}

/**
 * Computes playback duration in seconds for an event attendance window.
 * Longer events are accelerated (time-lapsed) so a 5-hour summit takes ~3.7s
 * while a 45-minute meeting takes ~1.8s, scaling total day duration naturally.
 */
export function computeEventPlaybackDurationSeconds(realMinutes: number): number {
  const clamped = Math.max(5, realMinutes);
  return Number((1.1 + Math.log2(1 + clamped / 25) * 0.72).toFixed(2));
}

/**
 * Computes playback duration in seconds for a moving travel step.
 * Scales proportionally with travel duration (~1s per 4.5 real minutes) with sensible bounds.
 */
export function computeTravelPlaybackDurationSeconds(realMinutes: number): number {
  const clamped = Math.max(1, realMinutes);
  return Number(Math.min(6.5, Math.max(0.85, clamped / 4.5)).toFixed(2));
}

/**
 * Interpolates a position and heading along a polyline of [lat, lng] coordinates
 * for a normalized progress t in [0, 1].
 */
export function interpolateAlongPolyline(
  path: [number, number][],
  t: number
): {
  coordinates: GeoCoordinates | null;
  headingDegrees: number;
} {
  if (!path || path.length === 0) {
    return { coordinates: null, headingDegrees: 0 };
  }
  if (path.length === 1) {
    return {
      coordinates: { lat: path[0][0], lng: path[0][1] },
      headingDegrees: 0,
    };
  }

  const clampedT = Math.max(0, Math.min(1, t));

  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const dLat = path[i + 1][0] - path[i][0];
    const dLng = path[i + 1][1] - path[i][1];
    const len = Math.hypot(dLat, dLng);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return {
      coordinates: { lat: path[0][0], lng: path[0][1] },
      headingDegrees: 0,
    };
  }

  const targetDist = clampedT * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const localT = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const lat = path[i][0] + (path[i + 1][0] - path[i][0]) * localT;
      const lng = path[i][1] + (path[i + 1][1] - path[i][1]) * localT;
      const dLat = path[i + 1][0] - path[i][0];
      const dLng = path[i + 1][1] - path[i][1];
      const headingDegrees = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      return {
        coordinates: {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        },
        headingDegrees: Number(headingDegrees.toFixed(1)),
      };
    }
    accumulated += segLen;
  }

  const last = path[path.length - 1];
  return {
    coordinates: { lat: last[0], lng: last[1] },
    headingDegrees: 0,
  };
}

interface TransitSubStep {
  kind: 'travel_walk' | 'travel_wait' | 'travel_ride';
  travelerMode: TravelerActivityMode;
  label: string;
  durationMinutes: number;
  pathCoordinates: [number, number][];
  isStationary: boolean;
  vehicleLabel?: string;
}

/**
 * Breaks a RouteOption into sub-segments along its selected route geometry.
 * For transit routes, represents walking, waiting (stationary), and riding separately (R10).
 */
function buildRouteSubSteps(route: RouteOption): TransitSubStep[] {
  const coords = route.coordinates || [];
  if (coords.length === 0) return [];

  if (route.mode !== 'transit') {
    const modeLabel =
      route.mode === 'walking'
        ? 'Walking'
        : route.mode === 'bicycling'
        ? 'Bicycling'
        : 'Driving';
    return [
      {
        kind: route.mode === 'walking' ? 'travel_walk' : 'travel_ride',
        travelerMode: route.mode,
        label: `${modeLabel} · ${route.summary}`,
        durationMinutes: Math.max(1, route.durationMinutes),
        pathCoordinates: coords,
        isStationary: false,
        vehicleLabel: route.summary,
      },
    ];
  }

  const totalMin = Math.max(4, route.durationMinutes);
  const walkToMin = Math.max(2, Math.round(totalMin * 0.18));
  const waitMin = Math.max(2, Math.round(totalMin * 0.18));
  const walkFromMin = Math.max(2, Math.round(totalMin * 0.14));
  const rideMin = Math.max(2, totalMin - walkToMin - waitMin - walkFromMin);

  const vehicleLabel = route.summary.includes('Muni')
    ? 'Muni Metro'
    : route.summary.includes('BART')
    ? 'BART'
    : 'Transit Vehicle';

  if (coords.length >= 4) {
    const walkToPath: [number, number][] = [coords[0], coords[1]];
    const stationCoord: [number, number] = coords[1];
    const ridePath: [number, number][] = coords.slice(1, coords.length - 1);
    const walkFromPath: [number, number][] = [
      coords[coords.length - 2],
      coords[coords.length - 1],
    ];

    return [
      {
        kind: 'travel_walk',
        travelerMode: 'walking',
        label: 'Walk to transit station',
        durationMinutes: walkToMin,
        pathCoordinates: walkToPath,
        isStationary: false,
      },
      {
        kind: 'travel_wait',
        travelerMode: 'waiting',
        label: `Wait at platform for ${vehicleLabel}`,
        durationMinutes: waitMin,
        pathCoordinates: [stationCoord],
        isStationary: true,
        vehicleLabel,
      },
      {
        kind: 'travel_ride',
        travelerMode: 'transit',
        label: `Ride ${route.summary}`,
        durationMinutes: rideMin,
        pathCoordinates: ridePath,
        isStationary: false,
        vehicleLabel,
      },
      {
        kind: 'travel_walk',
        travelerMode: 'walking',
        label: 'Walk from station to venue',
        durationMinutes: walkFromMin,
        pathCoordinates: walkFromPath,
        isStationary: false,
      },
    ];
  }

  const boardPt = interpolateAlongPolyline(coords, 0.2).coordinates!;
  const alightPt = interpolateAlongPolyline(coords, 0.85).coordinates!;
  const boardPair: [number, number] = [boardPt.lat, boardPt.lng];
  const alightPair: [number, number] = [alightPt.lat, alightPt.lng];

  return [
    {
      kind: 'travel_walk',
      travelerMode: 'walking',
      label: 'Walk to transit stop',
      durationMinutes: walkToMin,
      pathCoordinates: [coords[0], boardPair],
      isStationary: false,
    },
    {
      kind: 'travel_wait',
      travelerMode: 'waiting',
      label: `Wait for ${vehicleLabel}`,
      durationMinutes: waitMin,
      pathCoordinates: [boardPair],
      isStationary: true,
      vehicleLabel,
    },
    {
      kind: 'travel_ride',
      travelerMode: 'transit',
      label: `Ride ${route.summary}`,
      durationMinutes: rideMin,
      pathCoordinates: [boardPair, alightPair],
      isStationary: false,
      vehicleLabel,
    },
    {
      kind: 'travel_walk',
      travelerMode: 'walking',
      label: 'Walk to destination',
      durationMinutes: walkFromMin,
      pathCoordinates: [alightPair, coords[coords.length - 1]],
      isStationary: false,
    },
  ];
}

export interface BuildPlaybackTimelineOptions {
  events: CalendarEvent[];
  legs: JourneyLeg[];
  conflicts: Conflict[];
  /** User choices at interactive conflict boundaries keyed by legId */
  conflictDecisions?: Record<string, ConflictDecisionChoice>;
  /** Whether the selected date is a past date (affects provenance label) */
  isPastDay?: boolean;
  /** Optional user-specified Home starting point (R10) */
  homeOrigin?: HomeOriginSpec | null;
  bufferMinutes?: number;
}

/**
 * Builds a deterministic 2D playback timeline from the evaluated events, journey legs,
 * conflicts, optional Home starting point, and any interactive leave-vs-stay decisions.
 */
export function buildPlaybackTimeline({
  events,
  legs,
  conflicts,
  conflictDecisions = {},
  isPastDay = false,
  homeOrigin = null,
  bufferMinutes = 5,
}: BuildPlaybackTimelineOptions): PlaybackTimeline {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const firstPhysicalEvent = sortedEvents.find(
    (e) => !e.isVirtual && Boolean(e.coordinates)
  );

  // Only include homeOrigin if it is in the same metro region (~85 km) as the day's first physical event,
  // so a default SF Home address doesn't stretch the viewport across the ocean when viewing a Global City itinerary.
  const effectiveHomeOrigin: HomeOriginSpec | null =
    homeOrigin &&
    homeOrigin.coordinates &&
    (!firstPhysicalEvent?.coordinates ||
      Math.hypot(
        homeOrigin.coordinates.lat - firstPhysicalEvent.coordinates.lat,
        homeOrigin.coordinates.lng - firstPhysicalEvent.coordinates.lng
      ) <= 0.85)
      ? homeOrigin
      : null;

  const viewportBounds = computeViewportBounds(
    effectiveHomeOrigin && effectiveHomeOrigin.coordinates
      ? [
          {
            id: 'evt-home-origin',
            title: 'Home',
            start: '',
            end: '',
            coordinates: effectiveHomeOrigin.coordinates,
          },
          ...sortedEvents,
        ]
      : sortedEvents,
    legs
  );
  const modeRoutesByLegId: Record<string, EnrichedModeRoute> = {};
  const segments: PlaybackSegment[] = [];
  const decisionPoints: PlaybackDecisionPoint[] = [];
  let cursorPlaybackSeconds = 0;
  let homeLeg: JourneyLeg | null = null;
  let homeReturnLeg: JourneyLeg | null = null;

  const pushSegment = (
    seg: Omit<
      PlaybackSegment,
      | 'playbackStartSeconds'
      | 'playbackEndSeconds'
      | 'clockAccelerationFactor'
    >
  ) => {
    const durationSec = Math.max(
      0.4,
      Number(seg.playbackDurationSeconds.toFixed(2))
    );
    const startSec = Number(cursorPlaybackSeconds.toFixed(2));
    const endSec = Number((startSec + durationSec).toFixed(2));
    const realSeconds = Math.max(60, seg.realDurationMinutes * 60);
    const accel = Math.max(1, Math.round(realSeconds / durationSec));

    segments.push({
      ...seg,
      playbackStartSeconds: startSec,
      playbackEndSeconds: endSec,
      playbackDurationSeconds: durationSec,
      clockAccelerationFactor: accel,
    });
    cursorPlaybackSeconds = endSec;
  };

  let simulatedCursorIso: string | null =
    sortedEvents.length > 0 ? sortedEvents[0].start : null;

  // Prepend Home Starting Point departure leg if effectiveHomeOrigin is provided and a first physical event exists (R10)
  if (effectiveHomeOrigin && effectiveHomeOrigin.coordinates && firstPhysicalEvent) {
    const homeOrigin = effectiveHomeOrigin;
    const syntheticHomeEvent: CalendarEvent = {
      id: 'evt-home-origin',
      title: `Home (${homeOrigin.neighborhood})`,
      start: subtractMinutesIso(firstPhysicalEvent.start, 60),
      end: subtractMinutesIso(firstPhysicalEvent.start, 30),
      location: homeOrigin.address,
      neighborhood: `Home · ${homeOrigin.neighborhood}`,
      coordinates: homeOrigin.coordinates,
      isVirtual: false,
    };

    const homeAlternatives = computeRouteOptionsForPair(
      syntheticHomeEvent,
      firstPhysicalEvent
    );
    const preferredHomeMode: TravelMode =
      homeOrigin.preferredMode || 'transit';
    const selectedHomeRoute =
      homeAlternatives.find((r) => r.mode === preferredHomeMode) ||
      homeAlternatives[0] ||
      null;

    if (selectedHomeRoute && firstPhysicalEvent.coordinates) {
      const enrichedHomeRoute = buildModeSpecificRoute(
        homeOrigin.coordinates,
        firstPhysicalEvent.coordinates,
        selectedHomeRoute.mode,
        selectedHomeRoute.durationMinutes,
        selectedHomeRoute
      );
      modeRoutesByLegId['leg-home-origin'] = enrichedHomeRoute;

      const homeLeaveIso = subtractMinutesIso(
        firstPhysicalEvent.start,
        bufferMinutes + selectedHomeRoute.durationMinutes
      );
      const homePrepStartIso = subtractMinutesIso(homeLeaveIso, 15);
      const homeCoordPair: [number, number] = [
        homeOrigin.coordinates.lat,
        homeOrigin.coordinates.lng,
      ];

      homeLeg = {
        id: 'leg-home-origin',
        fromEventId: syntheticHomeEvent.id,
        toEventId: firstPhysicalEvent.id,
        fromEvent: syntheticHomeEvent,
        toEvent: firstPhysicalEvent,
        selectedMode: selectedHomeRoute.mode,
        selectedRoute: {
          ...selectedHomeRoute,
          coordinates: enrichedHomeRoute.fullPathCoordinates,
        },
        alternatives: homeAlternatives,
        availableWindowMinutes:
          selectedHomeRoute.durationMinutes + bufferMinutes + 15,
        bufferMinutes,
        recommendedLeaveIso: homeLeaveIso,
        arrivalEstimateIso: subtractMinutesIso(
          firstPhysicalEvent.start,
          bufferMinutes
        ),
        slackMinutes: 15,
        status: 'feasible',
      };

      // 1. Stationary "At Home" starting segment
      pushSegment({
        id: 'seg-home-origin-start',
        kind: 'event_attendance',
        travelerMode: 'at_event',
        label: `Starting Point: Home (${homeOrigin.neighborhood})`,
        sublabel: `${homeOrigin.address} · Departing at ${formatTimeShort(homeLeaveIso)}`,
        eventId: 'evt-home-origin',
        legId: 'leg-home-origin',
        startIso: homePrepStartIso,
        endIso: homeLeaveIso,
        realDurationMinutes: 15,
        playbackDurationSeconds: 1.25,
        pathCoordinates: [homeCoordPair],
        isStationary: true,
        isAcceleratedEvent: false,
        isConflictFlagged: false,
        isLateArrival: false,
        lateByMinutes: 0,
        isUnavailableGap: false,
      });

      // 2. Travel steps from Home -> First Physical Event
      let homeStepCursorIso = homeLeaveIso;
      enrichedHomeRoute.subSegments.forEach((step, idx) => {
        const stepEndIso = addMinutesIso(
          homeStepCursorIso,
          step.durationMinutes
        );
        const stepPlaybackSec = step.isStationary
          ? Math.min(1.5, Math.max(0.75, step.durationMinutes / 5))
          : computeTravelPlaybackDurationSeconds(step.durationMinutes);

        pushSegment({
          id: `seg-home-leg-step-${idx}`,
          kind: step.kind,
          travelerMode: step.travelerMode,
          label: `Home (${homeOrigin.neighborhood}) → ${firstPhysicalEvent.neighborhood || firstPhysicalEvent.title}`,
          sublabel: step.label,
          legId: 'leg-home-origin',
          startIso: homeStepCursorIso,
          endIso: stepEndIso,
          realDurationMinutes: step.durationMinutes,
          playbackDurationSeconds: stepPlaybackSec,
          pathCoordinates: step.pathCoordinates,
          isStationary: step.isStationary,
          isUnderground: step.isUnderground,
          depthFeet: step.depthFeet,
          stationName: step.stationName,
          isAcceleratedEvent: false,
          isConflictFlagged: false,
          isLateArrival: false,
          lateByMinutes: 0,
          isUnavailableGap: false,
          vehicleLabel: step.lineName,
        });
        homeStepCursorIso = stepEndIso;
      });

      // 3. Arrival buffer at First Event
      const homeBufMin = diffMinutes(
        homeStepCursorIso,
        firstPhysicalEvent.start
      );
      if (homeBufMin > 0) {
        const firstDestPair: [number, number] = [
          firstPhysicalEvent.coordinates.lat,
          firstPhysicalEvent.coordinates.lng,
        ];
        pushSegment({
          id: 'seg-home-arrival-buffer',
          kind: 'arrival_buffer_wait',
          travelerMode: 'waiting',
          label: `Arrived at ${firstPhysicalEvent.title}`,
          sublabel: `${homeBufMin} min arrival buffer before ${formatTimeShort(firstPhysicalEvent.start)}`,
          eventId: firstPhysicalEvent.id,
          legId: 'leg-home-origin',
          startIso: homeStepCursorIso,
          endIso: firstPhysicalEvent.start,
          realDurationMinutes: homeBufMin,
          playbackDurationSeconds: 0.7,
          pathCoordinates: [firstDestPair],
          isStationary: true,
          isAcceleratedEvent: false,
          isConflictFlagged: false,
          isLateArrival: false,
          lateByMinutes: 0,
          isUnavailableGap: false,
        });
      }
      simulatedCursorIso = firstPhysicalEvent.start;
    }
  }

  for (let i = 0; i < sortedEvents.length; i++) {
    const evt = sortedEvents[i];
    const effectiveEndIso = getEffectiveEndIso(evt);

    const actualArrivalAtEventIso =
      simulatedCursorIso &&
      new Date(simulatedCursorIso).getTime() > new Date(evt.start).getTime()
        ? simulatedCursorIso
        : evt.start;

    const lateByMinutes = Math.max(
      0,
      diffMinutes(evt.start, actualArrivalAtEventIso)
    );
    const isLateArrival = lateByMinutes > 0;

    const outgoingLeg = legs.find((l) => l.fromEventId === evt.id) || null;
    const relatedConflict = outgoingLeg
      ? conflicts.find(
          (c) =>
            c.legId === outgoingLeg.id ||
            (c.eventIds.includes(outgoingLeg.fromEventId) &&
              c.eventIds.includes(outgoingLeg.toEventId))
        )
      : conflicts.find((c) => c.eventIds.includes(evt.id));

    // Virtual Event Handling (R10: do not animate across geography)
    if (evt.isVirtual) {
      const virtualMin = Math.max(
        10,
        diffMinutes(actualArrivalAtEventIso, effectiveEndIso)
      );
      const prevPhysical = sortedEvents
        .slice(0, i)
        .reverse()
        .find((e) => !e.isVirtual && e.coordinates);
      const stationaryPath: [number, number][] = prevPhysical?.coordinates
        ? [[prevPhysical.coordinates.lat, prevPhysical.coordinates.lng]]
        : [];

      pushSegment({
        id: `seg-virtual-${evt.id}`,
        kind: 'virtual_event',
        travelerMode: 'virtual',
        label: `${evt.title} (Virtual)`,
        sublabel: `Online meeting · ${formatTimeShort(evt.start)} – ${formatTimeShort(effectiveEndIso)}`,
        eventId: evt.id,
        startIso: actualArrivalAtEventIso,
        endIso: effectiveEndIso,
        realDurationMinutes: virtualMin,
        playbackDurationSeconds: computeEventPlaybackDurationSeconds(virtualMin),
        pathCoordinates: stationaryPath,
        isStationary: true,
        isAcceleratedEvent: virtualMin >= 60,
        isConflictFlagged: Boolean(relatedConflict),
        isLateArrival: false,
        lateByMinutes: 0,
        isUnavailableGap: false,
      });
      simulatedCursorIso = effectiveEndIso;
      continue;
    }

    // Missing Location Event Handling (R10: show explanatory state, never invent path)
    if (!evt.coordinates) {
      const missingMin = Math.max(
        15,
        diffMinutes(actualArrivalAtEventIso, effectiveEndIso)
      );
      pushSegment({
        id: `seg-missing-evt-${evt.id}`,
        kind: 'unavailable_gap',
        travelerMode: 'unavailable',
        label: `${evt.title} — Location missing`,
        sublabel: `Cannot animate stop without verified venue coordinates (${formatTimeShort(evt.start)} – ${formatTimeShort(effectiveEndIso)})`,
        eventId: evt.id,
        conflictId: relatedConflict?.id,
        startIso: actualArrivalAtEventIso,
        endIso: effectiveEndIso,
        realDurationMinutes: missingMin,
        playbackDurationSeconds: 1.8,
        pathCoordinates: [],
        isStationary: true,
        isAcceleratedEvent: false,
        isConflictFlagged: true,
        isLateArrival,
        lateByMinutes,
        isUnavailableGap: true,
      });
      simulatedCursorIso = effectiveEndIso;
      continue;
    }

    const evtCoordPair: [number, number] = [
      evt.coordinates.lat,
      evt.coordinates.lng,
    ];

    const hasEarlyLeaveConflict =
      outgoingLeg &&
      outgoingLeg.selectedRoute &&
      outgoingLeg.recommendedLeaveIso &&
      new Date(outgoingLeg.recommendedLeaveIso).getTime() <
        new Date(effectiveEndIso).getTime() &&
      new Date(outgoingLeg.recommendedLeaveIso).getTime() >
        new Date(actualArrivalAtEventIso).getTime();

    const userDecision: ConflictDecisionChoice | undefined = outgoingLeg
      ? conflictDecisions[outgoingLeg.id]
      : undefined;

    if (hasEarlyLeaveConflict && outgoingLeg && outgoingLeg.recommendedLeaveIso) {
      const decisionIso = outgoingLeg.recommendedLeaveIso;
      const preDecisionMinutes = Math.max(
        5,
        diffMinutes(actualArrivalAtEventIso, decisionIso)
      );

      pushSegment({
        id: `seg-event-pre-${evt.id}`,
        kind: 'event_attendance',
        travelerMode: 'at_event',
        label: evt.title,
        sublabel: `${evt.neighborhood || evt.location} · Attending until ${formatTimeShort(decisionIso)} departure window`,
        eventId: evt.id,
        legId: outgoingLeg.id,
        conflictId: relatedConflict?.id,
        startIso: actualArrivalAtEventIso,
        endIso: decisionIso,
        realDurationMinutes: preDecisionMinutes,
        playbackDurationSeconds:
          computeEventPlaybackDurationSeconds(preDecisionMinutes),
        pathCoordinates: [evtCoordPair],
        isStationary: true,
        isAcceleratedEvent: preDecisionMinutes >= 60,
        isConflictFlagged: userDecision !== 'leave_on_time',
        isLateArrival,
        lateByMinutes,
        isUnavailableGap: false,
        appliedDecision: userDecision,
      });

      const travelMin = outgoingLeg.selectedRoute!.durationMinutes;
      const lateIfStayMinutes = Math.max(
        1,
        diffMinutes(
          outgoingLeg.toEvent.start,
          addMinutesIso(effectiveEndIso, travelMin)
        )
      );

      decisionPoints.push({
        id: `dp-${outgoingLeg.id}`,
        legId: outgoingLeg.id,
        conflictId: relatedConflict?.id,
        fromEventId: evt.id,
        toEventId: outgoingLeg.toEvent.id,
        fromEventTitle: evt.title,
        toEventTitle: outgoingLeg.toEvent.title,
        decisionTimeIso: decisionIso,
        decisionTimeLabel: formatTimeShort(decisionIso),
        scheduledEndIso: effectiveEndIso,
        scheduledEndLabel: formatTimeShort(effectiveEndIso),
        nextEventStartIso: outgoingLeg.toEvent.start,
        nextEventStartLabel: formatTimeShort(outgoingLeg.toEvent.start),
        travelDurationMinutes: travelMin,
        bufferMinutes: outgoingLeg.bufferMinutes,
        lateArrivalMinutesIfStay: lateIfStayMinutes,
        playbackTimeSeconds: cursorPlaybackSeconds,
        coordinates: evt.coordinates,
      });

      if (userDecision === 'leave_on_time') {
        simulatedCursorIso = decisionIso;
      } else {
        const postDecisionMinutes = Math.max(
          5,
          diffMinutes(decisionIso, effectiveEndIso)
        );
        pushSegment({
          id: `seg-event-post-${evt.id}`,
          kind: 'event_attendance',
          travelerMode: 'at_event',
          label: `${evt.title} (Staying past leave-by)`,
          sublabel: `Staying until ${formatTimeShort(effectiveEndIso)} causes ${lateIfStayMinutes}m late arrival at ${outgoingLeg.toEvent.title}`,
          eventId: evt.id,
          legId: outgoingLeg.id,
          conflictId: relatedConflict?.id,
          startIso: decisionIso,
          endIso: effectiveEndIso,
          realDurationMinutes: postDecisionMinutes,
          playbackDurationSeconds:
            computeEventPlaybackDurationSeconds(postDecisionMinutes),
          pathCoordinates: [evtCoordPair],
          isStationary: true,
          isAcceleratedEvent: postDecisionMinutes >= 45,
          isConflictFlagged: true,
          isLateArrival,
          lateByMinutes,
          isUnavailableGap: false,
          appliedDecision: userDecision,
        });
        simulatedCursorIso = effectiveEndIso;
      }
    } else {
      const stayEndIso =
        new Date(effectiveEndIso).getTime() >
        new Date(actualArrivalAtEventIso).getTime()
          ? effectiveEndIso
          : addMinutesIso(actualArrivalAtEventIso, 15);
      const eventMinutes = Math.max(
        5,
        diffMinutes(actualArrivalAtEventIso, stayEndIso)
      );

      pushSegment({
        id: `seg-event-${evt.id}`,
        kind: 'event_attendance',
        travelerMode: 'at_event',
        label: evt.title,
        sublabel: isLateArrival
          ? `Arrived ${lateByMinutes} min late · ${evt.neighborhood || evt.location}`
          : `${evt.neighborhood || evt.location} · ${formatTimeShort(evt.start)} – ${formatTimeShort(effectiveEndIso)}`,
        eventId: evt.id,
        conflictId: relatedConflict?.id,
        startIso: actualArrivalAtEventIso,
        endIso: stayEndIso,
        realDurationMinutes: eventMinutes,
        playbackDurationSeconds:
          computeEventPlaybackDurationSeconds(eventMinutes),
        pathCoordinates: [evtCoordPair],
        isStationary: true,
        isAcceleratedEvent: eventMinutes >= 60,
        isConflictFlagged: isLateArrival,
        isLateArrival,
        lateByMinutes,
        isUnavailableGap: false,
      });

      simulatedCursorIso = stayEndIso;
    }

    if (outgoingLeg) {
      const legConflict = conflicts.find(
        (c) =>
          c.legId === outgoingLeg.id ||
          (c.eventIds.includes(outgoingLeg.fromEventId) &&
            c.eventIds.includes(outgoingLeg.toEventId))
      );

      if (
        outgoingLeg.status === 'missing_location' ||
        !outgoingLeg.selectedRoute ||
        outgoingLeg.selectedRoute.coordinates.length === 0
      ) {
        const gapStartIso = simulatedCursorIso || effectiveEndIso;
        const gapEndIso =
          new Date(outgoingLeg.toEvent.start).getTime() >
          new Date(gapStartIso).getTime()
            ? outgoingLeg.toEvent.start
            : addMinutesIso(gapStartIso, 20);
        const gapMin = Math.max(5, diffMinutes(gapStartIso, gapEndIso));

        pushSegment({
          id: `seg-gap-${outgoingLeg.id}`,
          kind: 'unavailable_gap',
          travelerMode: 'unavailable',
          label: `Route unavailable to ${outgoingLeg.toEvent.title}`,
          sublabel:
            'Missing destination address — investigate with Argon to unlock route geometry',
          legId: outgoingLeg.id,
          conflictId: legConflict?.id,
          startIso: gapStartIso,
          endIso: gapEndIso,
          realDurationMinutes: gapMin,
          playbackDurationSeconds: 1.8,
          pathCoordinates: [evtCoordPair],
          isStationary: true,
          isAcceleratedEvent: false,
          isConflictFlagged: true,
          isLateArrival: false,
          lateByMinutes: 0,
          isUnavailableGap: true,
        });
        simulatedCursorIso = gapEndIso;
      } else {
        const route = outgoingLeg.selectedRoute;
        const enrichedModeRoute =
          outgoingLeg.fromEvent.coordinates && outgoingLeg.toEvent.coordinates
            ? buildModeSpecificRoute(
                outgoingLeg.fromEvent.coordinates,
                outgoingLeg.toEvent.coordinates,
                outgoingLeg.selectedMode,
                route.durationMinutes,
                route
              )
            : null;

        if (enrichedModeRoute) {
          modeRoutesByLegId[outgoingLeg.id] = enrichedModeRoute;
        }

        const subSteps = enrichedModeRoute
          ? enrichedModeRoute.subSegments.map((s) => ({
              kind: s.kind,
              travelerMode: s.travelerMode,
              label: s.label,
              durationMinutes: s.durationMinutes,
              pathCoordinates: s.pathCoordinates,
              isStationary: s.isStationary,
              isUnderground: s.isUnderground,
              depthFeet: s.depthFeet,
              stationName: s.stationName,
              vehicleLabel: s.lineName,
            }))
          : buildRouteSubSteps(route).map((s) => ({
              ...s,
              isUnderground: false,
              depthFeet: undefined,
              stationName: undefined,
            }));

        let departIso = simulatedCursorIso || effectiveEndIso;
        if (
          userDecision !== 'leave_on_time' &&
          outgoingLeg.recommendedLeaveIso &&
          new Date(outgoingLeg.recommendedLeaveIso).getTime() >
            new Date(departIso).getTime()
        ) {
          const waitBeforeLeaveMin = diffMinutes(
            departIso,
            outgoingLeg.recommendedLeaveIso
          );
          if (waitBeforeLeaveMin > 0) {
            pushSegment({
              id: `seg-predepart-wait-${outgoingLeg.id}`,
              kind: 'arrival_buffer_wait',
              travelerMode: 'waiting',
              label: `Transition window before departing for ${outgoingLeg.toEvent.title}`,
              sublabel: `Recommended leave-by: ${formatTimeShort(outgoingLeg.recommendedLeaveIso)}`,
              legId: outgoingLeg.id,
              startIso: departIso,
              endIso: outgoingLeg.recommendedLeaveIso,
              realDurationMinutes: waitBeforeLeaveMin,
              playbackDurationSeconds: Math.min(
                1.4,
                Math.max(0.6, waitBeforeLeaveMin / 25)
              ),
              pathCoordinates: [evtCoordPair],
              isStationary: true,
              isAcceleratedEvent: waitBeforeLeaveMin >= 30,
              isConflictFlagged: false,
              isLateArrival: false,
              lateByMinutes: 0,
              isUnavailableGap: false,
            });
            departIso = outgoingLeg.recommendedLeaveIso;
          }
        }

        const expectedArrivalIso = addMinutesIso(
          departIso,
          route.durationMinutes
        );
        const legArrivesLateMinutes = Math.max(
          0,
          diffMinutes(outgoingLeg.toEvent.start, expectedArrivalIso)
        );
        const legIsFlagged =
          legArrivesLateMinutes > 0 ||
          (outgoingLeg.status !== 'feasible' &&
            userDecision !== 'leave_on_time');

        let stepCursorIso = departIso;
        subSteps.forEach((step, stepIdx) => {
          const stepEndIso = addMinutesIso(stepCursorIso, step.durationMinutes);
          const stepPlaybackSec = step.isStationary
            ? Math.min(1.6, Math.max(0.75, step.durationMinutes / 5))
            : computeTravelPlaybackDurationSeconds(step.durationMinutes);

          pushSegment({
            id: `seg-leg-${outgoingLeg.id}-step-${stepIdx}`,
            kind: step.kind,
            travelerMode: step.travelerMode,
            label: `${outgoingLeg.fromEvent.neighborhood || outgoingLeg.fromEvent.title} → ${outgoingLeg.toEvent.neighborhood || outgoingLeg.toEvent.title}`,
            sublabel:
              legArrivesLateMinutes > 0
                ? `${step.label} · Arriving ${legArrivesLateMinutes}m late`
                : step.label,
            legId: outgoingLeg.id,
            conflictId: legConflict?.id,
            startIso: stepCursorIso,
            endIso: stepEndIso,
            realDurationMinutes: step.durationMinutes,
            playbackDurationSeconds: stepPlaybackSec,
            pathCoordinates: step.pathCoordinates,
            isStationary: step.isStationary,
            isAcceleratedEvent: false,
            isConflictFlagged: legIsFlagged,
            isLateArrival: legArrivesLateMinutes > 0,
            lateByMinutes: legArrivesLateMinutes,
            isUnavailableGap: false,
            isUnderground: step.isUnderground,
            depthFeet: step.depthFeet,
            stationName: step.stationName,
            vehicleLabel: step.vehicleLabel,
            appliedDecision: userDecision,
          });
          stepCursorIso = stepEndIso;
        });

        const bufferWaitMin = diffMinutes(
          stepCursorIso,
          outgoingLeg.toEvent.start
        );
        if (bufferWaitMin > 0 && outgoingLeg.toEvent.coordinates) {
          const destPair: [number, number] = [
            outgoingLeg.toEvent.coordinates.lat,
            outgoingLeg.toEvent.coordinates.lng,
          ];
          pushSegment({
            id: `seg-buffer-${outgoingLeg.id}`,
            kind: 'arrival_buffer_wait',
            travelerMode: 'waiting',
            label: `Arrived early at ${outgoingLeg.toEvent.title}`,
            sublabel: `${bufferWaitMin} min arrival buffer before ${formatTimeShort(outgoingLeg.toEvent.start)} start`,
            eventId: outgoingLeg.toEvent.id,
            legId: outgoingLeg.id,
            startIso: stepCursorIso,
            endIso: outgoingLeg.toEvent.start,
            realDurationMinutes: bufferWaitMin,
            playbackDurationSeconds: 0.75,
            pathCoordinates: [destPair],
            isStationary: true,
            isAcceleratedEvent: false,
            isConflictFlagged: false,
            isLateArrival: false,
            lateByMinutes: 0,
            isUnavailableGap: false,
          });
          simulatedCursorIso = outgoingLeg.toEvent.start;
        } else {
          simulatedCursorIso = stepCursorIso;
        }
      }
    }
  }

  // Append automatic Return-Home leg & destination at the end of the day when effectiveHomeOrigin is active
  const lastNonVirtualEvent = [...sortedEvents]
    .reverse()
    .find((e) => !e.isVirtual);

  if (effectiveHomeOrigin && effectiveHomeOrigin.coordinates && lastNonVirtualEvent) {
    const homeOrigin = effectiveHomeOrigin;
    const departReturnIso =
      simulatedCursorIso || getEffectiveEndIso(lastNonVirtualEvent);
    const preferredReturnMode: TravelMode =
      homeOrigin.preferredReturnMode || homeOrigin.preferredMode || 'transit';

    const syntheticHomeReturnEvent: CalendarEvent = {
      id: 'evt-home-return',
      title: `Home (${homeOrigin.neighborhood})`,
      start: departReturnIso,
      end: addMinutesIso(departReturnIso, 30),
      location: homeOrigin.address,
      neighborhood: `Home · ${homeOrigin.neighborhood}`,
      coordinates: homeOrigin.coordinates,
      isVirtual: false,
    };

    if (lastNonVirtualEvent.coordinates) {
      const returnAlternatives = computeRouteOptionsForPair(
        lastNonVirtualEvent,
        syntheticHomeReturnEvent
      );
      const selectedReturnRoute =
        returnAlternatives.find((r) => r.mode === preferredReturnMode) ||
        returnAlternatives[0] ||
        null;

      if (selectedReturnRoute) {
        const enrichedReturnRoute = buildModeSpecificRoute(
          lastNonVirtualEvent.coordinates,
          homeOrigin.coordinates,
          selectedReturnRoute.mode,
          selectedReturnRoute.durationMinutes,
          selectedReturnRoute
        );
        modeRoutesByLegId['leg-home-return'] = enrichedReturnRoute;

        const returnArrivalIso = addMinutesIso(
          departReturnIso,
          selectedReturnRoute.durationMinutes
        );
        const homeSettledEndIso = addMinutesIso(returnArrivalIso, 15);
        const homeCoordPair: [number, number] = [
          homeOrigin.coordinates.lat,
          homeOrigin.coordinates.lng,
        ];

        homeReturnLeg = {
          id: 'leg-home-return',
          fromEventId: lastNonVirtualEvent.id,
          toEventId: syntheticHomeReturnEvent.id,
          fromEvent: lastNonVirtualEvent,
          toEvent: {
            ...syntheticHomeReturnEvent,
            start: returnArrivalIso,
            end: homeSettledEndIso,
          },
          selectedMode: selectedReturnRoute.mode,
          selectedRoute: {
            ...selectedReturnRoute,
            coordinates: enrichedReturnRoute.fullPathCoordinates,
          },
          alternatives: returnAlternatives,
          availableWindowMinutes:
            selectedReturnRoute.durationMinutes + bufferMinutes + 15,
          bufferMinutes,
          recommendedLeaveIso: departReturnIso,
          arrivalEstimateIso: returnArrivalIso,
          slackMinutes: 15,
          status: 'feasible',
        };

        // 1. Travel steps from Last Event -> Home
        let returnStepCursorIso = departReturnIso;
        enrichedReturnRoute.subSegments.forEach((step, idx) => {
          const stepEndIso = addMinutesIso(
            returnStepCursorIso,
            step.durationMinutes
          );
          const stepPlaybackSec = step.isStationary
            ? Math.min(1.5, Math.max(0.75, step.durationMinutes / 5))
            : computeTravelPlaybackDurationSeconds(step.durationMinutes);

          pushSegment({
            id: `seg-home-return-step-${idx}`,
            kind: step.kind,
            travelerMode: step.travelerMode,
            label: `${lastNonVirtualEvent.neighborhood || lastNonVirtualEvent.title} → Home (${homeOrigin.neighborhood})`,
            sublabel: step.label,
            legId: 'leg-home-return',
            startIso: returnStepCursorIso,
            endIso: stepEndIso,
            realDurationMinutes: step.durationMinutes,
            playbackDurationSeconds: stepPlaybackSec,
            pathCoordinates: step.pathCoordinates,
            isStationary: step.isStationary,
            isUnderground: step.isUnderground,
            depthFeet: step.depthFeet,
            stationName: step.stationName,
            isAcceleratedEvent: false,
            isConflictFlagged: false,
            isLateArrival: false,
            lateByMinutes: 0,
            isUnavailableGap: false,
            vehicleLabel: step.lineName,
          });
          returnStepCursorIso = stepEndIso;
        });

        // 2. Stationary "Arrived Home" final destination segment
        pushSegment({
          id: 'seg-home-return-end',
          kind: 'event_attendance',
          travelerMode: 'at_event',
          label: `Final Destination: Home (${homeOrigin.neighborhood})`,
          sublabel: `${homeOrigin.address} · Arrived home at ${formatTimeShort(returnArrivalIso)}`,
          eventId: 'evt-home-return',
          legId: 'leg-home-return',
          startIso: returnArrivalIso,
          endIso: homeSettledEndIso,
          realDurationMinutes: 15,
          playbackDurationSeconds: 1.25,
          pathCoordinates: [homeCoordPair],
          isStationary: true,
          isAcceleratedEvent: false,
          isConflictFlagged: false,
          isLateArrival: false,
          lateByMinutes: 0,
          isUnavailableGap: false,
        });

        simulatedCursorIso = homeSettledEndIso;
      }
    } else {
      // Last event is missing venue coordinates; still expose homeReturnLeg so the UI displays the return-home leg & destination
      homeReturnLeg = {
        id: 'leg-home-return',
        fromEventId: lastNonVirtualEvent.id,
        toEventId: syntheticHomeReturnEvent.id,
        fromEvent: lastNonVirtualEvent,
        toEvent: syntheticHomeReturnEvent,
        selectedMode: preferredReturnMode,
        selectedRoute: null,
        alternatives: [],
        availableWindowMinutes: 60,
        bufferMinutes,
        recommendedLeaveIso: departReturnIso,
        arrivalEstimateIso: null,
        slackMinutes: null,
        status: 'missing_location',
      };
    }
  }

  const dayStartIso = segments.length > 0 ? segments[0].startIso : null;
  const dayEndIso =
    segments.length > 0 ? segments[segments.length - 1].endIso : null;
  const totalRealMinutes =
    dayStartIso && dayEndIso
      ? Math.max(0, diffMinutes(dayStartIso, dayEndIso))
      : 0;

  const playablePhysicalEventsCount = sortedEvents.filter(
    (e) => !e.isVirtual && Boolean(e.coordinates)
  ).length;

  return {
    segments,
    decisionPoints,
    modeRoutesByLegId,
    viewportBounds,
    homeOrigin: effectiveHomeOrigin,
    homeLeg,
    homeReturnLeg,
    totalPlaybackSeconds: Number(cursorPlaybackSeconds.toFixed(2)),
    totalRealMinutes,
    dayStartIso,
    dayEndIso,
    playablePhysicalEventsCount,
    hasUnresolvedConflicts: segments.some((s) => s.isConflictFlagged),
    hasMissingDataGaps: segments.some((s) => s.isUnavailableGap),
    provenanceLabel: isPastDay
      ? 'Reconstructed historical itinerary preview · Present-day route estimates (not recorded GPS tracking)'
      : viewportBounds.isSanFrancisco
      ? 'Planned 2D itinerary preview · Deterministic SF route geometry & timing'
      : `Planned 2D itinerary preview · ${viewportBounds.regionLabel} global route geometry & timing`,
  };
}

/**
 * Pure deterministic sampling function: given a PlaybackTimeline and any playback timestamp
 * (whether from requestAnimationFrame or user scrubbing the slider), returns the exact
 * synchronized state (position, simulated clock, active event/leg, mode icon, conflict badges).
 */
export function sampleTimelineAt(
  timeline: PlaybackTimeline,
  playbackTimeSeconds: number,
  conflictDecisions: Record<string, ConflictDecisionChoice> = {}
): PlaybackSampleState {
  if (timeline.segments.length === 0 || timeline.totalPlaybackSeconds <= 0) {
    return {
      playbackTimeSeconds: 0,
      progressFraction: 0,
      simulatedTimeIso: new Date().toISOString(),
      simulatedClockLabel: '--:--',
      activeSegment: null,
      travelerMode: 'unavailable',
      coordinates: null,
      svgPoint: null,
      headingDegrees: 0,
      activeEventId: null,
      activeLegId: null,
      clockAccelerationFactor: 1,
      isConflictFlagged: false,
      isLateArrival: false,
      lateByMinutes: 0,
      isUnavailableGap: true,
      triggeredDecisionPoint: null,
    };
  }

  const clampedSec = Math.max(
    0,
    Math.min(timeline.totalPlaybackSeconds, playbackTimeSeconds)
  );
  const progressFraction = clampedSec / timeline.totalPlaybackSeconds;

  const activeSegment =
    timeline.segments.find(
      (seg) =>
        clampedSec >= seg.playbackStartSeconds &&
        clampedSec <= seg.playbackEndSeconds
    ) || timeline.segments[timeline.segments.length - 1];

  const segDuration = Math.max(0.001, activeSegment.playbackDurationSeconds);
  const localProgress = Math.max(
    0,
    Math.min(1, (clampedSec - activeSegment.playbackStartSeconds) / segDuration)
  );

  const startMs = new Date(activeSegment.startIso).getTime();
  const endMs = new Date(activeSegment.endIso).getTime();
  const simMs = Math.round(startMs + (endMs - startMs) * localProgress);
  const simulatedTimeIso = new Date(simMs).toISOString();
  const simulatedClockLabel = formatTimeShort(simulatedTimeIso);

  const { coordinates, headingDegrees } = interpolateAlongPolyline(
    activeSegment.pathCoordinates,
    localProgress
  );
  const svgPoint = coordinates
    ? projectLatLngToSvgSubpixel(coordinates, timeline.viewportBounds)
    : null;

  const triggeredDecisionPoint =
    timeline.decisionPoints.find(
      (dp) =>
        !conflictDecisions[dp.legId] &&
        Math.abs(clampedSec - dp.playbackTimeSeconds) <= 0.18
    ) || null;

  return {
    playbackTimeSeconds: Number(clampedSec.toFixed(2)),
    progressFraction: Number(progressFraction.toFixed(4)),
    simulatedTimeIso,
    simulatedClockLabel,
    activeSegment,
    travelerMode: activeSegment.travelerMode,
    coordinates,
    svgPoint,
    headingDegrees,
    activeEventId: activeSegment.eventId || null,
    activeLegId: activeSegment.legId || null,
    clockAccelerationFactor: activeSegment.clockAccelerationFactor,
    isConflictFlagged: activeSegment.isConflictFlagged,
    isLateArrival: activeSegment.isLateArrival,
    lateByMinutes: activeSegment.lateByMinutes,
    isUnavailableGap: activeSegment.isUnavailableGap,
    triggeredDecisionPoint,
  };
}
