# Argon Calendar Travel Planner — PRD & Implementation Plan

## New requirements — October 25, 2026
- **R10: Animated 2D itinerary playback.** Play a selected day on the existing map with a moving traveler, selected transport modes, event stops, playback controls, and synchronized itinerary timing.
- **R11: Previous-day browsing and replay.** Navigate to past calendar dates and view their events, routes, conflicts, and playback. Reconstructed route estimates must not be presented as recorded travel history.
- Full behavior, implementation guidance, and acceptance criteria: [Requirement addendum](argon_calendar_handover/docs/06-itinerary-playback-and-history.md).
- These are pending additions to the current build. Read alongside the [main PRD](argon_calendar_handover/docs/01-product-requirements.md); preserve existing working integrations.

See full interactive plan and architecture review.

## Summary of Architecture & Build Phases
1. **Phase 0 — Project Setup & Deterministic Conflict Engine**: Next.js App Router + TypeScript + Tailwind CSS; deterministic `leave_by` calculation (`next_event_start - buffer - travel_duration`), overlap/travel feasibility detection, and proposal re-verification engine.
2. **Phase 1 — Split-Screen Desktop UI & Persistent Interactive Map**: Left collapsible sidebar (`Calendar` and `Conflicts` tabs) + persistent right San Francisco map with route polylines, mode comparison card (`Transit`, `Walk`, `Drive`, `Bike`), and synchronized selection.
3. **Phase 2 — Argon Evidence Investigation Loop**: Server-side retrieval of official event agenda pages + Gemini structured JSON extraction (`EventPhase[]`, `confidence`, verbatim excerpts, source citations) with strict adherence to the optional-tail policy.
4. **Phase 3 — Interactive Resolution Preview & Audit Trail**: Before/after itinerary impact preview, re-verified route math, explicit user confirmation prior to any calendar mutation, and audit log.
