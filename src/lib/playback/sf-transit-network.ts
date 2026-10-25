import { GeoCoordinates, RouteOption, TravelMode } from '../types';

export interface UndergroundStation {
  id: string;
  name: string;
  shortName: string;
  coordinates: GeoCoordinates;
  isUnderground: boolean;
  depthFeet?: number;
  corridor: 'market-subway' | 'central-subway' | 'embarcadero-surface';
  lines: string[];
}

export interface TransitCorridorLine {
  id: string;
  name: string;
  shortCode: string;
  isUnderground: boolean;
  colorHex: string;
  stationIds: string[];
  tunnelPath: [number, number][];
}

export interface ModeRouteSubSegment {
  kind: 'travel_walk' | 'travel_wait' | 'travel_ride';
  travelerMode: 'walking' | 'waiting' | 'transit' | 'driving' | 'bicycling';
  label: string;
  durationMinutes: number;
  pathCoordinates: [number, number][];
  isStationary: boolean;
  isUnderground: boolean;
  stationName?: string;
  lineName?: string;
  depthFeet?: number;
}

export interface EnrichedModeRoute {
  mode: TravelMode;
  corridorSummary: string;
  infrastructureNote: string;
  usesUndergroundTransit: boolean;
  fullPathCoordinates: [number, number][];
  subSegments: ModeRouteSubSegment[];
  undergroundStationsUsed: UndergroundStation[];
}

/**
 * Authentic San Francisco Underground Subway & Light-Rail Stations
 * calibrated to the SF map bounds (lat 37.762..37.809, lng -122.425..-122.383).
 */
export const SF_TRANSIT_STATIONS: Record<string, UndergroundStation> = {
  'embarcadero-stn': {
    id: 'embarcadero-stn',
    name: 'Embarcadero Underground Station',
    shortName: 'Embarcadero Stn',
    coordinates: { lat: 37.7929, lng: -122.3968 },
    isUnderground: true,
    depthFeet: 48,
    corridor: 'market-subway',
    lines: ['BART All Lines', 'Muni Metro J/K/L/M/N'],
  },
  'montgomery-stn': {
    id: 'montgomery-stn',
    name: 'Montgomery St Underground Station',
    shortName: 'Montgomery Stn',
    coordinates: { lat: 37.7894, lng: -122.4013 },
    isUnderground: true,
    depthFeet: 52,
    corridor: 'market-subway',
    lines: ['BART All Lines', 'Muni Metro J/K/L/M/N'],
  },
  'powell-stn': {
    id: 'powell-stn',
    name: 'Powell St Underground Station',
    shortName: 'Powell Stn',
    coordinates: { lat: 37.7844, lng: -122.4079 },
    isUnderground: true,
    depthFeet: 58,
    corridor: 'market-subway',
    lines: ['BART All Lines', 'Muni Metro J/K/L/M/N', 'T-Third Transfer'],
  },
  'civic-center-stn': {
    id: 'civic-center-stn',
    name: 'Civic Center / UN Plaza Underground Station',
    shortName: 'Civic Center Stn',
    coordinates: { lat: 37.7795, lng: -122.4138 },
    isUnderground: true,
    depthFeet: 50,
    corridor: 'market-subway',
    lines: ['BART All Lines', 'Muni Metro J/K/L/M/N'],
  },
  '16th-mission-stn': {
    id: '16th-mission-stn',
    name: '16th St Mission BART Underground Station',
    shortName: '16th & Mission BART',
    coordinates: { lat: 37.765, lng: -122.4197 },
    isUnderground: true,
    depthFeet: 54,
    corridor: 'market-subway',
    lines: ['BART Red/Yellow/Blue/Green'],
  },
  'chinatown-stn': {
    id: 'chinatown-stn',
    name: 'Chinatown–Rose Pak Underground Station',
    shortName: 'Chinatown Stn',
    coordinates: { lat: 37.7956, lng: -122.4068 },
    isUnderground: true,
    depthFeet: 92,
    corridor: 'central-subway',
    lines: ['Muni T-Third Central Subway'],
  },
  'union-sq-stn': {
    id: 'union-sq-stn',
    name: 'Union Square / Market St Underground Station',
    shortName: 'Union Sq Underground',
    coordinates: { lat: 37.7865, lng: -122.4055 },
    isUnderground: true,
    depthFeet: 96,
    corridor: 'central-subway',
    lines: ['Muni T-Third Central Subway'],
  },
  'yerba-buena-moscone-stn': {
    id: 'yerba-buena-moscone-stn',
    name: 'Yerba Buena / Moscone Underground Station',
    shortName: 'Moscone Underground',
    coordinates: { lat: 37.7829, lng: -122.4008 },
    isUnderground: true,
    depthFeet: 72,
    corridor: 'central-subway',
    lines: ['Muni T-Third Central Subway'],
  },
  '4th-brannan-portal': {
    id: '4th-brannan-portal',
    name: '4th & Brannan Central Subway Portal',
    shortName: '4th & Brannan',
    coordinates: { lat: 37.7788, lng: -122.3962 },
    isUnderground: false,
    corridor: 'central-subway',
    lines: ['Muni T-Third Light Rail'],
  },
  'ferry-bldg-portal': {
    id: 'ferry-bldg-portal',
    name: 'Embarcadero & Ferry Building Rail Portal',
    shortName: 'Ferry Bldg Portal',
    coordinates: { lat: 37.7952, lng: -122.3939 },
    isUnderground: false,
    corridor: 'embarcadero-surface',
    lines: ['Muni N-Judah / F-Market'],
  },
  'brannan-embarcadero-stop': {
    id: 'brannan-embarcadero-stop',
    name: 'Brannan & The Embarcadero Light Rail Station',
    shortName: 'Brannan Stn',
    coordinates: { lat: 37.7848, lng: -122.3888 },
    isUnderground: false,
    corridor: 'embarcadero-surface',
    lines: ['Muni N-Judah / T-Third'],
  },
  'pier-27-stop': {
    id: 'pier-27-stop',
    name: 'The Embarcadero & Pier 27 Historic Streetcar Stop',
    shortName: 'Pier 27 Stop',
    coordinates: { lat: 37.8058, lng: -122.4015 },
    isUnderground: false,
    corridor: 'embarcadero-surface',
    lines: ['Muni F-Market & Wharves'],
  },
};

export const SF_SUBWAY_TUNNELS: TransitCorridorLine[] = [
  {
    id: 'market-street-subway',
    name: 'Market St Subway Tunnel (BART + Muni Metro)',
    shortCode: 'BART / MUNI SUBWAY',
    isUnderground: true,
    colorHex: '#4338ca',
    stationIds: [
      'embarcadero-stn',
      'montgomery-stn',
      'powell-stn',
      'civic-center-stn',
      '16th-mission-stn',
    ],
    tunnelPath: [
      [37.7929, -122.3968],
      [37.7894, -122.4013],
      [37.7844, -122.4079],
      [37.7795, -122.4138],
      [37.7752, -122.4193],
      [37.765, -122.4197],
    ],
  },
  {
    id: 'central-subway-tunnel',
    name: 'Central Subway Deep-Bore Tunnel (Muni T-Third)',
    shortCode: 'CENTRAL SUBWAY (T)',
    isUnderground: true,
    colorHex: '#dc2626',
    stationIds: [
      'chinatown-stn',
      'union-sq-stn',
      'powell-stn',
      'yerba-buena-moscone-stn',
      '4th-brannan-portal',
    ],
    tunnelPath: [
      [37.7956, -122.4068],
      [37.7865, -122.4055],
      [37.7844, -122.4079],
      [37.7829, -122.4008],
      [37.7788, -122.3962],
    ],
  },
];

function distSq(a: GeoCoordinates, b: GeoCoordinates): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

export function isWithinSanFrancisco(coord?: GeoCoordinates | null): boolean {
  if (!coord) return false;
  return (
    coord.lat >= 37.7 &&
    coord.lat <= 37.84 &&
    coord.lng >= -122.52 &&
    coord.lng <= -122.35
  );
}

function buildGlobalTransitPlan(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
  existingRoute?: RouteOption | null
): {
  boardStation: UndergroundStation;
  alightStation: UndergroundStation;
  intermediateStations: UndergroundStation[];
  isUndergroundRide: boolean;
  lineLabel: string;
  ridePath: [number, number][];
} {
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  const span = Math.hypot(dLat, dLng);
  const isRegionalCorridor = span > 0.12; // Caltrain / BART / Metrolink regional rail
  const isSoCal = origin.lat < 35.2 || destination.lat < 35.2;

  const boardCoord: GeoCoordinates = {
    lat: Number((origin.lat + dLat * 0.16 + dLng * 0.04).toFixed(5)),
    lng: Number((origin.lng + dLng * 0.16 - dLat * 0.04).toFixed(5)),
  };
  const midCoord: GeoCoordinates = {
    lat: Number((origin.lat + dLat * 0.5 + dLng * 0.06).toFixed(5)),
    lng: Number((origin.lng + dLng * 0.5 - dLat * 0.06).toFixed(5)),
  };
  const alightCoord: GeoCoordinates = {
    lat: Number((origin.lat + dLat * 0.84 + dLng * 0.03).toFixed(5)),
    lng: Number((origin.lng + dLng * 0.84 - dLat * 0.03).toFixed(5)),
  };

  const defaultLine = isSoCal
    ? isRegionalCorridor
      ? 'Metrolink / LA Metro Express'
      : 'LA Metro Rail Line'
    : isRegionalCorridor
    ? 'Caltrain Express / BART Regional'
    : 'Bay Area Transit / VTA Light Rail';

  const lineLabel = existingRoute?.summary || defaultLine;

  const boardStation: UndergroundStation = {
    id: 'ca-board-stn',
    name: isRegionalCorridor
      ? isSoCal
        ? 'Metrolink / Metro Regional Station'
        : 'Caltrain / BART Regional Station'
      : 'California Transit Station',
    shortName: isRegionalCorridor
      ? isSoCal
        ? 'Metro Stn'
        : 'Caltrain / BART Stn'
      : 'Transit Stn',
    coordinates: boardCoord,
    isUnderground: !isRegionalCorridor,
    depthFeet: isRegionalCorridor ? undefined : 44,
    corridor: 'market-subway',
    lines: [lineLabel],
  };

  const midStation: UndergroundStation = {
    id: 'ca-mid-stn',
    name: isRegionalCorridor
      ? isSoCal
        ? 'Union Station / Regional Transfer'
        : 'Millbrae / Peninsula Transit Hub'
      : 'Central Transfer Station',
    shortName: isRegionalCorridor
      ? isSoCal
        ? 'Union Stn Hub'
        : 'Peninsula Hub'
      : 'Transfer Hub',
    coordinates: midCoord,
    isUnderground: !isRegionalCorridor,
    depthFeet: isRegionalCorridor ? undefined : 50,
    corridor: 'market-subway',
    lines: [lineLabel],
  };

  const alightStation: UndergroundStation = {
    id: 'ca-alight-stn',
    name: isRegionalCorridor
      ? isSoCal
        ? 'Destination Metro Terminal'
        : 'Destination Caltrain / BART Terminal'
      : 'Destination Transit Stop',
    shortName: isRegionalCorridor ? 'Dest Terminal' : 'Dest Stop',
    coordinates: alightCoord,
    isUnderground: !isRegionalCorridor,
    depthFeet: isRegionalCorridor ? undefined : 40,
    corridor: 'market-subway',
    lines: [lineLabel],
  };

  return {
    boardStation,
    alightStation,
    intermediateStations: [midStation],
    isUndergroundRide: !isRegionalCorridor,
    lineLabel,
    ridePath: [
      [boardCoord.lat, boardCoord.lng],
      [midCoord.lat, midCoord.lng],
      [alightCoord.lat, alightCoord.lng],
    ],
  };
}

/**
 * Selects the best transit corridor (Market St Underground Subway, Central Subway Underground,
 * or Embarcadero Surface/Portal line) for a given origin/destination pair.
 */
function resolveBestTransitPlan(
  origin: GeoCoordinates,
  destination: GeoCoordinates
): {
  boardStation: UndergroundStation;
  alightStation: UndergroundStation;
  intermediateStations: UndergroundStation[];
  isUndergroundRide: boolean;
  lineLabel: string;
  ridePath: [number, number][];
} {
  const corridors: {
    name: string;
    isUnderground: boolean;
    orderedIds: string[];
  }[] = [
    {
      name: 'Market St Subway (Muni Metro / BART Underground)',
      isUnderground: true,
      orderedIds: [
        'embarcadero-stn',
        'montgomery-stn',
        'powell-stn',
        'civic-center-stn',
        '16th-mission-stn',
      ],
    },
    {
      name: 'Central Subway Tunnel (Muni T-Third Underground)',
      isUnderground: true,
      orderedIds: [
        'chinatown-stn',
        'union-sq-stn',
        'yerba-buena-moscone-stn',
        '4th-brannan-portal',
      ],
    },
    {
      name: 'Embarcadero Light Rail & Subway Portal (Muni N-Judah / F-Line)',
      isUnderground: false,
      orderedIds: [
        'pier-27-stop',
        'ferry-bldg-portal',
        'embarcadero-stn',
        'brannan-embarcadero-stop',
      ],
    },
  ];

  let bestScore = Infinity;
  let bestPlan: {
    boardStation: UndergroundStation;
    alightStation: UndergroundStation;
    intermediateStations: UndergroundStation[];
    isUndergroundRide: boolean;
    lineLabel: string;
    ridePath: [number, number][];
  } | null = null;

  for (const corr of corridors) {
    const stations = corr.orderedIds.map((id) => SF_TRANSIT_STATIONS[id]);
    for (let i = 0; i < stations.length; i++) {
      for (let j = 0; j < stations.length; j++) {
        if (i === j) continue;
        const board = stations[i];
        const alight = stations[j];
        // Penalize long surface walks to/from stations; reward underground speed
        const walkAccessCost =
          (Math.sqrt(distSq(origin, board.coordinates)) +
            Math.sqrt(distSq(destination, alight.coordinates))) *
          1.45;
        const rideCost =
          Math.sqrt(distSq(board.coordinates, alight.coordinates)) *
          (corr.isUnderground ? 0.38 : 0.52);
        const totalScore = walkAccessCost + rideCost;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          const step = i < j ? 1 : -1;
          const slice: UndergroundStation[] = [];
          for (let k = i; k !== j + step; k += step) {
            slice.push(stations[k]);
          }
          const isUndergroundRide =
            corr.isUnderground ||
            (board.isUnderground && alight.isUnderground);

          bestPlan = {
            boardStation: board,
            alightStation: alight,
            intermediateStations: slice.slice(1, -1),
            isUndergroundRide,
            lineLabel: corr.name,
            ridePath: slice.map((s) => [s.coordinates.lat, s.coordinates.lng]),
          };
        }
      }
    }
  }

  return bestPlan!;
}

/**
 * Generates distinct, realistic SF route geometries and sub-segments for each TravelMode:
 * - `transit`: Surface walk -> Underground Subway Station Wait -> Underground Tunnel Ride -> Surface walk
 * - `walking`: Direct pedestrian sidewalks, plazas, and waterfront promenade
 * - `bicycling`: Protected SF bikeways (Market St Bikeway, Embarcadero Cycletrack, Valencia/Folsom lanes)
 * - `driving`: Vehicular one-way arterial street grid (Sutter/Post, 3rd/4th, Harrison/Bryant, Embarcadero)
 */
export function buildModeSpecificRoute(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
  mode: TravelMode,
  totalDurationMinutes: number,
  existingRoute?: RouteOption | null
): EnrichedModeRoute {
  const oPair: [number, number] = [origin.lat, origin.lng];
  const dPair: [number, number] = [destination.lat, destination.lng];
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  const inSf = isWithinSanFrancisco(origin) && isWithinSanFrancisco(destination);
  const span = Math.max(0.008, Math.hypot(dLat, dLng));

  if (mode === 'transit') {
    const plan = inSf
      ? resolveBestTransitPlan(origin, destination)
      : buildGlobalTransitPlan(origin, destination, existingRoute);
    const boardPair: [number, number] = [
      plan.boardStation.coordinates.lat,
      plan.boardStation.coordinates.lng,
    ];
    const alightPair: [number, number] = [
      plan.alightStation.coordinates.lat,
      plan.alightStation.coordinates.lng,
    ];

    const totalMin = Math.max(6, totalDurationMinutes);
    const walkToMin = Math.max(2, Math.round(totalMin * 0.18));
    const waitMin = Math.max(2, Math.round(totalMin * 0.18));
    const walkFromMin = Math.max(2, Math.round(totalMin * 0.15));
    const rideMin = Math.max(2, totalMin - walkToMin - waitMin - walkFromMin);

    const walkToPath: [number, number][] = [oPair, boardPair];
    const walkFromPath: [number, number][] = [alightPair, dPair];
    const fullPathCoordinates: [number, number][] = [
      oPair,
      ...plan.ridePath,
      dPair,
    ];

    const stationSequenceText = [
      plan.boardStation.shortName,
      ...plan.intermediateStations.map((s) => s.shortName),
      plan.alightStation.shortName,
    ].join(' → ');

    const subSegments: ModeRouteSubSegment[] = [
      {
        kind: 'travel_walk',
        travelerMode: 'walking',
        label: `Walk to ${plan.boardStation.name}`,
        durationMinutes: walkToMin,
        pathCoordinates: walkToPath,
        isStationary: false,
        isUnderground: false,
        stationName: plan.boardStation.name,
      },
      {
        kind: 'travel_wait',
        travelerMode: 'waiting',
        label: plan.boardStation.isUnderground
          ? `Descend (${plan.boardStation.depthFeet}ft) & wait at ${plan.boardStation.shortName} underground platform`
          : `Wait at ${plan.boardStation.shortName} platform`,
        durationMinutes: waitMin,
        pathCoordinates: [boardPair],
        isStationary: true,
        isUnderground: plan.boardStation.isUnderground,
        stationName: plan.boardStation.name,
        lineName: plan.lineLabel,
        depthFeet: plan.boardStation.depthFeet,
      },
      {
        kind: 'travel_ride',
        travelerMode: 'transit',
        label: plan.isUndergroundRide
          ? `Underground Subway (${stationSequenceText})`
          : `Surface / Regional Rail (${stationSequenceText})`,
        durationMinutes: rideMin,
        pathCoordinates: plan.ridePath,
        isStationary: false,
        isUnderground: plan.isUndergroundRide,
        lineName: plan.lineLabel,
        depthFeet: plan.boardStation.depthFeet,
      },
      {
        kind: 'travel_walk',
        travelerMode: 'walking',
        label: `Exit ${plan.alightStation.shortName} & walk to venue`,
        durationMinutes: walkFromMin,
        pathCoordinates: walkFromPath,
        isStationary: false,
        isUnderground: false,
        stationName: plan.alightStation.name,
      },
    ];

    return {
      mode: 'transit',
      corridorSummary: `${plan.lineLabel}: ${stationSequenceText}`,
      infrastructureNote: plan.isUndergroundRide
        ? `Uses underground subway tunnel (${plan.boardStation.shortName} → ${plan.alightStation.shortName})`
        : `Uses surface/regional rail (${plan.boardStation.shortName} → ${plan.alightStation.shortName})`,
      usesUndergroundTransit: plan.isUndergroundRide,
      fullPathCoordinates,
      subSegments,
      undergroundStationsUsed: [
        plan.boardStation,
        ...plan.intermediateStations,
        plan.alightStation,
      ],
    };
  }

  if (mode === 'walking') {
    const latNudge1 = inSf ? 0.0007 : span * 0.04;
    const lngNudge1 = inSf ? -0.0005 : -span * 0.03;
    const latNudge2 = inSf ? 0.0004 : span * 0.025;
    const lngNudge2 = inSf ? -0.0003 : -span * 0.02;
    const wp1: [number, number] = [
      Number((origin.lat + dLat * 0.35 + latNudge1).toFixed(5)),
      Number((origin.lng + dLng * 0.32 + lngNudge1).toFixed(5)),
    ];
    const wp2: [number, number] = [
      Number((origin.lat + dLat * 0.72 + latNudge2).toFixed(5)),
      Number((origin.lng + dLng * 0.68 + lngNudge2).toFixed(5)),
    ];
    const path: [number, number][] = [oPair, wp1, wp2, dPair];
    const summary = existingRoute?.summary || 'Pedestrian Sidewalks & Promenade';

    return {
      mode: 'walking',
      corridorSummary: summary,
      infrastructureNote: 'Surface pedestrian sidewalks & plaza shortcuts',
      usesUndergroundTransit: false,
      fullPathCoordinates: path,
      subSegments: [
        {
          kind: 'travel_walk',
          travelerMode: 'walking',
          label: summary,
          durationMinutes: Math.max(1, totalDurationMinutes),
          pathCoordinates: path,
          isStationary: false,
          isUnderground: false,
        },
      ],
      undergroundStationsUsed: [],
    };
  }

  if (mode === 'bicycling') {
    const usesWaterfront =
      inSf && origin.lng > -122.398 && destination.lng > -122.398;
    const pivot1: [number, number] = usesWaterfront
      ? [
          Number((origin.lat + dLat * 0.33).toFixed(5)),
          Number((Math.max(origin.lng, destination.lng) + 0.0022).toFixed(5)),
        ]
      : [
          Number((origin.lat + dLat * 0.28 - (inSf ? 0.0012 : span * 0.06)).toFixed(5)),
          Number((origin.lng + dLng * 0.35 + (inSf ? 0.0009 : span * 0.05)).toFixed(5)),
        ];
    const pivot2: [number, number] = usesWaterfront
      ? [
          Number((origin.lat + dLat * 0.74).toFixed(5)),
          Number((Math.max(origin.lng, destination.lng) + 0.0018).toFixed(5)),
        ]
      : [
          Number((origin.lat + dLat * 0.72 - (inSf ? 0.0006 : span * 0.035)).toFixed(5)),
          Number((origin.lng + dLng * 0.75 + (inSf ? 0.0005 : span * 0.03)).toFixed(5)),
        ];

    const path: [number, number][] = [oPair, pivot1, pivot2, dPair];
    const summary =
      existingRoute?.summary ||
      (usesWaterfront
        ? 'Embarcadero Two-Way Protected Cycletrack'
        : inSf
        ? 'Market St & Folsom Protected Bikeway'
        : 'Protected Urban Cycleway');

    return {
      mode: 'bicycling',
      corridorSummary: summary,
      infrastructureNote: 'Protected Class IV separated bike lanes',
      usesUndergroundTransit: false,
      fullPathCoordinates: path,
      subSegments: [
        {
          kind: 'travel_ride',
          travelerMode: 'bicycling',
          label: summary,
          durationMinutes: Math.max(1, totalDurationMinutes),
          pathCoordinates: path,
          isStationary: false,
          isUnderground: false,
          lineName: summary,
        },
      ],
      undergroundStationsUsed: [],
    };
  }

  // Driving mode: follows orthogonal one-way vehicular street grid
  const swingNorth = inSf
    ? origin.lat >= 37.786 || destination.lat >= 37.792
    : dLat >= 0;
  const offsetLat1 = inSf ? 0.0024 : span * 0.11;
  const offsetLat2 = inSf ? 0.0019 : span * 0.09;
  const corner1: [number, number] = swingNorth
    ? [
        Number((Math.max(origin.lat, destination.lat) + offsetLat1).toFixed(5)),
        Number((origin.lng + dLng * 0.18).toFixed(5)),
      ]
    : [
        Number((Math.min(origin.lat, destination.lat) - offsetLat1).toFixed(5)),
        Number((origin.lng + dLng * 0.25).toFixed(5)),
      ];
  const corner2: [number, number] = swingNorth
    ? [
        Number((Math.max(origin.lat, destination.lat) + offsetLat2).toFixed(5)),
        Number((origin.lng + dLng * 0.82).toFixed(5)),
      ]
    : [
        Number((Math.min(origin.lat, destination.lat) - offsetLat2).toFixed(5)),
        Number((origin.lng + dLng * 0.82).toFixed(5)),
      ];

  const drivePath: [number, number][] = [oPair, corner1, corner2, dPair];
  const driveSummary =
    existingRoute?.summary ||
    (inSf
      ? swingNorth
        ? 'Drive via Sutter St & The Embarcadero Arterial'
        : 'Drive via Harrison St & 4th St One-Way Grid'
      : 'Drive / Ridehail via Primary Urban Arterial');

  return {
    mode: 'driving',
    corridorSummary: driveSummary,
    infrastructureNote: inSf
      ? 'Vehicular arterial corridor (bypasses Market St private-auto transit mall)'
      : 'Primary vehicular arterial corridor',
    usesUndergroundTransit: false,
    fullPathCoordinates: drivePath,
    subSegments: [
      {
        kind: 'travel_ride',
        travelerMode: 'driving',
        label: driveSummary,
        durationMinutes: Math.max(1, totalDurationMinutes),
        pathCoordinates: drivePath,
        isStationary: false,
        isUnderground: false,
        lineName: driveSummary,
      },
    ],
    undergroundStationsUsed: [],
  };
}
