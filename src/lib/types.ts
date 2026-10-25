export type TravelMode = 'transit' | 'walking' | 'driving' | 'bicycling';

export type Optionality = 'required' | 'optional' | 'unknown';

export interface EventPhase {
  label: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  optionality: Optionality;
  evidenceUrl?: string;
  excerpt?: string;
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  effectiveEnd?: string; // If user approves leaving after required phase
  timezone?: string;
  location?: string;
  neighborhood?: string;
  coordinates?: GeoCoordinates;
  eventUrl?: string;
  organizer?: string;
  description?: string;
  isVirtual?: boolean;
  phases?: EventPhase[];
  appliedResolutionId?: string;
}

export interface RouteStep {
  instruction: string;
  durationMinutes: number;
  mode: string;
  lineName?: string;
}

export interface RouteOption {
  id: string;
  mode: TravelMode;
  summary: string; // e.g., "Muni Metro N-Judah + walk", "Market St Bikeway"
  durationMinutes: number;
  distanceKm: number;
  startEventId: string;
  endEventId: string;
  provider: 'google-routes-live' | 'sf-deterministic-matrix' | 'global-route-matrix';
  lastCheckedAt: string;
  uncertaintyMinutes?: number;
  trafficNote?: string;
  steps?: RouteStep[];
  coordinates: [number, number][]; // [lat, lng] polyline points
}

export interface JourneyLeg {
  id: string;
  fromEventId: string;
  toEventId: string;
  fromEvent: CalendarEvent;
  toEvent: CalendarEvent;
  selectedMode: TravelMode;
  selectedRoute: RouteOption | null;
  alternatives: RouteOption[];
  availableWindowMinutes: number;
  bufferMinutes: number;
  recommendedLeaveIso: string | null;
  arrivalEstimateIso: string | null;
  slackMinutes: number | null; // positive = spare time after buffer, negative = minutes short
  status: 'feasible' | 'tight_buffer' | 'impossible' | 'missing_location' | 'virtual_skipped';
}

export type ConflictType =
  | 'overlap'
  | 'travel_impossible'
  | 'tight_buffer'
  | 'missing_location'
  | 'uncertain_schedule';

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export type ConflictStatus = 'new' | 'investigating' | 'ready' | 'resolved' | 'dismissed';

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  summary: string;
  eventIds: string[];
  legId?: string;
  availableMinutes?: number;
  requiredMinutes?: number;
  bufferMinutes?: number;
  shortfallMinutes?: number;
  status: ConflictStatus;
  investigationHypothesis?: string;
}

export interface EvidenceSource {
  url: string;
  title: string;
  organizer?: string;
  publishedAt?: string;
  retrievedAt: string;
  isOfficialSource: boolean;
  excerpt: string;
}

export interface ResolutionProposal {
  id: string;
  conflictId: string;
  title: string;
  description: string;
  actionType:
    | 'leave_optional_phase'
    | 'switch_travel_mode'
    | 'set_discovered_location'
    | 'shift_event_time'
    | 'dismiss_conflict';
  targetEventId: string;
  proposedChanges: {
    effectiveEnd?: string;
    newStart?: string;
    newEnd?: string;
    newLocation?: string;
    newNeighborhood?: string;
    newCoordinates?: GeoCoordinates;
    preferredMode?: TravelMode;
    phases?: EventPhase[];
  };
  verification: {
    verifiedByEngine: boolean;
    resolvesTargetConflict: boolean;
    remainingConflictsCount: number;
    newAvailableMinutes?: number;
    newRequiredMinutes?: number;
    newSlackMinutes?: number;
    newRecommendedLeaveIso?: string;
    verificationSummary: string;
  };
  requiresCalendarWrite: boolean;
}

export interface Investigation {
  conflictId: string;
  analyzedBy: 'gemini-argon-live' | 'argon-structured-fallback';
  modelId: string;
  investigatedAt: string;
  confidence: 'confirmed' | 'likely' | 'unverified';
  confidenceReasoning: string;
  optionalityPolicyNote: string;
  evidence: EvidenceSource[];
  findings: string[];
  discoveredPhases: EventPhase[];
  discoveredLocation?: {
    address: string;
    neighborhood: string;
    coordinates: GeoCoordinates;
    sourceExcerpt: string;
  };
  proposals: ResolutionProposal[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  conflictId: string;
  proposalId: string;
  actionTitle: string;
  targetEventTitle: string;
  beforeSummary: string;
  afterSummary: string;
  evidenceUrl?: string;
  confidence?: 'confirmed' | 'likely' | 'unverified';
  userApproved: boolean;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  subtitle: string;
  dateLabel: string;
  dateIso: string;
  events: CalendarEvent[];
  defaultModes?: Record<string, TravelMode>;
}
