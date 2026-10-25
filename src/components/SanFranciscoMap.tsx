'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  Compass,
  Layers,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  TrainFront,
  X,
} from 'lucide-react';
import {
  CalendarEvent,
  Conflict,
  GeoCoordinates,
  JourneyLeg,
  ResolutionProposal,
  TravelMode,
} from '@/lib/types';
import { formatTimeShort, getEffectiveEndIso } from '@/lib/engine/conflict-engine';
import {
  ConflictDecisionChoice,
  MapViewportBounds,
  PlaybackDecisionPoint,
  PlaybackSampleState,
  PlaybackTimeline,
  SF_DEFAULT_BOUNDS,
  computeViewportBounds,
} from '@/lib/playback/playback-engine';
import {
  ItineraryPlaybackControlsBar,
  ItineraryPlaybackSvgTraveler,
  WalkingPersonIcon,
} from './playback/ItineraryPlaybackOverlay';

export interface MapPlaybackController {
  timeline: PlaybackTimeline;
  sample: PlaybackSampleState;
  isPlaying: boolean;
  playbackSpeed: number;
  conflictDecisions: Record<string, ConflictDecisionChoice>;
  activeDecisionPrompt: PlaybackDecisionPoint | null;
  setPlaybackSpeed: (speed: number) => void;
  handleTogglePlay: () => void;
  handleRestart: () => void;
  handleSeekSeconds: (seconds: number) => void;
  handleChooseConflictDecision: (
    legId: string,
    choice: ConflictDecisionChoice
  ) => void;
}

interface SanFranciscoMapProps {
  events: CalendarEvent[];
  legs: JourneyLeg[];
  conflicts: Conflict[];
  selectedEventId: string | null;
  selectedLegId: string | null;
  inspectorOpen?: boolean;
  previewProposal: ResolutionProposal | null;
  bufferMinutes: number;
  playback?: MapPlaybackController;
  onSelectEvent: (eventId: string) => void;
  onSelectLeg: (legId: string) => void;
  onCloseInspector?: () => void;
  onChangeMode: (legId: string, mode: TravelMode) => void;
  onInvestigateConflict: (conflictId: string) => void;
}

export function projectSfLatLngToSvg(
  coord: GeoCoordinates,
  bounds: MapViewportBounds = SF_DEFAULT_BOUNDS
): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const lngSpan = Math.max(0.0001, maxLng - minLng);
  const latSpan = Math.max(0.0001, maxLat - minLat);

  const normX = (coord.lng - minLng) / lngSpan;
  const normY = 1 - (coord.lat - minLat) / latSpan;

  const x = Math.round(60 + normX * 860);
  const y = Math.round(70 + normY * 760);
  return { x, y };
}

interface WebMercatorTile {
  key: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function lng2tileFloat(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

function lat2tileFloat(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

function tile2lng(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Computes a compact 4x4 grid of Web Mercator street map tiles covering the active
 * California viewportBounds using open Esri World Topo street tiles (no API key or watermark).
 */
function computeSvgMapTiles(bounds: MapViewportBounds): WebMercatorTile[] {
  const lngSpan = Math.max(0.002, bounds.maxLng - bounds.minLng);
  // Target ~3.2 tiles across the viewport width so total tile count stays around 12–16 tiles
  const rawZ = Math.round(Math.log2(360 / lngSpan) + 1.0);
  const z = Math.max(6, Math.min(14, rawZ));

  const padLat = (bounds.maxLat - bounds.minLat) * 0.18;
  const padLng = (bounds.maxLng - bounds.minLng) * 0.18;

  const minTileX = Math.floor(lng2tileFloat(bounds.minLng - padLng, z));
  const maxTileX = Math.floor(lng2tileFloat(bounds.maxLng + padLng, z));
  const minTileY = Math.floor(lat2tileFloat(bounds.maxLat + padLat, z));
  const maxTileY = Math.floor(lat2tileFloat(bounds.minLat - padLat, z));

  const tiles: WebMercatorTile[] = [];
  const maxTilesPerAxis = 4;
  const clampedMaxX = Math.min(maxTileX, minTileX + maxTilesPerAxis);
  const clampedMaxY = Math.min(maxTileY, minTileY + maxTilesPerAxis);
  const n = Math.pow(2, z);

  for (let tx = minTileX; tx <= clampedMaxX; tx++) {
    for (let ty = minTileY; ty <= clampedMaxY; ty++) {
      if (ty < 0 || ty >= n) continue;
      const wrappedX = ((tx % n) + n) % n;
      const nwLat = tile2lat(ty, z);
      const nwLng = tile2lng(tx, z);
      const seLat = tile2lat(ty + 1, z);
      const seLng = tile2lng(tx + 1, z);

      const nwPt = projectSfLatLngToSvg({ lat: nwLat, lng: nwLng }, bounds);
      const sePt = projectSfLatLngToSvg({ lat: seLat, lng: seLng }, bounds);

      tiles.push({
        key: `${z}-${tx}-${ty}`,
        url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${ty}/${wrappedX}`,
        x: nwPt.x,
        y: nwPt.y,
        width: Math.max(1, sePt.x - nwPt.x + 1),
        height: Math.max(1, sePt.y - nwPt.y + 1),
      });
    }
  }

  return tiles;
}

/**
 * Real California Geographic Vector Features (Zero-latency SVG paths — no external raster tiles).
 */
const SF_BAY_WATER_POLYGON: [number, number][] = [
  [38.06, -122.42],
  [37.96, -122.36],
  [37.88, -122.31],
  [37.82, -122.31],
  [37.78, -122.27],
  [37.72, -122.22],
  [37.62, -122.14],
  [37.51, -122.08],
  [37.43, -122.02],
  [37.42, -122.09],
  [37.47, -122.15],
  [37.55, -122.25],
  [37.62, -122.36],
  [37.71, -122.38],
  [37.79, -122.39],
  [37.81, -122.41],
  [37.81, -122.48],
  [37.84, -122.48],
  [37.89, -122.45],
  [37.98, -122.46],
];

const PACIFIC_OCEAN_WEST_POLYGON: [number, number][] = [
  [38.5, -123.5],
  [38.1, -122.95],
  [37.82, -122.52],
  [37.7, -122.5],
  [37.5, -122.5],
  [37.2, -122.42],
  [36.96, -122.05],
  [36.6, -121.92],
  [35.4, -121.1],
  [34.42, -119.85],
  [34.02, -118.51],
  [33.75, -118.42],
  [33.5, -117.8],
  [32.7, -117.26],
  [32.4, -117.2],
  [32.4, -124.8],
  [38.5, -124.8],
];

const CALIFORNIA_HIGHWAYS: {
  id: string;
  label: string;
  isRail?: boolean;
  coords: [number, number][];
}[] = [
  {
    id: 'us-101-peninsula',
    label: 'US-101',
    coords: [
      [38.05, -122.53],
      [37.85, -122.48],
      [37.8, -122.45],
      [37.77, -122.41],
      [37.66, -122.4],
      [37.58, -122.35],
      [37.49, -122.23],
      [37.44, -122.14],
      [37.4, -122.06],
      [37.37, -121.98],
      [37.33, -121.88],
      [37.0, -121.56],
    ],
  },
  {
    id: 'i-280-peninsula',
    label: 'I-280',
    coords: [
      [37.77, -122.4],
      [37.71, -122.45],
      [37.62, -122.43],
      [37.53, -122.35],
      [37.43, -122.23],
      [37.36, -122.12],
      [37.32, -122.01],
      [37.32, -121.91],
    ],
  },
  {
    id: 'caltrain-corridor',
    label: 'CALTRAIN',
    isRail: true,
    coords: [
      [37.7764, -122.3943],
      [37.6547, -122.405],
      [37.5985, -122.386],
      [37.563, -122.324],
      [37.4852, -122.232],
      [37.4443, -122.1615],
      [37.394, -122.076],
      [37.3688, -122.03],
      [37.3297, -121.9026],
    ],
  },
  {
    id: 'i-80-i-880-eastbay',
    label: 'I-80 / I-880',
    coords: [
      [37.785, -122.395],
      [37.815, -122.33],
      [37.83, -122.29],
      [37.87, -122.3],
      [37.95, -122.33],
      [38.25, -122.05],
      [38.58, -121.5],
    ],
  },
  {
    id: 'i-880-south',
    label: 'I-880',
    coords: [
      [37.82, -122.29],
      [37.75, -122.21],
      [37.65, -122.1],
      [37.53, -121.98],
      [37.36, -121.9],
    ],
  },
  {
    id: 'ca-92-84-bridges',
    label: 'CA-92 / CA-84',
    coords: [
      [37.55, -122.31],
      [37.62, -122.12],
      [37.46, -122.15],
      [37.53, -122.02],
    ],
  },
  {
    id: 'socal-i405-i10-i5',
    label: 'I-405 / I-10 / I-5',
    coords: [
      [34.25, -118.47],
      [34.06, -118.44],
      [34.02, -118.49],
      [34.04, -118.25],
      [34.15, -118.14],
      [33.85, -117.92],
      [33.68, -117.82],
      [33.2, -117.38],
      [32.88, -117.23],
      [32.715, -117.16],
    ],
  },
];

const CALIFORNIA_MAP_LABELS: {
  name: string;
  lat: number;
  lng: number;
  isMajor?: boolean;
}[] = [
  { name: 'SAN FRANCISCO', lat: 37.7879, lng: -122.4075, isMajor: true },
  { name: 'SOUTH SF · SFO', lat: 37.638, lng: -122.392 },
  { name: 'SAN MATEO', lat: 37.563, lng: -122.3255 },
  { name: 'REDWOOD CITY', lat: 37.4852, lng: -122.2364 },
  { name: 'MENLO PARK', lat: 37.4529, lng: -122.1817 },
  { name: 'PALO ALTO · STANFORD', lat: 37.435, lng: -122.156, isMajor: true },
  { name: 'MOUNTAIN VIEW', lat: 37.405, lng: -122.084, isMajor: true },
  { name: 'SUNNYVALE', lat: 37.3688, lng: -122.0363 },
  { name: 'CUPERTINO', lat: 37.328, lng: -122.02 },
  { name: 'SANTA CLARA', lat: 37.365, lng: -121.965 },
  { name: 'SAN JOSE', lat: 37.335, lng: -121.89, isMajor: true },
  { name: 'OAKLAND', lat: 37.8044, lng: -122.2712, isMajor: true },
  { name: 'BERKELEY', lat: 37.8715, lng: -122.273, isMajor: true },
  { name: 'FREMONT', lat: 37.5485, lng: -121.9886 },
  { name: 'SAUSALITO · MARIN', lat: 37.865, lng: -122.49 },
  { name: 'NAPA VALLEY', lat: 38.2975, lng: -122.2869 },
  { name: 'SACRAMENTO', lat: 38.5816, lng: -121.4944, isMajor: true },
  { name: 'SANTA CRUZ', lat: 36.9741, lng: -122.0308 },
  { name: 'MONTEREY', lat: 36.6002, lng: -121.8947 },
  { name: 'SANTA BARBARA', lat: 34.4208, lng: -119.6982 },
  { name: 'SANTA MONICA', lat: 34.0195, lng: -118.4912, isMajor: true },
  { name: 'VENICE · SILICON BEACH', lat: 33.991, lng: -118.4695 },
  { name: 'CULVER CITY', lat: 34.0242, lng: -118.3965 },
  { name: 'BEVERLY HILLS', lat: 34.0736, lng: -118.4004 },
  { name: 'HOLLYWOOD', lat: 34.098, lng: -118.3287 },
  { name: 'DOWNTOWN LOS ANGELES', lat: 34.0522, lng: -118.2437, isMajor: true },
  { name: 'PASADENA', lat: 34.1478, lng: -118.1445 },
  { name: 'IRVINE · OC', lat: 33.6846, lng: -117.8265, isMajor: true },
  { name: 'LA JOLLA · UCSD', lat: 32.8801, lng: -117.234 },
  { name: 'SAN DIEGO', lat: 32.7157, lng: -117.1611, isMajor: true },
];

const MODE_META: {
  mode: TravelMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: 'transit', label: 'Transit', Icon: TrainFront },
  { mode: 'walking', label: 'Walk', Icon: WalkingPersonIcon },
  { mode: 'driving', label: 'Drive', Icon: Car },
  { mode: 'bicycling', label: 'Bike', Icon: Bike },
];

interface StaticMapSceneProps {
  viewportBounds: MapViewportBounds;
  showSatelliteGrid: boolean;
  events: CalendarEvent[];
  legs: JourneyLeg[];
  conflicts: Conflict[];
  activeLeg: JourneyLeg | null;
  selectedEventId: string | null;
  previewProposal: ResolutionProposal | null;
  homeOrigin: {
    address: string;
    neighborhood: string;
    coordinates: GeoCoordinates;
  } | null;
  homeLeg: JourneyLeg | null;
  homeReturnLeg: JourneyLeg | null;
  onSelectEvent: (eventId: string) => void;
  onSelectLeg: (legId: string) => void;
}

/**
 * Memoized static SVG scene so 60fps 2D playback only updates the traveler orb
 * and never re-renders the geography, corridors, or pins.
 */
const StaticMapScene = React.memo(function StaticMapScene({
  viewportBounds,
  showSatelliteGrid,
  events,
  legs,
  conflicts,
  activeLeg,
  selectedEventId,
  previewProposal,
  homeOrigin,
  homeLeg,
  homeReturnLeg,
  onSelectEvent,
  onSelectLeg,
}: StaticMapSceneProps) {
  const buildPolylinePath = useCallback(
    (coords?: [number, number][]) => {
      if (!coords || coords.length === 0) return '';
      const pts = coords.map(([lat, lng]) =>
        projectSfLatLngToSvg({ lat, lng }, viewportBounds)
      );
      return pts
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
    },
    [viewportBounds]
  );

  const buildPolygonPath = useCallback(
    (coords: [number, number][]) => {
      if (coords.length === 0) return '';
      const pts = coords.map(([lat, lng]) =>
        projectSfLatLngToSvg({ lat, lng }, viewportBounds)
      );
      return (
        pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
        ' Z'
      );
    },
    [viewportBounds]
  );

  const visibleCaliforniaLabels = useMemo(() => {
    if (viewportBounds.isSanFrancisco) return [];
    const padLat = (viewportBounds.maxLat - viewportBounds.minLat) * 0.25;
    const padLng = (viewportBounds.maxLng - viewportBounds.minLng) * 0.25;
    return CALIFORNIA_MAP_LABELS.filter(
      (item) =>
        item.lat >= viewportBounds.minLat - padLat &&
        item.lat <= viewportBounds.maxLat + padLat &&
        item.lng >= viewportBounds.minLng - padLng &&
        item.lng <= viewportBounds.maxLng + padLng
    ).map((item) => ({
      ...item,
      pt: projectSfLatLngToSvg({ lat: item.lat, lng: item.lng }, viewportBounds),
    }));
  }, [viewportBounds]);

  const streetTiles = useMemo(
    () => (showSatelliteGrid ? computeSvgMapTiles(viewportBounds) : []),
    [showSatelliteGrid, viewportBounds]
  );

  const physicalEventsWithCoords = useMemo(
    () => events.filter((e) => !e.isVirtual && e.coordinates),
    [events]
  );

  const homePinPoint = useMemo(
    () =>
      homeOrigin?.coordinates
        ? projectSfLatLngToSvg(homeOrigin.coordinates, viewportBounds)
        : null,
    [homeOrigin, viewportBounds]
  );

  return (
    <>
      {/* Base Landmass */}
      <rect
        x="-400"
        y="-400"
        width="1900"
        height="1700"
        fill={showSatelliteGrid ? '#dde6e0' : '#e8eeea'}
      />

      {!viewportBounds.isSanFrancisco ? (
        /* Fast, Zero-Latency Pure Vector California Regional Map */
        <g>
          {/* Regional Urban Blocks & Open Space */}
          <g fill={showSatelliteGrid ? '#d2dfd6' : '#dfe9e2'}>
            <rect x="40" y="50" width="940" height="800" rx="24" />
          </g>

          {/* California Coastline & SF Bay Water Contours */}
          <g fill="#cddfe6">
            <path d={buildPolygonPath(PACIFIC_OCEAN_WEST_POLYGON)} />
            <path d={buildPolygonPath(SF_BAY_WATER_POLYGON)} />
          </g>

          {/* Subtle Regional Coordinate Graticule */}
          <g stroke="#d5e0da" strokeWidth="1.2" fill="none" opacity="0.75">
            {[140, 260, 380, 500, 620, 740, 860].map((gx) => (
              <line key={`gx-${gx}`} x1={gx} y1="-200" x2={gx} y2="1100" />
            ))}
            {[130, 250, 370, 490, 610, 730, 850].map((gy) => (
              <line key={`gy-${gy}`} x1="-200" y1={gy} x2="1250" y2={gy} />
            ))}
          </g>

          {/* California Freeway & Rail Network (US-101, I-280, Caltrain, I-80, I-880, I-405/I-5) */}
          {CALIFORNIA_HIGHWAYS.map((hwy) => {
            const d = buildPolylinePath(hwy.coords);
            if (!d) return null;
            return (
              <g key={hwy.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={hwy.isRail ? 7 : 13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={hwy.isRail ? '#94a3b8' : '#cbd5e1'}
                  strokeWidth={hwy.isRail ? 2.5 : 2}
                  strokeDasharray={hwy.isRail ? '6 5' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Dynamic California City & Hub Labels */}
          <g
            fontFamily="Inter, system-ui, sans-serif"
            fill="#64748b"
            letterSpacing="1.4"
          >
            {visibleCaliforniaLabels.map((lbl) => (
              <g key={lbl.name} transform={`translate(${lbl.pt.x}, ${lbl.pt.y})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={lbl.isMajor ? 3.5 : 2.5}
                  fill="#94a3b8"
                  opacity="0.7"
                />
                <text
                  x="7"
                  y="4"
                  fontSize={lbl.isMajor ? '11.5' : '10'}
                  fontWeight={lbl.isMajor ? '800' : '600'}
                  fill={lbl.isMajor ? '#475569' : '#64748b'}
                >
                  {lbl.name}
                </text>
              </g>
            ))}
          </g>
        </g>
      ) : (
        /* Calibrated Downtown San Francisco Vector Illustration */
        <>
          {/* Urban Blocks & Parks */}
          <g fill={showSatelliteGrid ? '#cfdcd3' : '#dce6de'}>
            <rect x="760" y="-100" width="350" height="1100" />
            <rect x="-100" y="690" width="1200" height="300" />
          </g>

          {/* San Francisco Bay Water Contour */}
          <g fill="#cddfe6">
            <path d="M 670 -100 L 1250 -100 L 1250 1050 L 940 1050 Q 875 760 830 560 Q 785 380 735 210 Z" />
            <rect
              x="752"
              y="130"
              width="44"
              height="14"
              rx="3"
              transform="rotate(-18 752 130)"
            />
            <rect
              x="775"
              y="210"
              width="48"
              height="16"
              rx="3"
              transform="rotate(-18 775 210)"
            />
            <rect
              x="795"
              y="295"
              width="58"
              height="22"
              rx="4"
              transform="rotate(-15 795 295)"
            />
            <rect
              x="815"
              y="385"
              width="44"
              height="15"
              rx="3"
              transform="rotate(-15 815 385)"
            />
            <rect
              x="835"
              y="470"
              width="46"
              height="15"
              rx="3"
              transform="rotate(-15 835 470)"
            />
          </g>

          {/* City Parks */}
          <g fill="#cfe0d0">
            <rect x="330" y="305" width="95" height="75" rx="14" />
            <rect x="470" y="425" width="120" height="82" rx="14" />
            <rect x="160" y="465" width="110" height="85" rx="14" />
            <rect x="110" y="665" width="160" height="75" rx="16" />
          </g>

          {/* Secondary SF Street Grid */}
          <g stroke="#ffffff" strokeWidth="14" fill="none" opacity="0.88">
            <path d="M -100 140 L 760 140" />
            <path d="M -100 230 L 790 230" />
            <path d="M -100 320 L 700 320" />
            <path d="M -100 410 L 600 410" />
            <path d="M 150 -100 L 150 620" />
            <path d="M 270 -100 L 270 520" />
            <path d="M 390 -100 L 390 430" />
            <path d="M 510 -100 L 510 340" />
            <path d="M 630 -100 L 630 260" />
            <path d="M 260 530 L 890 880" />
            <path d="M 380 430 L 940 750" />
            <path d="M 510 340 L 960 600" />
            <path d="M 640 250 L 960 440" />
            <path d="M 840 310 L 310 880" />
            <path d="M 790 480 L 420 890" />
            <path d="M 730 240 L 180 830" />
          </g>

          {/* Primary Arterials: Market Street & The Embarcadero */}
          <g stroke="#ffffff" strokeWidth="26" fill="none" strokeLinecap="round">
            <path d="M 785 295 L 110 775" />
            <path d="M 665 -60 Q 755 180 795 310 Q 845 500 895 790" />
          </g>
          <g stroke="#d2ded6" strokeWidth="2.5" fill="none">
            <path d="M 785 295 L 110 775" strokeDasharray="8 6" />
            <path d="M 665 -60 Q 755 180 795 310 Q 845 500 895 790" />
          </g>

          {/* Neighborhood Labels */}
          <g
            fontFamily="Inter, system-ui, sans-serif"
            fill="#7b8d83"
            fontSize="12"
            fontWeight="700"
            letterSpacing="1.6"
          >
            <text x="315" y="292">
              UNION SQUARE
            </text>
            <text x="530" y="195">
              FINANCIAL DISTRICT
            </text>
            <text x="690" y="425">
              EMBARCADERO
            </text>
            <text x="545" y="595">
              SOMA
            </text>
            <text x="155" y="452">
              CIVIC CENTER
            </text>
            <text x="120" y="758">
              MISSION DISTRICT
            </text>
            <text x="885" y="490" fill="#6b8ba4">
              SAN FRANCISCO BAY
            </text>
          </g>
        </>
      )}

      {/* Real Street Map Tile Layer (Carto Voyager) — rendered over the instant vector base when Real Map mode is active */}
      {showSatelliteGrid && streetTiles.length > 0 && (
        <g opacity="0.96">
          {streetTiles.map((tile) => (
            <image
              key={tile.key}
              href={tile.url}
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              preserveAspectRatio="none"
            />
          ))}
        </g>
      )}

      {/* Home Origin & Return Route Connectors */}
      {homeLeg?.selectedRoute?.coordinates && (
        <g
          onClick={() => onSelectLeg(homeLeg.id)}
          className="cursor-pointer opacity-70 hover:opacity-95 transition-opacity"
        >
          <path
            d={buildPolylinePath(homeLeg.selectedRoute.coordinates)}
            fill="none"
            stroke="#ffffff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={buildPolylinePath(homeLeg.selectedRoute.coordinates)}
            fill="none"
            stroke="#475569"
            strokeWidth="3.5"
            strokeDasharray="5 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {homeReturnLeg?.selectedRoute?.coordinates && (
        <g
          onClick={() => onSelectLeg(homeReturnLeg.id)}
          className="cursor-pointer opacity-70 hover:opacity-95 transition-opacity"
        >
          <path
            d={buildPolylinePath(homeReturnLeg.selectedRoute.coordinates)}
            fill="none"
            stroke="#ffffff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={buildPolylinePath(homeReturnLeg.selectedRoute.coordinates)}
            fill="none"
            stroke="#475569"
            strokeWidth="3.5"
            strokeDasharray="5 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Inactive Journey Legs */}
      {legs.map((leg) => {
        if (leg.id === activeLeg?.id || !leg.selectedRoute) return null;
        const d = buildPolylinePath(leg.selectedRoute.coordinates);
        if (!d) return null;
        return (
          <g
            key={leg.id}
            onClick={() => onSelectLeg(leg.id)}
            className="cursor-pointer opacity-55 hover:opacity-85 transition-opacity"
          >
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={d}
              fill="none"
              stroke={leg.status === 'feasible' ? '#64748b' : '#e11d48'}
              strokeWidth="4.5"
              strokeDasharray="7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Active Selected Journey Route Polyline */}
      {activeLeg && activeLeg.selectedRoute && (
        <g>
          <path
            d={buildPolylinePath(activeLeg.selectedRoute.coordinates)}
            fill="none"
            stroke="#ffffff"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={buildPolylinePath(activeLeg.selectedRoute.coordinates)}
            fill="none"
            stroke={
              previewProposal && previewProposal.verification.resolvesTargetConflict
                ? '#059669' // Semantic Emerald
                : activeLeg.status === 'impossible'
                ? '#e11d48' // Semantic Coral
                : activeLeg.status === 'tight_buffer'
                ? '#d97706' // Semantic Amber
                : '#4f46e5' // Brand Indigo
            }
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Home Origin Map Pin */}
      {homePinPoint && homeOrigin && (
        <g>
          <circle
            cx={homePinPoint.x}
            cy={homePinPoint.y + 2}
            r="12"
            fill="#0f172a"
            opacity="0.16"
          />
          <circle
            cx={homePinPoint.x}
            cy={homePinPoint.y}
            r="11.5"
            fill="#ffffff"
            stroke="#334155"
            strokeWidth="4"
          />
          <text
            x={homePinPoint.x}
            y={homePinPoint.y + 3.5}
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="9.5"
            fontWeight="800"
            fill="#0f172a"
          >
            H
          </text>
        </g>
      )}

      {/* Event Map Pins & Callout Pills */}
      {physicalEventsWithCoords.map((evt, index) => {
        const pt = projectSfLatLngToSvg(evt.coordinates!, viewportBounds);
        const isSelected =
          evt.id === selectedEventId ||
          evt.id === activeLeg?.fromEventId ||
          evt.id === activeLeg?.toEventId;
        const isDestination = evt.id === activeLeg?.toEventId;
        const hasConflict = conflicts.some((c) => c.eventIds.includes(evt.id));

        const strokeColor = hasConflict
          ? '#e11d48'
          : isSelected
          ? '#4f46e5'
          : '#475569';

        const labelText = evt.neighborhood || evt.title;
        const boxWidth = Math.max(122, labelText.length * 7.8 + 32);

        return (
          <g
            key={evt.id}
            data-interactive-pin="true"
            onClick={(e) => {
              e.stopPropagation();
              onSelectEvent(evt.id);
            }}
            className="cursor-pointer group"
          >
            {isSelected && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r="24"
                fill={hasConflict ? '#e11d48' : '#4f46e5'}
                opacity="0.16"
              />
            )}

            {/* Lightweight vector shadow (replaces expensive SVG feDropShadow filter) */}
            <circle
              cx={pt.x}
              cy={pt.y + 3}
              r={isSelected ? 15.5 : 13}
              fill="#0f172a"
              opacity="0.18"
            />

            <circle
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 15 : 12.5}
              fill={isDestination ? strokeColor : '#ffffff'}
              stroke={isDestination ? '#ffffff' : strokeColor}
              strokeWidth={isDestination ? 4.5 : 5.5}
            />

            <text
              x={pt.x}
              y={pt.y + 4}
              textAnchor="middle"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="11"
              fontWeight="800"
              fill={isDestination ? '#ffffff' : '#0f172a'}
            >
              {index + 1}
            </text>

            <g transform={`translate(${pt.x - boxWidth / 2}, ${pt.y - 44})`}>
              <rect
                y="2"
                width={boxWidth}
                height="26"
                rx="8"
                fill="#0f172a"
                opacity="0.12"
              />
              <rect
                width={boxWidth}
                height="26"
                rx="8"
                fill={isSelected ? '#0f172a' : '#ffffff'}
                stroke={isSelected ? '#0f172a' : '#e2e8f0'}
                strokeWidth="1.5"
              />
              <text
                x={boxWidth / 2}
                y="17"
                textAnchor="middle"
                fontFamily="Inter, system-ui, sans-serif"
                fontSize="11.5"
                fontWeight="700"
                fill={isSelected ? '#ffffff' : '#0f172a'}
              >
                {index + 1}. {labelText}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
});

export function SanFranciscoMap({
  events,
  legs,
  conflicts,
  selectedEventId,
  selectedLegId,
  inspectorOpen = false,
  previewProposal,
  bufferMinutes,
  playback,
  onSelectEvent,
  onSelectLeg,
  onCloseInspector,
  onChangeMode,
  onInvestigateConflict,
}: SanFranciscoMapProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Default to false so the Vector Map (mock map) is shown out-of-the-box (can toggle between Real Map & Vector Map)
  const [showSatelliteGrid, setShowSatelliteGrid] = useState(false);

  // Direct DOM ref for 60fps zero-lag panning without React re-renders per mouse pixel
  const panGroupRef = useRef<SVGGElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    currentPanX: number;
    currentPanY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    currentPanX: 0,
    currentPanY: 0,
  });

  useEffect(() => {
    dragStateRef.current.currentPanX = pan.x;
    dragStateRef.current.currentPanY = pan.y;
    if (panGroupRef.current) {
      panGroupRef.current.setAttribute(
        'transform',
        `translate(${pan.x}, ${pan.y}) scale(${zoom})`
      );
    }
  }, [pan.x, pan.y, zoom]);

  const activeLeg =
    (selectedLegId === 'leg-home-origin' && playback?.timeline.homeLeg
      ? playback.timeline.homeLeg
      : selectedLegId === 'leg-home-return' && playback?.timeline.homeReturnLeg
      ? playback.timeline.homeReturnLeg
      : null) ||
    (selectedLegId ? legs.find((l) => l.id === selectedLegId) : null) ||
    (selectedEventId
      ? legs.find(
          (l) => l.fromEventId === selectedEventId || l.toEventId === selectedEventId
        ) ||
        (selectedEventId === 'evt-home-origin' ? playback?.timeline.homeLeg : null) ||
        (selectedEventId === 'evt-home-return' ? playback?.timeline.homeReturnLeg : null)
      : null) ||
    null;

  const activeConflict = activeLeg
    ? conflicts.find(
        (c) =>
          c.legId === activeLeg.id ||
          (c.eventIds.includes(activeLeg.fromEventId) &&
            c.eventIds.includes(activeLeg.toEventId))
      )
    : undefined;

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('[data-interactive-pin="true"]')) return;
    dragStateRef.current.active = true;
    dragStateRef.current.startX = e.clientX - dragStateRef.current.currentPanX;
    dragStateRef.current.startY = e.clientY - dragStateRef.current.currentPanY;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStateRef.current.active) return;
    const nextX = Math.max(
      -350,
      Math.min(350, e.clientX - dragStateRef.current.startX)
    );
    const nextY = Math.max(
      -300,
      Math.min(300, e.clientY - dragStateRef.current.startY)
    );
    dragStateRef.current.currentPanX = nextX;
    dragStateRef.current.currentPanY = nextY;
    if (panGroupRef.current) {
      panGroupRef.current.setAttribute(
        'transform',
        `translate(${nextX}, ${nextY}) scale(${zoom})`
      );
    }
  };

  const handleMouseUp = () => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDragging(false);
    setPan({
      x: dragStateRef.current.currentPanX,
      y: dragStateRef.current.currentPanY,
    });
  };

  const handleResetView = () => {
    dragStateRef.current.currentPanX = 0;
    dragStateRef.current.currentPanY = 0;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const viewportBounds = useMemo<MapViewportBounds>(() => {
    if (playback?.timeline?.viewportBounds) {
      return playback.timeline.viewportBounds;
    }
    return computeViewportBounds(events, legs);
  }, [playback?.timeline?.viewportBounds, events, legs]);

  const homeOrigin = playback?.timeline?.homeOrigin || null;
  const homeLeg = playback?.timeline?.homeLeg || null;
  const homeReturnLeg = playback?.timeline?.homeReturnLeg || null;

  return (
    <main className="relative flex-1 h-full overflow-hidden bg-[#e8eeea] select-none">
      {/* Interactive SVG Map Canvas */}
      <svg
        viewBox="0 0 1055 900"
        preserveAspectRatio="xMidYMid slice"
        className={`w-full h-full ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g
          ref={panGroupRef}
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={{ transformOrigin: '527px 450px' }}
        >
          <StaticMapScene
            viewportBounds={viewportBounds}
            showSatelliteGrid={showSatelliteGrid}
            events={events}
            legs={legs}
            conflicts={conflicts}
            activeLeg={activeLeg}
            selectedEventId={selectedEventId}
            previewProposal={previewProposal}
            homeOrigin={homeOrigin}
            homeLeg={homeLeg}
            homeReturnLeg={homeReturnLeg}
            onSelectEvent={onSelectEvent}
            onSelectLeg={onSelectLeg}
          />

          {/* Animated 2D Itinerary Playback Traveler */}
          {playback && (
            <ItineraryPlaybackSvgTraveler
              timeline={playback.timeline}
              sample={playback.sample}
              isPlaying={playback.isPlaying}
              bounds={viewportBounds}
            />
          )}
        </g>
      </svg>

      {/* Top-Left California Region Indicator & Real/Vector Map Switcher Pill */}
      <div className=" absolute top-5 left-5 z-10 flex items-center gap-2 rounded-xl bg-white/95 backdrop-blur-md px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_4px_20px_rgba(15,23,42,0.10)] border border-slate-200/80">
        <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
        <span>{viewportBounds.regionLabel}</span>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setShowSatelliteGrid((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700 transition-colors cursor-pointer"
          title="Switch between Real Street Map and Vector Illustration"
        >
          <Layers className="h-3 w-3" />
          <span>{showSatelliteGrid ? 'Real Street Map' : 'Vector Map'}</span>
        </button>
      </div>

      {/* Top-Right Compact Map Controls */}
      <div className="absolute top-5 right-5 z-10 flex flex-col gap-1 rounded-2xl bg-white/95 backdrop-blur-md p-1.5 shadow-[0_4px_20px_rgba(15,23,42,0.12)] border border-slate-200/80">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.65, Number((z + 0.18).toFixed(2))))}
          title="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.18).toFixed(2))))}
          title="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Recenter map"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Compass className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowSatelliteGrid((v) => !v)}
          title="Toggle map contrast layer"
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer ${
            showSatelliteGrid
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* UNIFIED BOTTOM-RIGHT JOURNEY INSPECTOR CARD (Only shown when user clicks an event/leg in left navbar, and closable) */}
      {inspectorOpen && activeLeg && (
        <div className="absolute right-6 bottom-6 z-10 w-[365px] rounded-2xl bg-white/98 backdrop-blur-md p-5 shadow-[0_14px_40px_rgba(15,23,42,0.16)] border border-slate-200/80">
          {/* Top Status, Window & Close Button Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {activeLeg.status === 'impossible' ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200/80">
                  <AlertTriangle className="h-3 w-3" />
                  {activeLeg.availableWindowMinutes < 0
                    ? `${Math.abs(activeLeg.availableWindowMinutes)}m Overlap`
                    : 'Travel Conflict'}
                </span>
              ) : activeLeg.status === 'tight_buffer' ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                  <AlertTriangle className="h-3 w-3" />
                  Tight Buffer
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
                  <CheckCircle2 className="h-3 w-3" />
                  On Schedule
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">
                {activeLeg.availableWindowMinutes >= 0
                  ? `${activeLeg.availableWindowMinutes}m window`
                  : `Overlaps by ${Math.abs(activeLeg.availableWindowMinutes)}m`}
              </span>
              {onCloseInspector && (
                <button
                  type="button"
                  onClick={onCloseInspector}
                  title="Close journey details"
                  aria-label="Close journey details"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Leg Corridor Title & Event Times */}
          <h3 className="mt-2 text-[17px] font-bold text-slate-900 tracking-tight leading-snug">
            {activeLeg.fromEvent.neighborhood || activeLeg.fromEvent.title} →{' '}
            {activeLeg.toEvent.neighborhood || activeLeg.toEvent.title}
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {activeLeg.fromEvent.title} (ends{' '}
            {formatTimeShort(getEffectiveEndIso(activeLeg.fromEvent))}) →{' '}
            {activeLeg.toEvent.title} (starts {formatTimeShort(activeLeg.toEvent.start)})
          </p>

          {/* Live Hover/Focus Proposal Preview Banner */}
          {previewProposal && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[12px] text-emerald-950">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Preview: {previewProposal.title}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-700">
                {previewProposal.verification.verificationSummary}
              </div>
            </div>
          )}

          {/* 4 Travel Mode Switcher Pills */}
          <div className="mt-3.5 grid grid-cols-4 gap-1.5">
            {MODE_META.map(({ mode, label, Icon }) => {
              const opt = activeLeg.alternatives.find((a) => a.mode === mode);
              const isSelected = activeLeg.selectedMode === mode;
              const fitsWindow =
                opt && activeLeg.availableWindowMinutes >= opt.durationMinutes;

              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!opt}
                  onClick={() => onChangeMode(activeLeg.id, mode)}
                  className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-[12px] font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  } ${!opt ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </div>
                  {opt && (
                    <span
                      className={`mt-0.5 text-[11px] font-semibold ${
                        isSelected
                          ? 'text-indigo-100'
                          : fitsWindow
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {opt.durationMinutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Route Summary & Leave-By Calculation */}
          {activeLeg.selectedRoute ? (
            <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 text-[13px]">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-slate-800 truncate">
                    {activeLeg.selectedRoute.summary}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeLeg.selectedRoute.distanceKm} km · ±
                    {activeLeg.selectedRoute.uncertaintyMinutes || 2}m variance
                  </div>
                </div>
                <span className="shrink-0 font-bold text-slate-900">
                  {activeLeg.selectedRoute.durationMinutes} min
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-[12px] text-slate-600">
                  Leave by (with {bufferMinutes}m buffer)
                </span>
                <strong
                  className={`text-[14px] font-bold ${
                    activeLeg.status === 'feasible'
                      ? 'text-emerald-700'
                      : 'text-rose-600'
                  }`}
                >
                  {activeLeg.recommendedLeaveIso
                    ? formatTimeShort(activeLeg.recommendedLeaveIso)
                    : 'N/A'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-900 border border-amber-200/70">
              Destination address is missing. Investigate event details to resolve venue.
            </div>
          )}

          {/* Primary Action Button */}
          {activeConflict && (
            <button
              type="button"
              onClick={() => onInvestigateConflict(activeConflict.id)}
              className="mt-3.5 w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 px-4 text-[13px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Investigate &amp; resolve with R &amp; Go</span>
            </button>
          )}
        </div>
      )}

      {/* Bottom-Left Streamlined 2D Playback Bar */}
      {playback && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-20 right-[400px] flex justify-start">
          <ItineraryPlaybackControlsBar
            timeline={playback.timeline}
            sample={playback.sample}
            isPlaying={playback.isPlaying}
            playbackSpeed={playback.playbackSpeed}
            conflictDecisions={playback.conflictDecisions}
            activeDecisionPrompt={playback.activeDecisionPrompt}
            onTogglePlay={playback.handleTogglePlay}
            onRestart={playback.handleRestart}
            onSeekSeconds={playback.handleSeekSeconds}
            onChangeSpeed={playback.setPlaybackSpeed}
            onChooseConflictDecision={playback.handleChooseConflictDecision}
          />
        </div>
      )}
    </main>
  );
}
