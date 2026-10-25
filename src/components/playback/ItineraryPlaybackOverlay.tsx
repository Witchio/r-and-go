'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CalendarCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  Home,
  Pause,
  Play,
  RotateCcw,
  TrainFront,
  Video,
} from 'lucide-react';
import {
  ConflictDecisionChoice,
  MapViewportBounds,
  PlaybackDecisionPoint,
  PlaybackSampleState,
  PlaybackSegment,
  PlaybackTimeline,
  TravelerActivityMode,
  projectLatLngToSvgSubpixel,
} from '@/lib/playback/playback-engine';

/**
 * Crisp Walking Person SVG icon for walking segments.
 */
export function WalkingPersonIcon({
  className = 'h-4 w-4',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="13" cy="4.5" r="2" />
      <path d="M10 21l2-6.5-2-2.5 2-4.5" />
      <path d="M15.5 21l-1.8-5.5" />
      <path d="M7.5 11.5l3.5-3 2.5 1 3.5 2" />
    </svg>
  );
}

/**
 * Pure SVG vector glyph centered at (0, 0) for rendering inside the animated map traveler orb.
 */
function TravelerSvgGlyph({
  mode,
  isHome = false,
  scale = 1,
}: {
  mode: TravelerActivityMode;
  isHome?: boolean;
  scale?: number;
}) {
  return (
    <g transform={`scale(${scale}) translate(-12, -12)`}>
      {mode === 'walking' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="13" cy="4.5" r="2.1" fill="#ffffff" stroke="none" />
          <path d="M9.5 20.5l2.3-6.5-2-2.5 2.2-4.3" />
          <path d="M15.8 20.5l-2-5.3" />
          <path d="M7.5 11.5l3.7-3.2 2.6 1 3.4 2.2" />
        </g>
      ) : mode === 'bicycling' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="6.5" cy="16.5" r="3.2" />
          <circle cx="17.5" cy="16.5" r="3.2" />
          <path d="M6.5 16.5L10 10.5h4.5l-2.5 6H6.5z" />
          <path d="M14.5 10.5l3 6" />
          <path d="M8.8 10.5h2.4" />
          <path d="M13.5 8h2.5" />
        </g>
      ) : mode === 'transit' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="6" y="4" width="12" height="13" rx="3" />
          <path d="M6 11h12" />
          <path d="M9 7.5h6" />
          <circle cx="9" cy="14" r="1" fill="#ffffff" stroke="none" />
          <circle cx="15" cy="14" r="1" fill="#ffffff" stroke="none" />
          <path d="M8 17l-2 3" />
          <path d="M16 17l2 3" />
        </g>
      ) : mode === 'driving' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l2-5.2A2 2 0 0 1 8.9 6.5h6.2a2 2 0 0 1 1.9 1.3L19 13" />
          <rect x="4" y="13" width="16" height="5" rx="1.8" />
          <circle cx="7.5" cy="18.5" r="1.6" fill="#ffffff" />
          <circle cx="16.5" cy="18.5" r="1.6" fill="#ffffff" />
        </g>
      ) : mode === 'waiting' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8v4.2l2.8 1.8" />
        </g>
      ) : mode === 'virtual' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="7" width="11" height="10" rx="2" />
          <path d="M15 10.5l5-2.5v8l-5-2.5v-3z" />
        </g>
      ) : mode === 'unavailable' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4.5L3.8 19h16.4L12 4.5z" />
          <path d="M12 10v4" />
          <circle cx="12" cy="16.8" r="0.9" fill="#ffffff" stroke="none" />
        </g>
      ) : isHome ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 11.5L12 5l7.5 6.5" />
          <path d="M6.5 10.2V19h11v-8.8" />
        </g>
      ) : (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="5.5" width="14" height="13.5" rx="2.2" />
          <path d="M8.5 3.8v3.2" />
          <path d="M15.5 3.8v3.2" />
          <path d="M5 10h14" />
          <path d="M9.5 14.5l1.8 1.8 3.4-3.4" />
        </g>
      )}
    </g>
  );
}

/**
 * Strict 4-Token Semantic Color Palette:
 * - Coral/Amber (#e11d48 / #d97706): Conflicts, missing data, or waiting
 * - Brand Indigo (#4f46e5): Active movement (Transit / Driving / Biking / Walking)
 * - Slate (#1e293b / #475569): Stationary at venue / Home / Virtual
 */
export function getModeColor(
  mode: TravelerActivityMode,
  isConflictFlagged = false
): string {
  if (isConflictFlagged || mode === 'unavailable') return '#e11d48'; // Semantic Danger Coral
  if (mode === 'waiting') return '#d97706'; // Semantic Warning Amber
  if (
    mode === 'transit' ||
    mode === 'driving' ||
    mode === 'bicycling' ||
    mode === 'walking'
  ) {
    return '#4f46e5'; // Brand Indigo for active travel
  }
  return '#1e293b'; // Neutral Slate for stationary at event / home / virtual
}

export function getModeLabel(
  mode: TravelerActivityMode,
  segment?: PlaybackSegment | null
): string {
  if (segment?.eventId === 'evt-home-origin' && mode === 'at_event') {
    return 'Home';
  }
  switch (mode) {
    case 'walking':
      return 'Walking';
    case 'bicycling':
      return 'Biking';
    case 'transit':
      return segment?.vehicleLabel ? `Transit (${segment.vehicleLabel})` : 'Transit';
    case 'driving':
      return 'Driving';
    case 'waiting':
      return 'Waiting';
    case 'virtual':
      return 'Remote';
    case 'unavailable':
      return 'Address Needed';
    case 'at_event':
    default:
      return 'In Session';
  }
}

export function ModeIcon({
  mode,
  isHome = false,
  className = 'h-4 w-4',
}: {
  mode: TravelerActivityMode;
  isHome?: boolean;
  className?: string;
}) {
  switch (mode) {
    case 'walking':
      return <WalkingPersonIcon className={className} />;
    case 'waiting':
      return <Clock className={className} />;
    case 'transit':
      return <TrainFront className={className} />;
    case 'driving':
      return <Car className={className} />;
    case 'bicycling':
      return <Bike className={className} />;
    case 'virtual':
      return <Video className={className} />;
    case 'unavailable':
      return <AlertTriangle className={className} />;
    case 'at_event':
    default:
      return isHome ? (
        <Home className={className} />
      ) : (
        <CalendarCheck className={className} />
      );
  }
}

interface TravelerSvgProps {
  timeline?: PlaybackTimeline;
  sample: PlaybackSampleState | null;
  isPlaying: boolean;
  bounds?: MapViewportBounds;
}

export function ItineraryPlaybackSvgTraveler({
  timeline,
  sample,
  isPlaying,
  bounds,
}: TravelerSvgProps) {
  if (!sample || !sample.activeSegment) return null;

  const effectiveBounds = bounds || timeline?.viewportBounds;

  const {
    activeSegment,
    svgPoint,
    travelerMode,
    isConflictFlagged,
    isLateArrival,
  } = sample;

  const isHome = activeSegment.eventId === 'evt-home-origin';

  const subStepSvgPath =
    activeSegment.pathCoordinates.length >= 2
      ? activeSegment.pathCoordinates
          .map(([lat, lng], idx) => {
            const pt = projectLatLngToSvgSubpixel({ lat, lng }, effectiveBounds);
            return `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
          })
          .join(' ')
      : '';

  if (!svgPoint) return null;

  const badgeColor = getModeColor(travelerMode, isConflictFlagged);
  const modeReadable = getModeLabel(travelerMode, activeSegment);

  const statusPillText = `${sample.simulatedClockLabel} · ${modeReadable}`;
  const pillWidth = Math.max(138, statusPillText.length * 7.2 + 42);

  return (
    <g className="pointer-events-none">
      {subStepSvgPath && (
        <path
          d={subStepSvgPath}
          fill="none"
          stroke={badgeColor}
          strokeWidth="6"
          strokeDasharray={
            travelerMode === 'walking'
              ? '5 6'
              : travelerMode === 'bicycling'
              ? '9 5'
              : undefined
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
      )}

      <g transform={`translate(${svgPoint.x}, ${svgPoint.y})`}>
        <circle
          cx={0}
          cy={0}
          r={isPlaying ? 30 : 24}
          fill={badgeColor}
          opacity={0.18}
        />
        <circle cx={0} cy={0} r={19} fill="#ffffff" />
        <circle
          cx={0}
          cy={0}
          r={15.5}
          fill={badgeColor}
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        <TravelerSvgGlyph mode={travelerMode} isHome={isHome} scale={1.08} />

        <g transform={`translate(${-pillWidth / 2}, -50)`}>
          <rect
            width={pillWidth}
            height="26"
            rx="13"
            fill={isLateArrival ? '#e11d48' : '#0f172a'}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <circle cx="14" cy="13" r="8.5" fill={badgeColor} />
          <g transform="translate(14, 13)">
            <TravelerSvgGlyph mode={travelerMode} isHome={isHome} scale={0.62} />
          </g>
          <text
            x={(pillWidth + 20) / 2}
            y="17"
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="11"
            fontWeight="700"
            fill="#ffffff"
          >
            {statusPillText}
          </text>
        </g>
      </g>
    </g>
  );
}

interface PlaybackControlsBarProps {
  timeline: PlaybackTimeline;
  sample: PlaybackSampleState;
  isPlaying: boolean;
  playbackSpeed: number;
  conflictDecisions: Record<string, ConflictDecisionChoice>;
  activeDecisionPrompt: PlaybackDecisionPoint | null;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeekSeconds: (seconds: number) => void;
  onChangeSpeed: (speed: number) => void;
  onChooseConflictDecision: (
    legId: string,
    choice: ConflictDecisionChoice
  ) => void;
}

/**
 * Streamlined 2D Itinerary Playback Bar (Item #5 & #10).
 * Compact single-line pill at rest; expands segment icons & active detail when playing or toggled.
 */
export function ItineraryPlaybackControlsBar({
  timeline,
  sample,
  isPlaying,
  playbackSpeed,
  conflictDecisions,
  activeDecisionPrompt,
  onTogglePlay,
  onRestart,
  onSeekSeconds,
  onChangeSpeed,
  onChooseConflictDecision,
}: PlaybackControlsBarProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const { activeSegment } = sample;
  const hasPlayableSegments =
    timeline.segments.length > 0 && timeline.totalPlaybackSeconds > 0;

  const isExpanded =
    manualExpanded || isPlaying || sample.playbackTimeSeconds > 0.05;

  const activeIsHome = activeSegment?.eventId === 'evt-home-origin';
  const activeModeColor = getModeColor(
    sample.travelerMode,
    sample.isConflictFlagged
  );
  const activeModeLabel = getModeLabel(sample.travelerMode, activeSegment);

  return (
    <div className="pointer-events-auto relative flex flex-col gap-2 w-full max-w-[500px]">
      {/* Interactive Conflict Decision Prompt */}
      {activeDecisionPrompt && (
        <div className="rounded-2xl border border-amber-400/80 bg-slate-900/95 p-4 text-white shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="text-[11px] font-semibold text-amber-300">
                Departure Decision · {activeDecisionPrompt.decisionTimeLabel}
              </div>
              <h4 className="text-[13px] font-bold text-white">
                Leave {activeDecisionPrompt.fromEventTitle} now or stay until{' '}
                {activeDecisionPrompt.scheduledEndLabel}?
              </h4>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChooseConflictDecision(
                  activeDecisionPrompt.legId,
                  'leave_on_time'
                )
              }
              className="flex flex-col items-start rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-left transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1 text-[12px] font-semibold text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Leave at {activeDecisionPrompt.decisionTimeLabel}
              </span>
              <span className="text-[11px] text-emerald-100">
                Arrive on time for {activeDecisionPrompt.toEventTitle}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChooseConflictDecision(
                  activeDecisionPrompt.legId,
                  'stay_until_end'
                )
              }
              className="flex flex-col items-start rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-left transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1 text-[12px] font-semibold text-amber-300">
                <Clock className="h-3.5 w-3.5" />
                Stay until {activeDecisionPrompt.scheduledEndLabel}
              </span>
              <span className="text-[11px] text-slate-300">
                Arrive {activeDecisionPrompt.lateArrivalMinutesIfStay}m late
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Floating Playback Pill / Deck */}
      <div className="rounded-2xl bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.14)] border border-slate-200/80">
        {/* Primary Single-Row Bar */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!hasPlayableSegments}
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 text-[12px] font-semibold text-white shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>
                  {sample.playbackTimeSeconds > 0 &&
                  sample.playbackTimeSeconds < timeline.totalPlaybackSeconds
                    ? 'Resume'
                    : 'Play day'}
                </span>
              </>
            )}
          </button>

          {sample.playbackTimeSeconds > 0 && (
            <button
              type="button"
              onClick={onRestart}
              title="Restart from morning"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Simulated Clock Pill */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-white shrink-0">
            <span
              style={{ backgroundColor: activeModeColor }}
              className="flex h-4 w-4 items-center justify-center rounded text-white"
            >
              <ModeIcon
                mode={sample.travelerMode}
                isHome={activeIsHome}
                className="h-3 w-3"
              />
            </span>
            <span className="font-mono text-[12px] font-semibold tracking-tight">
              {sample.simulatedClockLabel}
            </span>
          </div>

          {/* Inline Range Scrubber */}
          <div className="relative flex-1 flex items-center min-w-[80px]">
            <input
              type="range"
              min={0}
              max={timeline.totalPlaybackSeconds || 1}
              step={0.05}
              value={sample.playbackTimeSeconds}
              onChange={(e) => onSeekSeconds(parseFloat(e.target.value))}
              aria-label="Itinerary playback timeline scrubber"
              className="w-full h-1.5 accent-indigo-600 bg-slate-200 rounded-lg cursor-pointer"
            />
            {timeline.decisionPoints.map((dp) => {
              const leftPct =
                timeline.totalPlaybackSeconds > 0
                  ? (dp.playbackTimeSeconds / timeline.totalPlaybackSeconds) * 100
                  : 0;
              const choice = conflictDecisions[dp.legId];
              return (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => onSeekSeconds(dp.playbackTimeSeconds)}
                  title={`Decision at ${dp.decisionTimeLabel}`}
                  style={{ left: `${leftPct}%` }}
                  className={`absolute -top-1 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-white shadow-2xs cursor-pointer ${
                    choice === 'leave_on_time' ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                />
              );
            })}
          </div>

          {/* Speed Selector */}
          <button
            type="button"
            onClick={() =>
              onChangeSpeed(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)
            }
            title="Cycle playback speed"
            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 shrink-0 cursor-pointer"
          >
            {playbackSpeed}x
          </button>

          {/* Expand / Collapse Segment Strip Toggle */}
          <button
            type="button"
            onClick={() => setManualExpanded((v) => !v)}
            title={isExpanded ? 'Collapse timeline strip' : 'Expand timeline strip'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Progressive Disclosure: Segment Icon Strip & Active Leg Detail */}
        {isExpanded && hasPlayableSegments && (
          <div className="mt-2.5 border-t border-slate-100 pt-2">
            <div
              className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar"
              aria-label="Itinerary portions by activity mode"
            >
              {timeline.segments.map((seg) => {
                const isActive = activeSegment?.id === seg.id;
                const isPastSeg =
                  sample.playbackTimeSeconds >= seg.playbackEndSeconds;
                const isHomeSeg = seg.eventId === 'evt-home-origin';
                const segColor = getModeColor(
                  seg.travelerMode,
                  seg.isConflictFlagged
                );
                const flexWeight = Math.max(
                  1,
                  Math.round(seg.playbackDurationSeconds * 10)
                );

                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() =>
                      onSeekSeconds(
                        Math.min(
                          timeline.totalPlaybackSeconds,
                          seg.playbackStartSeconds + 0.02
                        )
                      )
                    }
                    style={{
                      flexGrow: flexWeight,
                      backgroundColor: isActive ? segColor : undefined,
                    }}
                    title={`${getModeLabel(seg.travelerMode, seg)}: ${seg.label} (${seg.realDurationMinutes} min)`}
                    className={`flex h-6 min-w-[24px] items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'text-white shadow-2xs'
                        : isPastSeg
                        ? 'bg-slate-200/80 text-slate-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                    }`}
                  >
                    <ModeIcon
                      mode={seg.travelerMode}
                      isHome={isHomeSeg}
                      className="h-3 w-3 shrink-0"
                    />
                    {isActive && (
                      <span className="truncate max-w-[72px] text-[10px] font-semibold leading-none">
                        {getModeLabel(seg.travelerMode, seg)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="truncate">
                <strong className="font-semibold text-slate-900">
                  {activeSegment?.label || 'Ready'}
                </strong>
                {activeSegment?.sublabel && (
                  <span className="text-slate-500"> · {activeSegment.sublabel}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeSegment?.isAcceleratedEvent && (
                  <span className="inline-flex items-center gap-0.5 text-indigo-600 font-semibold">
                    <FastForward className="h-3 w-3" />
                    {sample.clockAccelerationFactor}x
                  </span>
                )}
                {sample.isLateArrival && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700 border border-rose-200">
                    Late +{sample.lateByMinutes}m
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
