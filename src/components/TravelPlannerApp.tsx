'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flag,
  History,
  Home,
  Link2,
  Loader2,
  MapPin,
  Menu,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import {
  AuditLogEntry,
  CalendarEvent,
  Conflict,
  Investigation,
  ResolutionProposal,
  TravelMode,
} from '@/lib/types';
import {
  ConnectedCalendarSource,
  getLocalDateKey,
} from '@/lib/adapters/calendar-integrations';
import {
  HANDOVER_SAMPLE_EVENTS,
  SCENARIO_PRESETS,
  ensureCompleteEventAddress,
  resolveLocationCoordinates,
} from '@/lib/fixtures/scenarios';
import {
  evaluateItinerary,
  formatTimeShort,
  getEffectiveEndIso,
  verifyResolutionProposal,
} from '@/lib/engine/conflict-engine';
import { SanFranciscoMap } from './SanFranciscoMap';
import { CalendarIntegrationModal } from './CalendarIntegrationModal';
import { DayNavigatorBar } from './playback/DayNavigatorBar';
import {
  DayItineraryOverviewStrip,
  SidebarEventLocationCard,
  SidebarHomeDestinationCard,
  SidebarHomeLocationCard,
  SidebarTransportationCard,
} from './SidebarItineraryComponents';
import { useItineraryPlayback } from '@/lib/playback/useItineraryPlayback';
import {
  HISTORICAL_DAY_FIXTURES,
  TODAY_DATE_ISO,
  filterEventsOverlappingDay,
  isPastDateIso,
} from '@/lib/playback/day-history';

const STORAGE_KEY_SOURCES = 'argon_connected_calendar_sources_v1';

interface UndoSnapshot {
  label: string;
  events: CalendarEvent[];
  modes: Record<string, TravelMode>;
  dismissedConflictIds: string[];
}

export function TravelPlannerApp() {
  // Active calendar source ('handover-sf', 'founder-sprint', or connected 'src-...')
  const [activeSourceId, setActiveSourceId] = useState<string>('handover-sf');
  const [connectedSources, setConnectedSources] = useState<ConnectedCalendarSource[]>([]);
  const [mergeWithDemo, setMergeWithDemo] = useState<boolean>(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(TODAY_DATE_ISO);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(TODAY_DATE_ISO);
  const [modesByDate, setModesByDate] = useState<
    Record<string, Record<string, TravelMode>>
  >({});
  const [showIntegrationModal, setShowIntegrationModal] = useState<boolean>(false);

  // Schedule & Mode State
  const [events, setEvents] = useState<CalendarEvent[]>(HANDOVER_SAMPLE_EVENTS);
  const selectedModes = useMemo(
    () => modesByDate[selectedDateIso] || {},
    [modesByDate, selectedDateIso]
  );
  const setSelectedModes = (
    updater:
      | Record<string, TravelMode>
      | ((prev: Record<string, TravelMode>) => Record<string, TravelMode>)
  ) => {
    setModesByDate((prev) => {
      const currentDayModes = prev[selectedDateIso] || {};
      const nextDayModes =
        typeof updater === 'function' ? updater(currentDayModes) : updater;
      return {
        ...prev,
        [selectedDateIso]: nextDayModes,
      };
    });
  };
  const [bufferMinutes, setBufferMinutes] = useState<number>(5);
  const [dismissedConflictIds, setDismissedConflictIds] = useState<string[]>([]);

  // Home Starting Point (Item #3: Inline Timeline Origin Node with On-Demand Editor)
  const [homeAddress, setHomeAddress] = useState<string>(
    '450 Hayes St, Hayes Valley, San Francisco, CA'
  );
  const [lastValidHomeAddress, setLastValidHomeAddress] = useState<string>(
    '450 Hayes St, Hayes Valley, San Francisco, CA'
  );
  const [homeResolvedOverride, setHomeResolvedOverride] = useState<{
    address: string;
    neighborhood: string;
    coordinates: { lat: number; lng: number };
  } | null>(null);
  const [homeMode, setHomeMode] = useState<TravelMode>('transit');
  const [homeReturnMode, setHomeReturnMode] = useState<TravelMode>('transit');
  const [isEditingHome, setIsEditingHome] = useState<boolean>(false);

  const handleUpdateHomeAddress = (
    nextAddress: string,
    resolved?: { neighborhood: string; coordinates: { lat: number; lng: number } }
  ) => {
    setHomeAddress(nextAddress);
    if (nextAddress.trim()) {
      setLastValidHomeAddress(nextAddress.trim());
    }
    if (resolved) {
      setHomeResolvedOverride({
        address: nextAddress.trim(),
        neighborhood: resolved.neighborhood,
        coordinates: resolved.coordinates,
      });
    } else {
      setHomeResolvedOverride(null);
    }
  };

  const homeOrigin = useMemo(() => {
    const effectiveAddress =
      homeAddress.trim() || (isEditingHome ? lastValidHomeAddress : '');
    if (!effectiveAddress) return null;

    if (
      homeResolvedOverride &&
      homeResolvedOverride.address.toLowerCase() ===
        effectiveAddress.toLowerCase()
    ) {
      return {
        address: effectiveAddress,
        neighborhood: homeResolvedOverride.neighborhood,
        coordinates: homeResolvedOverride.coordinates,
        preferredMode: homeMode,
        preferredReturnMode: homeReturnMode,
      };
    }

    const resolved = resolveLocationCoordinates(effectiveAddress);
    if (!resolved.coordinates) return null;
    return {
      address: effectiveAddress,
      neighborhood: resolved.neighborhood,
      coordinates: resolved.coordinates,
      preferredMode: homeMode,
      preferredReturnMode: homeReturnMode,
    };
  }, [
    homeAddress,
    isEditingHome,
    lastValidHomeAddress,
    homeResolvedOverride,
    homeMode,
    homeReturnMode,
  ]);

  // Sidebar & Selection State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'conflicts'>('calendar');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);

  // Argon Investigation & Contextual Resolution Drawer State (Item #7 & #8)
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);
  const [investigationsByConflict, setInvestigationsByConflict] = useState<
    Record<string, Investigation>
  >({});
  const [loadingConflictId, setLoadingConflictId] = useState<string | null>(null);
  const [previewProposal, setPreviewProposal] = useState<ResolutionProposal | null>(
    null
  );
  const [customLocationInput, setCustomLocationInput] = useState<string>(
    'SHACK15, Ferry Building Suite 201, San Francisco, CA'
  );
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  // Add Custom Event Modal State
  const [showAddEventModal, setShowAddEventModal] = useState<boolean>(false);
  const [newEvtTitle, setNewEvtTitle] = useState<string>('Hardware Lab Demo');
  const [newEvtStart, setNewEvtStart] = useState<string>('16:00');
  const [newEvtEnd, setNewEvtEnd] = useState<string>('16:45');
  const [newEvtLocation, setNewEvtLocation] = useState<string>(
    'Moscone Center, San Francisco, CA'
  );
  const [newEvtVirtual, setNewEvtVirtual] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SOURCES);
      if (saved) {
        const parsed = JSON.parse(saved) as ConnectedCalendarSource[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((src) => ({
            ...src,
            events: (src.events || []).map((evt, idx) =>
              ensureCompleteEventAddress(evt, idx)
            ),
          }));
          setConnectedSources(normalized);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistSources = (next: ConnectedCalendarSource[]) => {
    setConnectedSources(next);
    try {
      localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const activeConnectedSource = useMemo(
    () => connectedSources.find((s) => s.id === activeSourceId) || null,
    [connectedSources, activeSourceId]
  );

  const eventCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    if (activeConnectedSource) {
      for (const evt of activeConnectedSource.events) {
        const dKey = getLocalDateKey(evt.start);
        counts[dKey] = (counts[dKey] || 0) + 1;
      }
      return counts;
    }
    const preset =
      SCENARIO_PRESETS.find((s) => s.id === activeSourceId) ||
      SCENARIO_PRESETS[0];
    for (const evt of preset.events) {
      const dKey = getLocalDateKey(evt.start);
      counts[dKey] = (counts[dKey] || 0) + 1;
    }
    for (const [dKey, fixture] of Object.entries(HISTORICAL_DAY_FIXTURES)) {
      if (fixture.events.length > 0 && !counts[dKey]) {
        counts[dKey] = fixture.events.length;
      }
    }
    return counts;
  }, [activeConnectedSource, activeSourceId]);

  const loadEventsForSelection = (
    sourceId: string,
    sourcesList: ConnectedCalendarSource[],
    dateFilter: string,
    mergeDemo: boolean
  ) => {
    const personal = sourcesList.find((s) => s.id === sourceId);
    if (personal) {
      const targetDate = dateFilter === 'ALL' ? TODAY_DATE_ISO : dateFilter;
      const filteredPersonal = personal.events.filter(
        (e) => getLocalDateKey(e.start) === targetDate
      );

      const combined = mergeDemo
        ? [...HANDOVER_SAMPLE_EVENTS, ...filteredPersonal]
        : filteredPersonal;

      setEvents(combined);
      setSelectedModes({});
      setDismissedConflictIds([]);
      setInvestigationsByConflict({});
      setPreviewProposal(null);
      setUndoSnapshot(null);
      setSelectedEventId(null);
      setSelectedLegId(null);
      setInspectorOpen(false);
      return;
    }

    const preset =
      SCENARIO_PRESETS.find((s) => s.id === sourceId) || SCENARIO_PRESETS[0];
    setEvents(preset.events);
    setSelectedModes({});
    setDismissedConflictIds([]);
    setInvestigationsByConflict({});
    setPreviewProposal(null);
    setUndoSnapshot(null);
    setSelectedEventId(null);
    setSelectedLegId(null);
    setInspectorOpen(false);

    // Keep default morning origin aligned with the active California preset
    if (sourceId === 'california-corridor') {
      setHomeAddress('2800 Sand Hill Rd, Menlo Park, CA');
    } else if (
      homeAddress === '2800 Sand Hill Rd, Menlo Park, CA' ||
      homeAddress === 'Westminster, London, UK'
    ) {
      setHomeAddress('450 Hayes St, Hayes Valley, San Francisco, CA');
    }
  };

  const [resyncingSourceId, setResyncingSourceId] = useState<string | null>(
    null
  );

  const pickBestPersonalDate = (
    _source: ConnectedCalendarSource
  ): { dateFilter: string; dateIso: string } => {
    return { dateFilter: TODAY_DATE_ISO, dateIso: TODAY_DATE_ISO };
  };

  const handleResyncConnectedSource = async (
    source: ConnectedCalendarSource
  ) => {
    setResyncingSourceId(source.id);
    try {
      const sessionToken =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('argon_google_oauth_token_session_v1') || ''
          : '';
      const payload =
        source.provider === 'google-api'
          ? {
              provider: 'google-api',
              name: source.name,
              color: source.color,
              calendarId: source.syncConfig?.calendarId || 'primary',
              accessToken: source.syncConfig?.accessToken || sessionToken,
              apiKey: source.syncConfig?.apiKey,
            }
          : source.provider === 'ical-url' && source.syncConfig?.icalUrl
          ? {
              provider: 'ical-url',
              name: source.name,
              icalUrl: source.syncConfig.icalUrl,
            }
          : null;

      if (!payload) {
        setShowIntegrationModal(true);
        return;
      }

      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.source) {
        setShowIntegrationModal(true);
        return;
      }

      const refreshed: ConnectedCalendarSource = {
        ...data.source,
        id: source.id,
      };
      const updated = connectedSources.map((s) =>
        s.id === source.id ? refreshed : s
      );
      persistSources(updated);
      const { dateFilter, dateIso } = pickBestPersonalDate(refreshed);
      setSelectedDateFilter(dateFilter);
      setSelectedDateIso(dateIso);
      loadEventsForSelection(refreshed.id, updated, dateFilter, mergeWithDemo);
    } catch {
      setShowIntegrationModal(true);
    } finally {
      setResyncingSourceId(null);
    }
  };

  const handleSelectSource = (sourceId: string) => {
    setActiveSourceId(sourceId);
    const personal = connectedSources.find((s) => s.id === sourceId);
    if (personal) {
      const { dateFilter, dateIso } = pickBestPersonalDate(personal);
      setSelectedDateFilter(dateFilter);
      setSelectedDateIso(dateIso);
      loadEventsForSelection(
        sourceId,
        connectedSources,
        dateFilter,
        mergeWithDemo
      );
      // If a previously saved Google calendar had 0 events cached, auto-resync it
      if (personal.events.length === 0 && personal.provider === 'google-api') {
        void handleResyncConnectedSource(personal);
      }
      return;
    }
    setSelectedDateFilter(TODAY_DATE_ISO);
    setSelectedDateIso(TODAY_DATE_ISO);
    loadEventsForSelection(sourceId, connectedSources, TODAY_DATE_ISO, mergeWithDemo);
  };

  const handleAddConnectedSource = (source: ConnectedCalendarSource) => {
    const updated = [
      source,
      ...connectedSources.filter((s) => s.name !== source.name),
    ];
    persistSources(updated);
    setActiveSourceId(source.id);
    const { dateFilter, dateIso } = pickBestPersonalDate(source);
    setSelectedDateFilter(dateFilter);
    setSelectedDateIso(dateIso);
    loadEventsForSelection(source.id, updated, dateFilter, mergeWithDemo);
  };

  const handleChangeDateFilter = (newFilter: string) => {
    setSelectedDateFilter(newFilter);
    if (newFilter !== 'ALL') {
      setSelectedDateIso(newFilter);
    }
    loadEventsForSelection(
      activeSourceId,
      connectedSources,
      newFilter,
      mergeWithDemo
    );
  };

  const handleRemoveConnectedSource = (sourceId: string) => {
    const updated = connectedSources.filter((s) => s.id !== sourceId);
    persistSources(updated);
    if (activeSourceId === sourceId) {
      setActiveSourceId('handover-sf');
      loadEventsForSelection('handover-sf', updated, TODAY_DATE_ISO, false);
    }
  };

  const handleToggleMergeWithDemo = (merge: boolean) => {
    setMergeWithDemo(merge);
    loadEventsForSelection(
      activeSourceId,
      connectedSources,
      selectedDateFilter,
      merge
    );
  };

  const handleSelectDateIso = (newDateIso: string) => {
    setSelectedDateIso(newDateIso);
    setDismissedConflictIds([]);
    setInvestigationsByConflict({});
    setPreviewProposal(null);
    setUndoSnapshot(null);

    if (activeConnectedSource) {
      setSelectedDateFilter(newDateIso);
      const dayPersonal = filterEventsOverlappingDay(
        activeConnectedSource.events,
        newDateIso
      );
      setEvents(dayPersonal);
      setSelectedEventId(null);
      setSelectedLegId(null);
      setInspectorOpen(false);
      return;
    }

    if (newDateIso === TODAY_DATE_ISO) {
      const preset =
        SCENARIO_PRESETS.find((s) => s.id === activeSourceId) ||
        SCENARIO_PRESETS[0];
      setEvents(preset.events);
      setSelectedEventId(null);
      setSelectedLegId(null);
      setInspectorOpen(false);
      return;
    }

    const allHistoricalPool = Object.values(HISTORICAL_DAY_FIXTURES).flatMap(
      (f) => f.events
    );
    const overlapping = filterEventsOverlappingDay(
      allHistoricalPool,
      newDateIso
    );
    const dayFixture = HISTORICAL_DAY_FIXTURES[newDateIso];
    const resolvedEvents =
      overlapping.length > 0 ? overlapping : dayFixture?.events || [];

    setEvents(resolvedEvents);
    setSelectedEventId(null);
    setSelectedLegId(null);
    setInspectorOpen(false);
  };

  // Deterministic Itinerary & Conflict Evaluation
  const baseEvaluation = useMemo(
    () =>
      evaluateItinerary(
        events,
        selectedModes,
        bufferMinutes,
        dismissedConflictIds
      ),
    [events, selectedModes, bufferMinutes, dismissedConflictIds]
  );

  const activeEvaluation = useMemo(() => {
    if (!previewProposal) return baseEvaluation;
    const verified = verifyResolutionProposal(
      events,
      selectedModes,
      bufferMinutes,
      dismissedConflictIds,
      previewProposal
    );
    return verified.previewEvaluation;
  }, [
    previewProposal,
    baseEvaluation,
    events,
    selectedModes,
    bufferMinutes,
    dismissedConflictIds,
  ]);

  // 2D Itinerary Playback Controller
  const playback = useItineraryPlayback({
    selectedDateIso,
    isPastDay: isPastDateIso(selectedDateIso),
    events: activeEvaluation.events,
    legs: activeEvaluation.legs,
    conflicts: activeEvaluation.conflicts,
    selectedModes,
    homeOrigin,
    bufferMinutes,
    onSyncSelection: (eventId, legId) => {
      if (eventId) setSelectedEventId(eventId);
      if (legId) setSelectedLegId(legId);
    },
  });

  const handleResetDemo = () => {
    loadEventsForSelection(
      activeSourceId,
      connectedSources,
      selectedDateFilter,
      mergeWithDemo
    );
    setAuditLog([]);
    setUndoSnapshot(null);
  };

  // Contextual Argon Investigation (Item #8: Does NOT force tab jump unless requested)
  const triggerInvestigation = async (
    conflictId: string,
    opts?: { switchToConflictsTab?: boolean }
  ) => {
    if (opts?.switchToConflictsTab) {
      setActiveTab('conflicts');
    }

    // Toggle inline drawer if already open and investigated
    if (expandedConflictId === conflictId && investigationsByConflict[conflictId] && !opts?.switchToConflictsTab) {
      setExpandedConflictId(null);
      setPreviewProposal(null);
      return;
    }

    setExpandedConflictId(conflictId);

    const conflict = baseEvaluation.conflicts.find((c) => c.id === conflictId);
    if (conflict?.legId) {
      setSelectedLegId(conflict.legId);
    } else if (conflict?.eventIds[0]) {
      setSelectedEventId(conflict.eventIds[0]);
    }

    if (investigationsByConflict[conflictId]) {
      return;
    }

    setLoadingConflictId(conflictId);
    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId,
          events,
          selectedModes,
          bufferMinutes,
        }),
      });
      const data = await res.json();
      if (data.investigation) {
        setInvestigationsByConflict((prev) => ({
          ...prev,
          [conflictId]: data.investigation,
        }));
      }
    } finally {
      setLoadingConflictId(null);
    }
  };

  // Single-Click Apply with Instant Undo Snapshot (Item #7)
  const handleApplyProposal = (
    proposal: ResolutionProposal,
    investigation?: Investigation
  ) => {
    // Save snapshot for 1-click Undo
    setUndoSnapshot({
      label: proposal.title,
      events: [...events],
      modes: { ...selectedModes },
      dismissedConflictIds: [...dismissedConflictIds],
    });

    const targetEvent = events.find((e) => e.id === proposal.targetEventId);
    const beforeSummary = targetEvent
      ? `${targetEvent.title}: ${formatTimeShort(targetEvent.start)}–${formatTimeShort(
          getEffectiveEndIso(targetEvent)
        )} @ ${targetEvent.location || 'Missing address'}`
      : 'Original schedule state';

    if (
      proposal.actionType === 'switch_travel_mode' &&
      proposal.proposedChanges.preferredMode
    ) {
      const conflict = baseEvaluation.conflicts.find(
        (c) => c.id === proposal.conflictId
      );
      const leg =
        (conflict?.legId &&
          baseEvaluation.legs.find((l) => l.id === conflict.legId)) ||
        baseEvaluation.legs.find(
          (l) =>
            l.fromEventId === proposal.targetEventId ||
            l.toEventId === proposal.targetEventId
        );
      if (leg) {
        setSelectedModes((prev) => ({
          ...prev,
          [leg.id]: proposal.proposedChanges.preferredMode!,
        }));
      }
    } else if (proposal.actionType === 'dismiss_conflict') {
      setDismissedConflictIds((prev) => [...prev, proposal.conflictId]);
    } else {
      setEvents((prev) =>
        prev.map((evt) => {
          if (evt.id !== proposal.targetEventId) return evt;
          const c = proposal.proposedChanges;
          return {
            ...evt,
            effectiveEnd: c.effectiveEnd ?? evt.effectiveEnd,
            start: c.newStart ?? evt.start,
            end: c.newEnd ?? evt.end,
            location: c.newLocation ?? evt.location,
            neighborhood: c.newNeighborhood ?? evt.neighborhood,
            coordinates: c.newCoordinates ?? evt.coordinates,
            phases: c.phases ?? evt.phases,
            appliedResolutionId: proposal.id,
          };
        })
      );
    }

    setAuditLog((prev) => [
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        conflictId: proposal.conflictId,
        proposalId: proposal.id,
        actionTitle: proposal.title,
        targetEventTitle: targetEvent?.title || proposal.targetEventId,
        beforeSummary,
        afterSummary: proposal.verification.verificationSummary,
        evidenceUrl: investigation?.evidence[0]?.url,
        confidence: investigation?.confidence,
        userApproved: true,
      },
      ...prev,
    ]);

    setPreviewProposal(null);
    setExpandedConflictId(null);
  };

  const handleUndoLastAction = () => {
    if (!undoSnapshot) return;
    setEvents(undoSnapshot.events);
    setSelectedModes(undoSnapshot.modes);
    setDismissedConflictIds(undoSnapshot.dismissedConflictIds);
    setAuditLog((prev) => prev.slice(1));
    setUndoSnapshot(null);
  };

  const handleManualLocationSave = async (conflict: Conflict) => {
    const targetId = conflict.eventIds[0];
    if (!targetId || !customLocationInput.trim()) return;
    const rawAddress = customLocationInput.trim();
    let resolved = resolveLocationCoordinates(rawAddress);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(rawAddress)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.coordinates) {
          resolved = data;
        }
      }
    } catch {
      // Fallback to synchronous deterministic resolver
    }
    const manualProposal: ResolutionProposal = {
      id: `prop-manual-loc-${Date.now()}`,
      conflictId: conflict.id,
      title: `Set venue to "${rawAddress}"`,
      description: 'User-supplied destination address.',
      actionType: 'set_discovered_location',
      targetEventId: targetId,
      proposedChanges: {
        newLocation: rawAddress,
        newNeighborhood: resolved.neighborhood,
        newCoordinates: resolved.coordinates,
      },
      verification: {
        verifiedByEngine: true,
        resolvesTargetConflict: true,
        remainingConflictsCount: Math.max(0, baseEvaluation.conflicts.length - 1),
        verificationSummary: `Location geocoded to ${resolved.neighborhood}; departure route computed.`,
      },
      requiresCalendarWrite: true,
    };
    handleApplyProposal(manualProposal, investigationsByConflict[conflict.id]);
  };

  const handleCreateCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvtTitle.trim()) return;
    const targetDate =
      selectedDateFilter !== 'ALL' ? selectedDateFilter : selectedDateIso;
    const startIso = `${targetDate}T${newEvtStart}:00-07:00`;
    const endIso = `${targetDate}T${newEvtEnd}:00-07:00`;
    let resolved = newEvtVirtual
      ? { neighborhood: 'Virtual Meeting', coordinates: undefined }
      : resolveLocationCoordinates(newEvtLocation);

    if (!newEvtVirtual && newEvtLocation.trim()) {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(newEvtLocation.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.coordinates) {
            resolved = data;
          }
        }
      } catch {
        // Fallback to synchronous deterministic resolver
      }
    }

    const created: CalendarEvent = {
      id: `evt-custom-${Date.now()}`,
      title: newEvtTitle.trim(),
      start: startIso,
      end: endIso,
      location: newEvtVirtual
        ? 'https://meet.google.com/new'
        : newEvtLocation.trim(),
      neighborhood: resolved.neighborhood,
      coordinates: resolved.coordinates,
      isVirtual: newEvtVirtual,
      organizer: 'Added in R & Go',
    };

    setEvents((prev) => [...prev, created]);
    setSelectedEventId(created.id);
    setShowAddEventModal(false);
  };

  const buildGoogleCalendarUrl = (evt: CalendarEvent) => {
    const toGCalTime = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startStr = toGCalTime(evt.start);
    const endStr = toGCalTime(getEffectiveEndIso(evt));
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evt.title,
      dates: `${startStr}/${endStr}`,
      location: evt.location || '',
      details:
        evt.description ||
        'Verified itinerary from R & Go Travel Planner',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const activeConflictsCount = baseEvaluation.conflicts.length;

  // Shared Inline Resolution Drawer Renderer (Used in both Calendar timeline and Conflicts tab — Item #7 & #8)
  const renderInlineResolutionDrawer = (conflict: Conflict) => {
    const investigation = investigationsByConflict[conflict.id];
    const isLoading = loadingConflictId === conflict.id;

    return (
      <div className="mt-2.5 rounded-xl border border-indigo-100 bg-white p-3.5 shadow-sm space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-indigo-50/70 p-3 text-[12px] font-medium text-indigo-900">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
            <span>Checking official organizer schedule & verifying routes…</span>
          </div>
        ) : investigation ? (
          <>
            {/* Evidence & Confidence Box */}
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>R &amp; Go Evidence:</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-indigo-700 border border-indigo-200/60">
                    {investigation.confidence}
                  </span>
                </span>

                {investigation.evidence[0]?.url && (
                  <Link
                    href={
                      conflict.id === 'cf2'
                        ? '/organizer/dev-summit'
                        : conflict.id === 'cf3'
                        ? '/organizer/community-dinner'
                        : '/organizer/founders-keynote'
                    }
                    className="text-[11px] font-semibold text-indigo-600 hover:underline shrink-0"
                  >
                    Official Source ↗
                  </Link>
                )}
              </div>

              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                {investigation.confidenceReasoning}
              </p>

              {/* Discovered Phases Pills */}
              {investigation.discoveredPhases.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {investigation.discoveredPhases.map((phase, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        phase.optionality === 'optional'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {phase.label}: {formatTimeShort(phase.start)}–
                      {formatTimeShort(phase.end)} ({phase.optionality})
                    </span>
                  ))}
                </div>
              )}

              {investigation.optionalityPolicyNote && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-900 border border-amber-200/60">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" />
                  <span>{investigation.optionalityPolicyNote}</span>
                </div>
              )}
            </div>

            {/* Custom Location Input for missing_location conflicts */}
            {conflict.type === 'missing_location' && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customLocationInput}
                  onChange={(e) => setCustomLocationInput(e.target.value)}
                  placeholder="Or enter venue address anywhere in the world..."
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleManualLocationSave(conflict)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white cursor-pointer"
                >
                  Set Venue
                </button>
              </div>
            )}

            {/* Hover-to-Preview & Single-Click Resolution Options (Item #7) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Verified Options (Hover to preview on map)</span>
              </div>
              {investigation.proposals.map((prop) => {
                const isPreviewing = previewProposal?.id === prop.id;
                return (
                  <div
                    key={prop.id}
                    onMouseEnter={() => setPreviewProposal(prop)}
                    onMouseLeave={() =>
                      setPreviewProposal((curr) =>
                        curr?.id === prop.id ? null : curr
                      )
                    }
                    className={`rounded-xl border p-3 transition-all ${
                      isPreviewing
                        ? 'border-emerald-500 bg-emerald-50/30 shadow-2xs'
                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-semibold text-slate-900 leading-snug">
                        {prop.title}
                      </div>
                      {prop.verification.resolvesTargetConflict && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
                          ✓ Verified
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50/70 rounded-md px-2 py-1">
                      {prop.verification.verificationSummary}
                    </div>

                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleApplyProposal(prop, investigation)}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-[12px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        <span>
                          {prop.actionType === 'dismiss_conflict'
                            ? 'Dismiss Alert'
                            : prop.requiresCalendarWrite
                            ? 'Approve & Apply'
                            : 'Switch Route Mode'}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-[#0f172a] font-sans">
      {/* LEFT COLLAPSIBLE SIDEBAR */}
      <aside
        className={`relative z-20 flex flex-col bg-white border-r border-slate-200/80 shadow-[4px_0_24px_rgba(15,23,42,0.06)] transition-all duration-200 ${
          sidebarCollapsed ? 'w-[76px] px-3 py-5' : 'w-[410px] px-4 py-4'
        }`}
      >
        {/* ROW 1: Compact Brand + Source Selector Pill + Actions (Item #1) */}
        <div
          className={`flex items-center ${
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          } mb-3`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/r-and-go-icon.svg"
              alt="R & Go"
              className="h-6 w-6 shrink-0 rounded-md"
            />
            {!sidebarCollapsed && (
              <span className="text-[18px] font-extrabold tracking-tight text-slate-900 shrink-0">
                R <span className="text-indigo-600">&amp;</span> Go
                <span className="text-indigo-600">.</span>
              </span>
            )}

            {/* Clean Calendar Source Pill + Connect Trigger */}
            {!sidebarCollapsed && (
              <div className="flex items-center gap-1 ml-1 min-w-0">
                <select
                  aria-label="Select active calendar source"
                  value={activeSourceId}
                  onChange={(e) => handleSelectSource(e.target.value)}
                  className="max-w-[155px] truncate rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <optgroup label="Built-in Scenarios">
                    {SCENARIO_PRESETS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  {connectedSources.length > 0 && (
                    <optgroup label="Connected Calendars">
                      {connectedSources.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => setShowIntegrationModal(true)}
                  title="Connect Google, iCal, or macOS Calendar"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={handleResetDemo}
                title="Reset itinerary to initial state"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* COLLAPSED ICON RAIL */}
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2.5 mt-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('calendar');
                setSidebarCollapsed(false);
              }}
              title="Expand Itinerary"
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <CalendarIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSidebarCollapsed(false);
                if (baseEvaluation.conflicts[0]) {
                  void triggerInvestigation(baseEvaluation.conflicts[0].id);
                }
              }}
              title="Expand Conflicts"
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Flag className="h-5 w-5" />
              {activeConflictsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {activeConflictsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowIntegrationModal(true)}
              title="Connect Calendars"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Link2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <MapPin className="h-5 w-5" />
            </button>
          </div>
        ) : (
          /* EXPANDED SIDEBAR CONTENT */
          <>
            <DayNavigatorBar
              selectedDateIso={selectedDateIso}
              selectedDateFilter={selectedDateFilter}
              eventsCount={activeEvaluation.events.length}
              eventCountsByDate={eventCountsByDate}
              totalSourceEventsCount={activeConnectedSource?.events.length}
              isConnectedCalendar={Boolean(activeConnectedSource)}
              isResyncing={
                Boolean(activeConnectedSource) &&
                resyncingSourceId === activeConnectedSource?.id
              }
              onSelectDateIso={handleSelectDateIso}
              onResync={
                activeConnectedSource
                  ? () => void handleResyncConnectedSource(activeConnectedSource)
                  : undefined
              }
            />

            {/* Instant 1-Click Undo Banner when a resolution was just applied (Item #7) */}
            {undoSnapshot && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[12px] text-emerald-950">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate font-medium">
                    Applied: <strong className="font-semibold">{undoSnapshot.label}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleUndoLastAction}
                  className="inline-flex items-center gap-1 shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-emerald-200 hover:bg-slate-50 cursor-pointer"
                >
                  <Undo2 className="h-3 w-3" />
                  Undo
                </button>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto pr-0.5">
              {activeTab === 'calendar' ? (
                /* ================= CALENDAR TAB (Items #3, #6, #8) ================= */
                <div>
                  {activeEvaluation.events.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-3">
                      <CalendarIcon className="mx-auto h-6 w-6 text-slate-400" />
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-800">
                          No commitments on {selectedDateIso}
                        </h3>
                        <p className="mt-1 text-[12px] text-slate-500">
                          {activeConnectedSource
                            ? activeConnectedSource.events.length > 0
                              ? `"${activeConnectedSource.name}" has ${activeConnectedSource.events.length} synced events across ${activeConnectedSource.availableDates.length} date(s), but none on ${selectedDateIso}.`
                              : `"${activeConnectedSource.name}" currently has 0 synced events cached. Click Re-sync below to fetch your latest Google Calendar events.`
                            : 'Step to another date above or add an event.'}
                        </p>
                      </div>

                      {activeConnectedSource && (
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          {activeConnectedSource.events.length > 0 &&
                            activeConnectedSource.availableDates.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeDateFilter(
                                    activeConnectedSource.availableDates[
                                      activeConnectedSource.availableDates
                                        .length - 1
                                    ]
                                  )
                                }
                                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
                              >
                                Jump to{' '}
                                {
                                  activeConnectedSource.availableDates[
                                    activeConnectedSource.availableDates
                                      .length - 1
                                  ]
                                }
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              void handleResyncConnectedSource(
                                activeConnectedSource
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 text-xs font-bold text-indigo-700 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>
                              Re-sync &ldquo;{activeConnectedSource.name}&rdquo;
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <DayItineraryOverviewStrip
                        eventsCount={activeEvaluation.events.length}
                        legs={activeEvaluation.legs}
                        homeLeg={playback.timeline.homeLeg}
                        homeReturnLeg={playback.timeline.homeReturnLeg}
                        conflictsCount={activeConflictsCount}
                      />

                      <div className="relative pl-5 pt-1 pb-4">
                        {/* Continuous Vertical Timeline Spine */}
                        <div className="absolute left-[9px] top-4 bottom-6 w-[2px] bg-gradient-to-b from-teal-300 via-indigo-200 to-teal-300" />

                        {/* COMPONENT 1 (ORIGIN): Starting Location Card */}
                        <SidebarHomeLocationCard
                          homeOrigin={playback.timeline.homeOrigin}
                          homeAddress={homeAddress}
                          isEditingHome={isEditingHome}
                          isSelected={selectedEventId === 'evt-home-origin'}
                          onSelect={() => {
                            setSelectedEventId('evt-home-origin');
                            if (playback.timeline.homeLeg) {
                              setSelectedLegId(playback.timeline.homeLeg.id);
                            }
                            setInspectorOpen(true);
                          }}
                          onToggleEdit={() => {
                            if (isEditingHome && !homeAddress.trim()) {
                              setHomeAddress(lastValidHomeAddress);
                            }
                            setIsEditingHome((v) => !v);
                          }}
                          onChangeAddress={handleUpdateHomeAddress}
                          onClearAddress={() => {
                            setHomeAddress('');
                            setLastValidHomeAddress('');
                            setHomeResolvedOverride(null);
                            setIsEditingHome(false);
                          }}
                          onRestoreDefaultAddress={() => {
                            const defaultAddr =
                              '450 Hayes St, Hayes Valley, San Francisco, CA';
                            setHomeAddress(defaultAddr);
                            setLastValidHomeAddress(defaultAddr);
                            setHomeResolvedOverride(null);
                            setIsEditingHome(true);
                          }}
                        />

                        {/* COMPONENT 2 (MORNING COMMUTE): Transportation Card from Origin to Stop 1 */}
                        {playback.timeline.homeLeg && (
                          <SidebarTransportationCard
                            leg={playback.timeline.homeLeg}
                            isSelected={
                              selectedLegId === playback.timeline.homeLeg.id
                            }
                            isResolutionDrawerOpen={false}
                            isMorningCommute={true}
                            onSelect={() => {
                              setSelectedLegId(playback.timeline.homeLeg!.id);
                              setSelectedEventId(
                                playback.timeline.homeLeg!.toEventId
                              );
                              setInspectorOpen(true);
                            }}
                            onChangeMode={(mode) => setHomeMode(mode)}
                          />
                        )}

                        {/* CHRONOLOGICAL EVENTS (Component 1) & TRANSPORTATION LEGS (Component 2) */}
                        {activeEvaluation.events.map((evt, index) => {
                          const isSelected = evt.id === selectedEventId;

                          const outgoingLeg = activeEvaluation.legs.find(
                            (l) => l.fromEventId === evt.id
                          );
                          const legConflict = outgoingLeg
                            ? activeEvaluation.conflicts.find(
                                (c) =>
                                  c.legId === outgoingLeg.id ||
                                  (c.eventIds.includes(outgoingLeg.fromEventId) &&
                                    c.eventIds.includes(outgoingLeg.toEventId))
                              )
                            : undefined;
                          const missingLocConflict =
                            activeEvaluation.conflicts.find(
                              (c) =>
                                c.type === 'missing_location' &&
                                c.eventIds.includes(evt.id)
                            );

                          return (
                            <React.Fragment key={evt.id}>
                              {/* COMPONENT 1: Event / Location We Are At */}
                              <SidebarEventLocationCard
                                event={evt}
                                stopIndex={index + 1}
                                isSelected={isSelected}
                                missingLocConflict={missingLocConflict}
                                isResolutionDrawerOpen={
                                  Boolean(
                                    missingLocConflict &&
                                      expandedConflictId === missingLocConflict.id
                                  )
                                }
                                googleCalendarUrl={buildGoogleCalendarUrl(evt)}
                                onSelect={() => {
                                  setSelectedEventId(evt.id);
                                  if (outgoingLeg) {
                                    setSelectedLegId(outgoingLeg.id);
                                  } else {
                                    const incomingLeg = activeEvaluation.legs.find(
                                      (l) => l.toEventId === evt.id
                                    );
                                    if (incomingLeg) {
                                      setSelectedLegId(incomingLeg.id);
                                    }
                                  }
                                  setInspectorOpen(true);
                                }}
                                onTriggerMissingLocationResolve={(conflictId) =>
                                  triggerInvestigation(conflictId)
                                }
                                renderInlineResolutionDrawer={
                                  renderInlineResolutionDrawer
                                }
                              />

                              {/* COMPONENT 2: Transportation Between Locations */}
                              {outgoingLeg && (
                                <SidebarTransportationCard
                                  leg={outgoingLeg}
                                  conflict={legConflict}
                                  isSelected={selectedLegId === outgoingLeg.id}
                                  isResolutionDrawerOpen={
                                    Boolean(
                                      legConflict &&
                                        expandedConflictId === legConflict.id
                                    )
                                  }
                                  onSelect={() => {
                                    setSelectedLegId(outgoingLeg.id);
                                    setSelectedEventId(outgoingLeg.toEventId);
                                    setInspectorOpen(true);
                                  }}
                                  onChangeMode={(mode) =>
                                    setSelectedModes((prev) => ({
                                      ...prev,
                                      [outgoingLeg.id]: mode,
                                    }))
                                  }
                                  onTriggerConflictResolve={(conflictId) => {
                                    setSelectedLegId(outgoingLeg.id);
                                    triggerInvestigation(conflictId);
                                  }}
                                  renderInlineResolutionDrawer={
                                    renderInlineResolutionDrawer
                                  }
                                />
                              )}
                            </React.Fragment>
                          );
                        })}

                        {/* COMPONENT 2 (EVENING RETURN): Automatic Transportation Card back to Home */}
                        {playback.timeline.homeReturnLeg && (
                          <SidebarTransportationCard
                            leg={playback.timeline.homeReturnLeg}
                            isSelected={
                              selectedLegId ===
                              playback.timeline.homeReturnLeg.id
                            }
                            isResolutionDrawerOpen={false}
                            isEveningReturn={true}
                            onSelect={() => {
                              setSelectedLegId(
                                playback.timeline.homeReturnLeg!.id
                              );
                              setSelectedEventId('evt-home-return');
                              setInspectorOpen(true);
                            }}
                            onChangeMode={(mode) => setHomeReturnMode(mode)}
                          />
                        )}

                        {/* COMPONENT 1 (FINAL DESTINATION): Automatic Home Destination Card at End of Day */}
                        {playback.timeline.homeOrigin && (
                          <SidebarHomeDestinationCard
                            homeOrigin={playback.timeline.homeOrigin}
                            homeReturnLeg={playback.timeline.homeReturnLeg}
                            isSelected={selectedEventId === 'evt-home-return'}
                            onSelect={() => {
                              setSelectedEventId('evt-home-return');
                              if (playback.timeline.homeReturnLeg) {
                                setSelectedLegId(
                                  playback.timeline.homeReturnLeg.id
                                );
                              }
                              setInspectorOpen(true);
                            }}
                            onEditHomeClick={() => setIsEditingHome(true)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ================= CONFLICTS TRIAGE TAB ================= */
                <div className="pt-1 pb-4">
                  {activeConflictsCount === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
                      <h3 className="mt-2 text-[15px] font-semibold text-emerald-950">
                        All Schedule & Travel Conflicts Resolved
                      </h3>
                      <p className="mt-1 text-[13px] text-emerald-800">
                        Every physical journey meets its arrival deadline and buffer.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('calendar')}
                        className="mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-[12px] font-semibold text-white cursor-pointer"
                      >
                        Back to Calendar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {baseEvaluation.conflicts.map((conflict) => {
                        const isExpanded = expandedConflictId === conflict.id;

                        return (
                          <div
                            key={conflict.id}
                            className={`rounded-xl border p-3.5 transition-all ${
                              conflict.severity === 'critical'
                                ? 'border-rose-200 bg-rose-50/30'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  conflict.severity === 'critical'
                                    ? 'bg-rose-100 text-rose-800'
                                    : conflict.type === 'overlap'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {conflict.severity === 'critical'
                                  ? 'Travel Shortfall'
                                  : conflict.type === 'overlap'
                                  ? 'Schedule Overlap'
                                  : 'Missing Venue'}
                              </span>

                              <button
                                type="button"
                                onClick={() => triggerInvestigation(conflict.id)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            <h3 className="mt-2 text-[15px] font-semibold text-slate-900">
                              {conflict.title}
                            </h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                              {conflict.summary}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => triggerInvestigation(conflict.id)}
                                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>
                                  {isExpanded
                                    ? 'Hide Argon verification'
                                    : 'Investigate & resolve →'}
                                </span>
                              </button>

                              {conflict.legId && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedLegId(conflict.legId!)}
                                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                  Focus on map
                                </button>
                              )}
                            </div>

                            {isExpanded && renderInlineResolutionDrawer(conflict)}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Session Audit Trail */}
                  {auditLog.length > 0 && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          <History className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Applied Resolutions ({auditLog.length})</span>
                        </span>
                        {undoSnapshot && (
                          <button
                            type="button"
                            onClick={handleUndoLastAction}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                          >
                            <Undo2 className="h-3 w-3" />
                            Undo last
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {auditLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 text-[12px]"
                          >
                            <div className="font-semibold text-emerald-950">
                              ✓ {entry.actionTitle}
                            </div>
                            <div className="mt-0.5 text-[11px] text-emerald-800">
                              {entry.afterSummary}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* PERSISTENT RIGHT MAP CANVAS */}
      <SanFranciscoMap
        events={activeEvaluation.events}
        legs={activeEvaluation.legs}
        conflicts={activeEvaluation.conflicts}
        selectedEventId={selectedEventId}
        selectedLegId={selectedLegId}
        inspectorOpen={inspectorOpen}
        previewProposal={previewProposal}
        bufferMinutes={bufferMinutes}
        playback={playback}
        onSelectEvent={(eventId) => {
          setSelectedEventId(eventId);
          const leg = activeEvaluation.legs.find(
            (l) => l.fromEventId === eventId || l.toEventId === eventId
          );
          if (leg) setSelectedLegId(leg.id);
        }}
        onSelectLeg={(legId) => setSelectedLegId(legId)}
        onCloseInspector={() => setInspectorOpen(false)}
        onChangeMode={(legId, mode) => {
          if (legId === 'leg-home-origin') {
            setHomeMode(mode);
          } else if (legId === 'leg-home-return') {
            setHomeReturnMode(mode);
          } else {
            setSelectedModes((prev) => ({ ...prev, [legId]: mode }));
          }
        }}
        onInvestigateConflict={(conflictId) =>
          triggerInvestigation(conflictId, { switchToConflictsTab: false })
        }
      />

      {/* CALENDAR INTEGRATIONS & SOURCES MODAL */}
      <CalendarIntegrationModal
        isOpen={showIntegrationModal}
        onClose={() => setShowIntegrationModal(false)}
        activeSourceId={activeSourceId}
        connectedSources={connectedSources}
        mergeWithDemo={mergeWithDemo}
        onSelectSource={handleSelectSource}
        onAddConnectedSource={handleAddConnectedSource}
        onRemoveConnectedSource={handleRemoveConnectedSource}
        onToggleMergeWithDemo={handleToggleMergeWithDemo}
      />

      {/* ADD CUSTOM EVENT MODAL */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-slate-900">
                Add Calendar Commitment
              </h2>
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              Routes and departure times recalculate automatically.
            </p>

            <form onSubmit={handleCreateCustomEvent} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={newEvtTitle}
                  onChange={(e) => setNewEvtTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newEvtStart}
                    onChange={(e) => setNewEvtStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newEvtEnd}
                    onChange={(e) => setNewEvtEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="virtual-toggle"
                  type="checkbox"
                  checked={newEvtVirtual}
                  onChange={(e) => setNewEvtVirtual(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <label
                  htmlFor="virtual-toggle"
                  className="text-[13px] font-medium text-slate-700"
                >
                  Remote / virtual call (no physical travel required)
                </label>
              </div>

              {!newEvtVirtual && (
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700">
                    Venue / Street Address (California)
                  </label>
                  <input
                    type="text"
                    value={newEvtLocation}
                    onChange={(e) => setNewEvtLocation(e.target.value)}
                    placeholder="e.g., Moscone Center SF, Stanford Palo Alto, Googleplex Mountain View, Santa Monica CA..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
