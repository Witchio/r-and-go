'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Sparkles,
  TrainFront,
  Video,
  X,
} from 'lucide-react';
import {
  CalendarEvent,
  Conflict,
  GeoCoordinates,
  JourneyLeg,
  TravelMode,
} from '@/lib/types';
import {
  AddressSuggestion,
  searchLocalAddressSuggestions,
} from '@/lib/fixtures/scenarios';
import {
  diffMinutes,
  formatTimeShort,
  getEffectiveEndIso,
} from '@/lib/engine/conflict-engine';
import { HomeOriginSpec } from '@/lib/playback/playback-engine';
import { WalkingPersonIcon } from './playback/ItineraryPlaybackOverlay';

const TRAVEL_MODES_META: {
  mode: TravelMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: 'transit', label: 'Transit', Icon: TrainFront },
  { mode: 'walking', label: 'Walk', Icon: WalkingPersonIcon },
  { mode: 'driving', label: 'Drive', Icon: Car },
  { mode: 'bicycling', label: 'Bike', Icon: Bike },
];

export interface DayItineraryOverviewStripProps {
  eventsCount: number;
  legs: JourneyLeg[];
  homeLeg: JourneyLeg | null;
  homeReturnLeg?: JourneyLeg | null;
  conflictsCount: number;
}

/**
 * Compact summary strip at the top of the sidebar timeline giving an instant
 * whole-day overview of events, total travel time, and travel legs.
 */
export function DayItineraryOverviewStrip({
  eventsCount,
  legs,
  homeLeg,
  homeReturnLeg,
  conflictsCount,
}: DayItineraryOverviewStripProps) {
  const allLegs = [
    ...(homeLeg ? [homeLeg] : []),
    ...legs,
    ...(homeReturnLeg ? [homeReturnLeg] : []),
  ];
  const totalTravelMinutes = allLegs.reduce(
    (sum, leg) => sum + (leg.selectedRoute?.durationMinutes ?? 0),
    0
  );
  const totalDistanceKm = allLegs.reduce(
    (sum, leg) => sum + (leg.selectedRoute?.distanceKm ?? 0),
    0
  );

  return (
    <div className="mb-3 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {homeLeg && (
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200/80 px-1.5 py-0.5 font-bold text-teal-800">
              <Home className="h-3 w-3 text-teal-600 shrink-0" />
              <span>Home</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 font-bold text-indigo-800">
            <Calendar className="h-3 w-3 text-indigo-600 shrink-0" />
            <span>
              {eventsCount} {eventsCount === 1 ? 'Meeting' : 'Meetings'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200/80 px-1.5 py-0.5 font-bold text-sky-800">
            <Navigation className="h-3 w-3 text-sky-600 shrink-0" />
            <span>
              {allLegs.length} {allLegs.length === 1 ? 'Trip' : 'Trips'} ({totalTravelMinutes}m ·{' '}
              {totalDistanceKm.toFixed(1)} km)
            </span>
          </span>
        </div>

        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 font-bold ${
            conflictsCount > 0
              ? 'bg-rose-100 text-rose-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {conflictsCount > 0
            ? `${conflictsCount} ${conflictsCount === 1 ? 'conflict' : 'conflicts'}`
            : 'Schedule clear'}
        </span>
      </div>
    </div>
  );
}

export interface SidebarHomeLocationCardProps {
  homeOrigin: HomeOriginSpec | null;
  homeAddress: string;
  isEditingHome: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleEdit: () => void;
  onChangeAddress: (
    address: string,
    resolved?: { neighborhood: string; coordinates: GeoCoordinates }
  ) => void;
  onClearAddress: () => void;
  onRestoreDefaultAddress: () => void;
}

/**
 * COMPONENT 1A: Starting Location Card (Home / Origin Location we are at).
 * Strictly represents the physical starting location of the day, separated from the
 * morning transportation component below it.
 */
export function SidebarHomeLocationCard({
  homeOrigin,
  homeAddress,
  isEditingHome,
  isSelected,
  onSelect,
  onToggleEdit,
  onChangeAddress,
  onClearAddress,
  onRestoreDefaultAddress,
}: SidebarHomeLocationCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [hasTyped, setHasTyped] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [remoteSuggestions, setRemoteSuggestions] = useState<
    AddressSuggestion[] | null
  >(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] =
    useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset typing state and open suggestions when the user opens the editor
  useEffect(() => {
    if (isEditingHome) {
      setHasTyped(false);
      setIsDropdownOpen(true);
      setHighlightedIndex(0);
      setRemoteSuggestions(null);
    } else {
      setIsDropdownOpen(false);
    }
  }, [isEditingHome]);

  // Close dropdown when clicking outside the autocomplete box
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const effectiveQuery = hasTyped ? homeAddress : '';
  const localSuggestions = React.useMemo(
    () => searchLocalAddressSuggestions(effectiveQuery, 6),
    [effectiveQuery]
  );

  // Fetch live address suggestions from /api/geocode?autocomplete=1 when typing
  useEffect(() => {
    if (!isEditingHome || !hasTyped) {
      setRemoteSuggestions(null);
      setIsLoadingSuggestions(false);
      return;
    }
    const q = homeAddress.trim();
    if (q.length < 2) {
      setRemoteSuggestions(null);
      setIsLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?autocomplete=1&q=${encodeURIComponent(q)}`
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            suggestions?: AddressSuggestion[];
          };
          if (Array.isArray(data.suggestions)) {
            setRemoteSuggestions(data.suggestions);
          }
        }
      } catch {
        // Keep local suggestions on network error
      } finally {
        if (!cancelled) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [homeAddress, hasTyped, isEditingHome]);

  const suggestions =
    hasTyped && remoteSuggestions && remoteSuggestions.length > 0
      ? remoteSuggestions
      : localSuggestions;

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    onChangeAddress(suggestion.address, {
      neighborhood: suggestion.neighborhood,
      coordinates: suggestion.coordinates,
    });
    setHasTyped(false);
    setIsDropdownOpen(false);
  };

  if (!homeOrigin) {
    return (
      <div className="relative mb-3">
        <span className="absolute -left-[16px] top-2.5 h-3 w-3 rounded-full bg-teal-400 ring-4 ring-white" />
        <button
          type="button"
          onClick={onRestoreDefaultAddress}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 px-3 py-2 text-[12px] font-semibold text-teal-800 hover:border-teal-400 hover:bg-teal-50 transition-colors cursor-pointer"
        >
          <Home className="h-3.5 w-3.5 text-teal-600" />
          <span>+ Set morning Home starting location</span>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={`relative mb-2 rounded-xl border border-l-4 p-3 transition-all cursor-pointer ${
        isSelected
          ? 'border-teal-600 border-l-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20 shadow-xs'
          : 'border-teal-200/90 border-l-teal-600 bg-gradient-to-r from-teal-50/70 via-teal-50/25 to-white hover:border-teal-300 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
      }`}
    >
      {/* Home Base Spine Node Badge */}
      <span
        className={`absolute -left-[22px] top-3.5 flex h-5 w-5 items-center justify-center rounded-full ring-3 ring-white shadow-2xs ${
          isSelected
            ? 'bg-teal-700 text-white'
            : 'bg-teal-600 text-white'
        }`}
      >
        <Home className="h-3 w-3" />
      </span>

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs">
            <Home className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-teal-100/90 border border-teal-300/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-teal-900">
                Home Base · Start
              </span>
              <h3 className="text-[14px] font-extrabold text-slate-900 truncate">
                {homeOrigin.neighborhood}
              </h3>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-teal-950/75 truncate">
              <MapPin className="h-3 w-3 shrink-0 text-teal-600" />
              <span className="truncate">{homeOrigin.address}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleEdit();
          }}
          title="Edit starting location address"
          className="flex items-center gap-1 rounded-lg border border-teal-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 hover:text-teal-950 transition-colors cursor-pointer shrink-0"
        >
          <Pencil className="h-3 w-3" />
          <span>{isEditingHome ? 'Done' : 'Edit'}</span>
        </button>
      </div>

      {isEditingHome && (
        <div
          ref={containerRef}
          onClick={(e) => e.stopPropagation()}
          className="relative mt-2.5 border-t border-slate-200/80 pt-2.5"
        >
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Starting Location Address
          </label>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500" />
              <input
                type="text"
                role="combobox"
                aria-expanded={isDropdownOpen && suggestions.length > 0}
                aria-autocomplete="list"
                aria-controls="home-address-suggestions-listbox"
                aria-label="Home starting point address"
                value={homeAddress}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setHasTyped(true);
                  setIsDropdownOpen(true);
                  setHighlightedIndex(0);
                  onChangeAddress(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    setIsDropdownOpen(true);
                    return;
                  }
                  if (e.key === 'ArrowDown' && suggestions.length > 0) {
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                      prev + 1 < suggestions.length ? prev + 1 : 0
                    );
                  } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                      prev - 1 >= 0 ? prev - 1 : suggestions.length - 1
                    );
                  } else if (e.key === 'Enter') {
                    if (isDropdownOpen && suggestions[highlightedIndex]) {
                      e.preventDefault();
                      handleSelectSuggestion(suggestions[highlightedIndex]);
                    }
                  } else if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
                placeholder="Search street address, hotel, or neighborhood..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-7 py-1.5 text-[12px] text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none"
              />
              {isLoadingSuggestions ? (
                <Loader2 className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : homeAddress ? (
                <button
                  type="button"
                  title="Clear input to search another address"
                  onClick={() => {
                    setHasTyped(true);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(0);
                    onChangeAddress('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClearAddress}
              className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              Remove
            </button>
          </div>

          {/* Autocomplete Matching Addresses Dropdown */}
          {isDropdownOpen && suggestions.length > 0 && (
            <ul
              id="home-address-suggestions-listbox"
              role="listbox"
              aria-label="Matching addresses"
              className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
            >
              <li className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>
                  {hasTyped && homeAddress.trim()
                    ? 'Matching Addresses'
                    : 'Suggested Starting Locations'}
                </span>
                <span className="font-normal text-slate-400">Click to select</span>
              </li>
              {suggestions.map((suggestion, index) => {
                const isHighlighted = index === highlightedIndex;
                const isCurrent =
                  homeOrigin.address.toLowerCase() ===
                  suggestion.address.toLowerCase();

                return (
                  <li
                    key={suggestion.id}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      // Prevent input blur before selection fires
                      e.preventDefault();
                      handleSelectSuggestion(suggestion);
                    }}
                    className={`flex items-start gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'bg-indigo-50/90 text-slate-900'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        isHighlighted || isCurrent
                          ? 'text-indigo-600'
                          : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[12px] font-semibold text-slate-900 truncate">
                          {suggestion.primaryText}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {suggestion.neighborhood}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {suggestion.secondaryText}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export interface SidebarEventLocationCardProps {
  event: CalendarEvent;
  stopIndex: number;
  isSelected: boolean;
  missingLocConflict?: Conflict;
  isResolutionDrawerOpen: boolean;
  googleCalendarUrl: string;
  onSelect: () => void;
  onTriggerMissingLocationResolve: (conflictId: string) => void;
  renderInlineResolutionDrawer: (conflict: Conflict) => React.ReactNode;
}

/**
 * COMPONENT 1B: Event / Location Card ("the event/location we are at").
 * Displays the event commitment, start/end times, duration at location,
 * physical venue/neighborhood, and phase breakdown.
 */
export function SidebarEventLocationCard({
  event,
  stopIndex,
  isSelected,
  missingLocConflict,
  isResolutionDrawerOpen,
  googleCalendarUrl,
  onSelect,
  onTriggerMissingLocationResolve,
  renderInlineResolutionDrawer,
}: SidebarEventLocationCardProps) {
  const effectiveEnd = getEffectiveEndIso(event);
  const wasShortened = Boolean(
    event.effectiveEnd && event.effectiveEnd !== event.end
  );
  const durationMinutes = Math.max(0, diffMinutes(event.start, effectiveEnd));

  const leftBorderAccent = missingLocConflict
    ? 'border-l-amber-500'
    : event.appliedResolutionId
    ? 'border-l-emerald-600'
    : 'border-l-indigo-600';

  return (
    <div
      onClick={onSelect}
      data-testid={`sidebar-location-card-${event.id}`}
      className={`relative mb-2 rounded-xl border border-l-4 p-3.5 transition-all cursor-pointer ${leftBorderAccent} ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50/25 ring-2 ring-indigo-500/20 shadow-xs'
          : 'border-slate-200/95 bg-white hover:border-slate-300 shadow-[0_2px_6px_rgba(15,23,42,0.04)]'
      }`}
    >
      {/* Numbered Meeting Stop Badge on Timeline Spine */}
      <span
        className={`absolute -left-[22px] top-4 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white ring-3 ring-white shadow-2xs ${
          missingLocConflict
            ? 'bg-amber-500'
            : event.appliedResolutionId
            ? 'bg-emerald-600'
            : isSelected
            ? 'bg-indigo-700'
            : 'bg-indigo-600'
        }`}
      >
        {stopIndex}
      </span>

      <div className="flex items-start gap-3">
        {/* Left Structured Time Pill Column */}
        <div className="w-[74px] shrink-0 rounded-lg border border-indigo-100/90 bg-indigo-50/50 px-2 py-1.5 text-center text-[12px] leading-tight">
          <div className="font-extrabold text-indigo-950">
            {formatTimeShort(event.start)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
            {wasShortened ? (
              <span className="text-emerald-700 font-semibold">
                → {formatTimeShort(effectiveEnd)}
              </span>
            ) : (
              formatTimeShort(effectiveEnd)
            )}
          </div>
          <div className="mt-1 inline-block rounded bg-white/90 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
            {durationMinutes}m stay
          </div>
        </div>

        {/* Right Event & Location Details Column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100/80 border border-indigo-200/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">
              <Calendar className="h-3 w-3 text-indigo-600 shrink-0" />
              <span>Meeting · Stop {stopIndex}</span>
            </span>

            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in Google Calendar"
              className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <h3 className="text-[15px] font-extrabold text-slate-900 leading-snug truncate">
            {event.title}
          </h3>

          {/* Location / Venue / Virtual Row */}
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
            {event.isVirtual ? (
              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                <Video className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>Remote video call (No travel required)</span>
              </span>
            ) : event.location && event.location.trim() ? (
              <div className="flex items-start gap-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-600 mt-0.5" />
                <div className="min-w-0">
                  {event.neighborhood && (
                    <span className="font-semibold text-slate-800">
                      {event.neighborhood}
                    </span>
                  )}
                  {event.neighborhood &&
                    event.location &&
                    event.location !== event.neighborhood && (
                      <span className="text-slate-400"> · </span>
                    )}
                  {(!event.neighborhood ||
                    event.location !== event.neighborhood) && (
                    <span className="text-slate-500 truncate">
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (missingLocConflict) {
                    onTriggerMissingLocationResolve(missingLocConflict.id);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>Location missing · Resolve with Argon →</span>
              </button>
            )}
          </div>

          {/* Compact Phase Chips */}
          {event.phases && event.phases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {event.phases.map((p, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    p.optionality === 'optional'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p.label} ({formatTimeShort(p.start)}–{formatTimeShort(p.end)} ·{' '}
                  {p.optionality})
                </span>
              ))}
            </div>
          )}

          {wasShortened && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              <span>
                Departing at {formatTimeShort(effectiveEnd)} after required program
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Inline Resolution Drawer for Missing Location on this Event */}
      {missingLocConflict && isResolutionDrawerOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          {renderInlineResolutionDrawer(missingLocConflict)}
        </div>
      )}
    </div>
  );
}

export interface SidebarTransportationCardProps {
  leg: JourneyLeg;
  conflict?: Conflict;
  isSelected: boolean;
  isResolutionDrawerOpen: boolean;
  isMorningCommute?: boolean;
  isEveningReturn?: boolean;
  onSelect: () => void;
  onChangeMode: (mode: TravelMode) => void;
  onTriggerConflictResolve?: (conflictId: string) => void;
  renderInlineResolutionDrawer?: (conflict: Conflict) => React.ReactNode;
}

/**
 * COMPONENT 2: Dedicated Transportation Card ("shows the transportation").
 * Displays the travel method switcher (Transit, Walk, Drive, Bike with durations),
 * departure time, arrival estimate, travel duration/distance, route summary, and any route conflicts.
 */
export function SidebarTransportationCard({
  leg,
  conflict,
  isSelected,
  isResolutionDrawerOpen,
  isMorningCommute = false,
  isEveningReturn = false,
  onSelect,
  onChangeMode,
  onTriggerConflictResolve,
  renderInlineResolutionDrawer,
}: SidebarTransportationCardProps) {
  const SelectedModeIcon =
    TRAVEL_MODES_META.find((m) => m.mode === leg.selectedMode)?.Icon ||
    TrainFront;

  const hasConflict = Boolean(conflict);
  const isOverlap = conflict?.type === 'overlap' || leg.availableWindowMinutes < 0;

  return (
    <div
      onClick={onSelect}
      data-testid={`sidebar-transport-card-${leg.id}`}
      className={`relative my-2 ml-4 rounded-xl border border-dashed p-2.5 transition-all cursor-pointer ${
        hasConflict
          ? isSelected
            ? 'border-2 border-rose-500 bg-rose-50/75 ring-2 ring-rose-500/15 shadow-2xs'
            : 'border-rose-300 bg-rose-50/50 hover:border-rose-400'
          : isSelected
          ? 'border-2 border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/15 shadow-2xs'
          : 'border-sky-300/90 bg-sky-50/40 hover:border-sky-400 hover:bg-sky-50/60'
      }`}
    >
      {/* Horizontal Dashed Branch from Spine to Indented Travel Card */}
      <span
        className={`pointer-events-none absolute -left-[16px] top-1/2 -translate-y-1/2 w-4 border-t-2 border-dashed ${
          hasConflict ? 'border-rose-400' : 'border-sky-400'
        }`}
      />

      {/* Timeline Connector Badge on Spine */}
      <span
        className={`absolute -left-[36px] top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white shadow-2xs ${
          hasConflict
            ? 'bg-rose-600 text-white'
            : isSelected
            ? 'bg-sky-700 text-white'
            : 'bg-sky-100 text-sky-700 border border-sky-300'
        }`}
      >
        <SelectedModeIcon className="h-3 w-3" />
      </span>

      {/* ROW 1: Transportation Header + Departure & Arrival Times + Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
              hasConflict
                ? 'bg-rose-600 text-white'
                : 'bg-sky-600 text-white'
            }`}
          >
            <SelectedModeIcon className="h-3 w-3 shrink-0" />
            <span>
              {isMorningCommute
                ? 'Travel · Morning Commute'
                : isEveningReturn
                ? 'Travel · Return Home'
                : 'Travel Leg'}
            </span>
          </span>

          {leg.selectedRoute && (
            <span className="text-[12px] font-extrabold text-slate-900 shrink-0">
              {leg.selectedRoute.durationMinutes} min
            </span>
          )}

          {leg.selectedRoute && (
            <span className="text-[11px] font-semibold text-sky-900/60 truncate">
              · {leg.selectedRoute.distanceKm} km
            </span>
          )}
        </div>

        {/* Right Status Pill / Conflict Resolve Trigger */}
        {conflict && onTriggerConflictResolve ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTriggerConflictResolve(conflict.id);
            }}
            className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 shadow-2xs hover:bg-rose-50 cursor-pointer"
          >
            <Sparkles className="h-3 w-3 text-indigo-600" />
            <span>{isResolutionDrawerOpen ? 'Hide' : 'Resolve'}</span>
          </button>
        ) : leg.selectedRoute ? (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
              isEveningReturn || (leg.slackMinutes ?? 0) >= 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                : 'bg-amber-50 text-amber-800 border border-amber-200/70'
            }`}
          >
            {isEveningReturn
              ? 'End of day'
              : (leg.slackMinutes ?? 0) >= 0
              ? `+${leg.slackMinutes ?? 0}m buffer`
              : `${leg.slackMinutes}m short`}
          </span>
        ) : null}
      </div>

      {/* ROW 2: Departure Time → Arrival Time & Route Summary */}
      {leg.selectedRoute ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/95 border border-sky-200/70 px-2.5 py-1.5 text-[12px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span>
              Depart{' '}
              <strong className="font-bold text-slate-900">
                {leg.recommendedLeaveIso
                  ? formatTimeShort(leg.recommendedLeaveIso)
                  : 'N/A'}
              </strong>
            </span>
            <ArrowRight className="h-3 w-3 text-sky-500 shrink-0" />
            <span>
              Arrive{' '}
              <strong className="font-bold text-slate-900">
                {leg.arrivalEstimateIso
                  ? formatTimeShort(leg.arrivalEstimateIso)
                  : formatTimeShort(leg.toEvent.start)}
              </strong>
            </span>
          </div>

          <span className="text-[11px] font-medium text-slate-500 truncate max-w-[160px]">
            {leg.selectedRoute.summary}
          </span>
        </div>
      ) : (
        <div className="mt-1.5 rounded-lg bg-amber-50/80 border border-amber-200/70 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
          {isEveningReturn
            ? 'Resolve preceding event venue to calculate return-home departure & arrival time.'
            : 'Destination address needed to calculate departure & travel time.'}
        </div>
      )}

      {/* ROW 3: Conflict Warning Summary (when conflicted) */}
      {conflict && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-rose-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
          <span className="truncate">
            {isOverlap ? (
              <>
                <strong className="font-bold">
                  {Math.abs(leg.availableWindowMinutes)}m schedule overlap
                </strong>{' '}
                before {leg.toEvent.title}
              </>
            ) : (
              <>
                <strong className="font-bold">
                  {leg.availableWindowMinutes}m window
                </strong>{' '}
                for {leg.selectedRoute?.durationMinutes ?? '?'}m {leg.selectedMode}{' '}
                (+{leg.bufferMinutes}m buffer)
              </>
            )}
          </span>
        </div>
      )}

      {/* ROW 4: Interactive Travel Method Switcher (All 4 Modes & Travel Times at a glance) */}
      {leg.alternatives.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 grid grid-cols-4 gap-1"
        >
          {TRAVEL_MODES_META.map(({ mode, label, Icon }) => {
            const option = leg.alternatives.find((a) => a.mode === mode);
            const isModeSelected = leg.selectedMode === mode;
            const fitsWindow =
              option &&
              leg.availableWindowMinutes >=
                option.durationMinutes + leg.bufferMinutes;

            return (
              <button
                key={mode}
                type="button"
                disabled={!option}
                onClick={() => onChangeMode(mode)}
                title={
                  option
                    ? `${label}: ${option.durationMinutes} min (${option.summary})`
                    : `${label} unavailable`
                }
                className={`flex items-center justify-center gap-1 rounded-lg py-1 px-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  isModeSelected
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-sky-200/80 hover:border-sky-300 hover:text-slate-900'
                } ${!option ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {option ? `${option.durationMinutes}m` : label}
                </span>
                {!isModeSelected && option && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      fitsWindow ? 'bg-emerald-500' : 'bg-rose-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline Argon Resolution Drawer when expanded */}
      {conflict && isResolutionDrawerOpen && renderInlineResolutionDrawer && (
        <div onClick={(e) => e.stopPropagation()}>
          {renderInlineResolutionDrawer(conflict)}
        </div>
      )}
    </div>
  );
}

export interface SidebarHomeDestinationCardProps {
  homeOrigin: HomeOriginSpec | null;
  homeReturnLeg: JourneyLeg | null;
  isSelected: boolean;
  onSelect: () => void;
  onEditHomeClick: () => void;
}

/**
 * COMPONENT 1C: Final Destination Location Card (Automatic Return Home at End of Day).
 * Displays the user's home location as the final destination of the day along with
 * estimated arrival time back home.
 */
export function SidebarHomeDestinationCard({
  homeOrigin,
  homeReturnLeg,
  isSelected,
  onSelect,
  onEditHomeClick,
}: SidebarHomeDestinationCardProps) {
  if (!homeOrigin) return null;

  const arrivalLabel = homeReturnLeg?.arrivalEstimateIso
    ? formatTimeShort(homeReturnLeg.arrivalEstimateIso)
    : null;

  return (
    <div
      onClick={onSelect}
      data-testid="sidebar-location-card-evt-home-return"
      className={`relative mb-2 rounded-xl border border-l-4 p-3 transition-all cursor-pointer ${
        isSelected
          ? 'border-teal-600 border-l-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20 shadow-xs'
          : 'border-teal-200/90 border-l-teal-600 bg-gradient-to-r from-teal-50/70 via-teal-50/25 to-white hover:border-teal-300 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
      }`}
    >
      {/* Final Destination Home Spine Badge */}
      <span
        className={`absolute -left-[22px] top-3.5 flex h-5 w-5 items-center justify-center rounded-full ring-3 ring-white shadow-2xs ${
          isSelected ? 'bg-teal-700 text-white' : 'bg-teal-600 text-white'
        }`}
      >
        <Home className="h-3 w-3" />
      </span>

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs">
            <Home className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-teal-100/90 border border-teal-300/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-teal-900">
                Home Base · End of Day
              </span>
              <h3 className="text-[14px] font-extrabold text-slate-900 truncate">
                {homeOrigin.neighborhood}
              </h3>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-teal-950/75 truncate">
              <MapPin className="h-3 w-3 shrink-0 text-teal-600" />
              <span className="truncate">{homeOrigin.address}</span>
            </div>
            {arrivalLabel && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/90 border border-teal-200/80 px-2 py-0.5 text-[11px] font-bold text-teal-900">
                <Clock className="h-3 w-3 text-teal-600 shrink-0" />
                <span>Arrive home at {arrivalLabel}</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditHomeClick();
          }}
          title="Edit home address"
          className="flex items-center gap-1 rounded-lg border border-teal-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 hover:text-teal-950 transition-colors cursor-pointer shrink-0"
        >
          <Pencil className="h-3 w-3" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}
