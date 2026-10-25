'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarEvent, Conflict, JourneyLeg, TravelMode } from '../types';
import {
  ConflictDecisionChoice,
  HomeOriginSpec,
  PlaybackSampleState,
  PlaybackTimeline,
  buildPlaybackTimeline,
  sampleTimelineAt,
} from './playback-engine';

export interface UseItineraryPlaybackOptions {
  selectedDateIso: string;
  isPastDay: boolean;
  events: CalendarEvent[];
  legs: JourneyLeg[];
  conflicts: Conflict[];
  selectedModes: Record<string, TravelMode>;
  homeOrigin?: HomeOriginSpec | null;
  bufferMinutes?: number;
  onSyncSelection?: (eventId: string | null, legId: string | null) => void;
}

export function useItineraryPlayback({
  selectedDateIso,
  isPastDay,
  events,
  legs,
  conflicts,
  selectedModes,
  homeOrigin = null,
  bufferMinutes = 5,
  onSyncSelection,
}: UseItineraryPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackTimeSeconds, setPlaybackTimeSeconds] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  // Date-scoped conflict decisions: Record<`${dateIso}:${legId}`, ConflictDecisionChoice>
  const [decisionsByDateAndLeg, setDecisionsByDateAndLeg] = useState<
    Record<string, ConflictDecisionChoice>
  >({});

  // Extract decisions for the currently active date
  const conflictDecisions = useMemo(() => {
    const prefix = `${selectedDateIso}:`;
    const scoped: Record<string, ConflictDecisionChoice> = {};
    for (const [k, v] of Object.entries(decisionsByDateAndLeg)) {
      if (k.startsWith(prefix)) {
        scoped[k.slice(prefix.length)] = v;
      }
    }
    return scoped;
  }, [decisionsByDateAndLeg, selectedDateIso]);

  // Build deterministic timeline whenever itinerary inputs or user decisions change
  const timeline: PlaybackTimeline = useMemo(
    () =>
      buildPlaybackTimeline({
        events,
        legs,
        conflicts,
        conflictDecisions,
        isPastDay,
        homeOrigin,
        bufferMinutes,
      }),
    [
      events,
      legs,
      conflicts,
      conflictDecisions,
      isPastDay,
      homeOrigin,
      bufferMinutes,
    ]
  );

  // Stop and reset playback when date changes (R10 & R11)
  const prevDateRef = useRef<string>(selectedDateIso);
  useEffect(() => {
    if (prevDateRef.current !== selectedDateIso) {
      prevDateRef.current = selectedDateIso;
      setIsPlaying(false);
      setPlaybackTimeSeconds(0);
    }
  }, [selectedDateIso]);

  // Pause and reset playback to start of updated day when route/mode changes (R10)
  const modesSignature = JSON.stringify(selectedModes);
  const prevModesSigRef = useRef<string>(modesSignature);
  useEffect(() => {
    if (prevModesSigRef.current !== modesSignature) {
      prevModesSigRef.current = modesSignature;
      setIsPlaying(false);
      setPlaybackTimeSeconds(0);
    }
  }, [modesSignature]);

  // Sample current deterministic state
  const sample: PlaybackSampleState = useMemo(
    () => sampleTimelineAt(timeline, playbackTimeSeconds, conflictDecisions),
    [timeline, playbackTimeSeconds, conflictDecisions]
  );

  // Synchronize active event/leg selection with sidebar during playback or seeking
  const lastSyncedRef = useRef<{ eventId: string | null; legId: string | null }>({
    eventId: null,
    legId: null,
  });
  useEffect(() => {
    if (!onSyncSelection) return;
    if (!isPlaying && playbackTimeSeconds === 0) return;

    const nextEventId = sample.activeEventId;
    const nextLegId = sample.activeLegId;
    if (
      lastSyncedRef.current.eventId !== nextEventId ||
      lastSyncedRef.current.legId !== nextLegId
    ) {
      lastSyncedRef.current = { eventId: nextEventId, legId: nextLegId };
      onSyncSelection(nextEventId, nextLegId);
    }
  }, [
    isPlaying,
    playbackTimeSeconds,
    sample.activeEventId,
    sample.activeLegId,
    onSyncSelection,
  ]);

  // requestAnimationFrame loop for smooth 2D playback
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaSeconds = ((now - lastFrameTimeRef.current) / 1000) * playbackSpeed;
      lastFrameTimeRef.current = now;

      setPlaybackTimeSeconds((prev) => {
        const next = prev + deltaSeconds;

        // Check if we crossed an unresolved interactive conflict decision point
        const hitDecision = timeline.decisionPoints.find(
          (dp) =>
            !conflictDecisions[dp.legId] &&
            prev < dp.playbackTimeSeconds &&
            next >= dp.playbackTimeSeconds
        );
        if (hitDecision) {
          setIsPlaying(false);
          return hitDecision.playbackTimeSeconds;
        }

        // Stop at end of timeline
        if (next >= timeline.totalPlaybackSeconds) {
          setIsPlaying(false);
          return timeline.totalPlaybackSeconds;
        }

        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isPlaying,
    playbackSpeed,
    timeline.totalPlaybackSeconds,
    timeline.decisionPoints,
    conflictDecisions,
  ]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && playbackTimeSeconds >= timeline.totalPlaybackSeconds) {
        setPlaybackTimeSeconds(0);
      }
      return !prev;
    });
  }, [playbackTimeSeconds, timeline.totalPlaybackSeconds]);

  const handleRestart = useCallback(() => {
    setIsPlaying(false);
    setPlaybackTimeSeconds(0);
  }, []);

  const handleSeekSeconds = useCallback((seconds: number) => {
    setPlaybackTimeSeconds(
      Math.max(0, Math.min(timeline.totalPlaybackSeconds, seconds))
    );
  }, [timeline.totalPlaybackSeconds]);

  const handleChooseConflictDecision = useCallback(
    (legId: string, choice: ConflictDecisionChoice) => {
      setDecisionsByDateAndLeg((prev) => ({
        ...prev,
        [`${selectedDateIso}:${legId}`]: choice,
      }));
      // Resume playback automatically after user makes an interactive decision
      setIsPlaying(true);
    },
    [selectedDateIso]
  );

  return {
    timeline,
    sample,
    isPlaying,
    playbackTimeSeconds,
    playbackSpeed,
    conflictDecisions,
    activeDecisionPrompt: sample.triggeredDecisionPoint,
    setPlaybackSpeed,
    handleTogglePlay,
    handleRestart,
    handleSeekSeconds,
    handleChooseConflictDecision,
  };
}
