import { CalendarEvent, RouteOption, TravelMode } from '../types';
import { isWithinSanFrancisco } from '../playback/sf-transit-network';

interface CuratedRouteSpec {
  mode: TravelMode;
  summary: string;
  durationMinutes: number;
  distanceKm: number;
  uncertaintyMinutes: number;
  trafficNote: string;
  coordinates: [number, number][];
}

// Curated realistic San Francisco corridors so the handover demo matches `examples/sample-conflicts.json`
// exactly (e.g., Union Square -> Ferry Building is 25 min on Transit, 22 min Walking, 12 min Driving, 10 min Biking).
const CURATED_SF_CORRIDORS: Record<string, CuratedRouteSpec[]> = {
  'union square->ferry building': [
    {
      mode: 'transit',
      summary: 'Muni Metro + walk via Market St',
      durationMinutes: 25,
      distanceKm: 1.9,
      uncertaintyMinutes: 3,
      trafficNote: 'Includes 6 min Powell Station platform transfer & headway',
      coordinates: [
        [37.7879, -122.4075],
        [37.7845, -122.4068],
        [37.7892, -122.4014],
        [37.7931, -122.3965],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'walking',
      summary: 'Walk via Post St & Market St',
      durationMinutes: 22,
      distanceKm: 1.7,
      uncertaintyMinutes: 1,
      trafficNote: 'Flat urban sidewalk route down Market St',
      coordinates: [
        [37.7879, -122.4075],
        [37.7888, -122.4032],
        [37.7918, -122.3982],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'driving',
      summary: 'Ridehail / Drive via Sutter St & Embarcadero',
      durationMinutes: 12,
      distanceKm: 2.2,
      uncertaintyMinutes: 4,
      trafficNote: 'Moderate downtown signal delays (+3 min pickup ETA)',
      coordinates: [
        [37.7879, -122.4075],
        [37.7898, -122.4078],
        [37.7915, -122.3991],
        [37.7962, -122.3951],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'bicycling',
      summary: 'Bay Wheels Bike via Market St Bikeway',
      durationMinutes: 9,
      distanceKm: 1.8,
      uncertaintyMinutes: 1,
      trafficNote: 'Protected bike lane along Market St',
      coordinates: [
        [37.7879, -122.4075],
        [37.7852, -122.4058],
        [37.7905, -122.3997],
        [37.7955, -122.3937],
      ],
    },
  ],
  'ferry building->soma': [
    {
      mode: 'transit',
      summary: 'Muni N-Judah / T-Third to 2nd & Brannan',
      durationMinutes: 16,
      distanceKm: 1.8,
      uncertaintyMinutes: 2,
      trafficNote: 'Frequent Embarcadero waterfront light rail service',
      coordinates: [
        [37.7955, -122.3937],
        [37.7912, -122.3895],
        [37.7854, -122.3886],
        [37.7816, -122.3942],
      ],
    },
    {
      mode: 'walking',
      summary: 'Walk via Embarcadero & Townsend St',
      durationMinutes: 20,
      distanceKm: 1.6,
      uncertaintyMinutes: 1,
      trafficNote: 'Scenic waterfront promenade walk',
      coordinates: [
        [37.7955, -122.3937],
        [37.7902, -122.3912],
        [37.7851, -122.3928],
        [37.7816, -122.3942],
      ],
    },
    {
      mode: 'driving',
      summary: 'Drive via The Embarcadero & Bryant St',
      durationMinutes: 10,
      distanceKm: 1.9,
      uncertaintyMinutes: 3,
      trafficNote: 'Light afternoon waterfront traffic',
      coordinates: [
        [37.7955, -122.3937],
        [37.7898, -122.3889],
        [37.7834, -122.3905],
        [37.7816, -122.3942],
      ],
    },
    {
      mode: 'bicycling',
      summary: 'Bike via Embarcadero Two-Way Cycletrack',
      durationMinutes: 7,
      distanceKm: 1.7,
      uncertaintyMinutes: 1,
      trafficNote: 'Flat protected waterfront cycletrack',
      coordinates: [
        [37.7955, -122.3937],
        [37.7895, -122.3892],
        [37.7816, -122.3942],
      ],
    },
  ],
  'soma->ferry building': [
    {
      mode: 'transit',
      summary: 'Muni N-Judah Northbound to Embarcadero',
      durationMinutes: 16,
      distanceKm: 1.8,
      uncertaintyMinutes: 2,
      trafficNote: 'Direct Embarcadero light rail stop outside SHACK15',
      coordinates: [
        [37.7816, -122.3942],
        [37.7854, -122.3886],
        [37.7912, -122.3895],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'walking',
      summary: 'Walk via 2nd St & The Embarcadero',
      durationMinutes: 20,
      distanceKm: 1.6,
      uncertaintyMinutes: 1,
      trafficNote: 'Flat walk along Embarcadero',
      coordinates: [
        [37.7816, -122.3942],
        [37.7851, -122.3928],
        [37.7902, -122.3912],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'driving',
      summary: 'Drive via The Embarcadero Northbound',
      durationMinutes: 11,
      distanceKm: 1.9,
      uncertaintyMinutes: 3,
      trafficNote: 'Evening commute along Embarcadero',
      coordinates: [
        [37.7816, -122.3942],
        [37.7834, -122.3905],
        [37.7898, -122.3889],
        [37.7955, -122.3937],
      ],
    },
    {
      mode: 'bicycling',
      summary: 'Bike via Embarcadero Cycletrack',
      durationMinutes: 8,
      distanceKm: 1.7,
      uncertaintyMinutes: 1,
      trafficNote: 'Protected waterfront cycletrack',
      coordinates: [
        [37.7816, -122.3942],
        [37.7895, -122.3892],
        [37.7955, -122.3937],
      ],
    },
  ],
};

function classifyCorridorKey(loc?: string): string {
  if (!loc) return '';
  const l = loc.toLowerCase();
  if (l.includes('union square')) return 'union square';
  if (l.includes('ferry building') || l.includes('shack15')) return 'ferry building';
  if (l.includes('soma') || l.includes('south park')) return 'soma';
  return l;
}

function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export function computeRouteOptionsForPair(
  fromEvent: CalendarEvent,
  toEvent: CalendarEvent,
  checkedAtIso = '2026-10-25T11:24:00-07:00'
): RouteOption[] {
  if (!fromEvent.coordinates || !toEvent.coordinates) {
    return [];
  }

  const key = `${classifyCorridorKey(fromEvent.location)}->${classifyCorridorKey(toEvent.location)}`;
  const curated = CURATED_SF_CORRIDORS[key];

  if (curated) {
    return curated.map((spec) => ({
      id: `route-${fromEvent.id}-${toEvent.id}-${spec.mode}`,
      mode: spec.mode,
      summary: spec.summary,
      durationMinutes: spec.durationMinutes,
      distanceKm: spec.distanceKm,
      startEventId: fromEvent.id,
      endEventId: toEvent.id,
      provider: 'sf-deterministic-matrix',
      lastCheckedAt: checkedAtIso,
      uncertaintyMinutes: spec.uncertaintyMinutes,
      trafficNote: spec.trafficNote,
      coordinates: spec.coordinates,
    }));
  }

  // Fallback geometric urban routing calculation for any SF or global city pair
  const isSfPair =
    isWithinSanFrancisco(fromEvent.coordinates) &&
    isWithinSanFrancisco(toEvent.coordinates);
  const providerName: RouteOption['provider'] = isSfPair
    ? 'sf-deterministic-matrix'
    : 'global-route-matrix';

  const straightKm = Math.max(0.4, haversineDistanceKm(fromEvent.coordinates, toEvent.coordinates));
  const streetKm = Number((straightKm * 1.32).toFixed(1));
  const midLat = Number(((fromEvent.coordinates.lat + toEvent.coordinates.lat) / 2 + 0.0018).toFixed(4));
  const midLng = Number(((fromEvent.coordinates.lng + toEvent.coordinates.lng) / 2 - 0.0012).toFixed(4));

  const poly: [number, number][] = [
    [fromEvent.coordinates.lat, fromEvent.coordinates.lng],
    [midLat, midLng],
    [toEvent.coordinates.lat, toEvent.coordinates.lng],
  ];

  const isRegionalCorridor = streetKm > 6;
  const transitMin = isRegionalCorridor
    ? Math.round(18 + streetKm * 1.1)
    : Math.max(12, Math.round(streetKm * 7 + 6));
  const walkMin = Math.max(8, Math.round(streetKm * 12));
  const driveMin = isRegionalCorridor
    ? Math.round(10 + streetKm * 0.85)
    : Math.max(7, Math.round(streetKm * 4 + 4));
  const bikeMin = isRegionalCorridor
    ? Math.round(8 + streetKm * 3.2)
    : Math.max(6, Math.round(streetKm * 4.5 + 1));

  return [
    {
      id: `route-${fromEvent.id}-${toEvent.id}-transit`,
      mode: 'transit',
      summary: isSfPair
        ? 'Muni Metro / Rapid Bus + walk'
        : 'Metro / Rapid Transit + walk',
      durationMinutes: transitMin,
      distanceKm: streetKm,
      startEventId: fromEvent.id,
      endEventId: toEvent.id,
      provider: providerName,
      lastCheckedAt: checkedAtIso,
      uncertaintyMinutes: 3,
      trafficNote: 'Includes station access & transit headway',
      coordinates: poly,
    },
    {
      id: `route-${fromEvent.id}-${toEvent.id}-walking`,
      mode: 'walking',
      summary: 'Direct city walk',
      durationMinutes: walkMin,
      distanceKm: streetKm,
      startEventId: fromEvent.id,
      endEventId: toEvent.id,
      provider: providerName,
      lastCheckedAt: checkedAtIso,
      uncertaintyMinutes: 1,
      trafficNote: 'Pedestrian street grid route',
      coordinates: poly,
    },
    {
      id: `route-${fromEvent.id}-${toEvent.id}-driving`,
      mode: 'driving',
      summary: 'Drive / Ridehail',
      durationMinutes: driveMin,
      distanceKm: streetKm,
      startEventId: fromEvent.id,
      endEventId: toEvent.id,
      provider: providerName,
      lastCheckedAt: checkedAtIso,
      uncertaintyMinutes: 4,
      trafficNote: 'Urban arterial traffic estimate',
      coordinates: poly,
    },
    {
      id: `route-${fromEvent.id}-${toEvent.id}-bicycling`,
      mode: 'bicycling',
      summary: isSfPair ? 'Bike / Bay Wheels e-bike' : 'Bike / Micromobility',
      durationMinutes: bikeMin,
      distanceKm: streetKm,
      startEventId: fromEvent.id,
      endEventId: toEvent.id,
      provider: providerName,
      lastCheckedAt: checkedAtIso,
      uncertaintyMinutes: 1,
      trafficNote: isSfPair ? 'SF bike lane network' : 'Protected urban bike lane',
      coordinates: poly,
    },
  ];
}
