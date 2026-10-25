# Implementation Plan

## MVP order (short hackathon build)
**Phase 0 — Skeleton & demo fixtures**
- Initialize Next.js + TypeScript + Tailwind; add layout, routing and API env configuration.
- Load provided fake events and conflicts; build polished split-pane UI with persistent map region.

**Phase 1 — Calendar + map**
- Connect Google Calendar read-only (or start with mock fixtures if OAuth blocks progress).
- Map event locations using geocoding, show pins, select a leg, draw route line.
- Add walking/transit/driving/bicycle switches where provider supports them.

**Phase 2 — Departures + deterministic conflicts**
- Calculate leave-by times including configurable buffer.
- Detect overlapping appointments, impossible travel windows, low buffers and absent locations.
- Clicking conflict opens corresponding trip on map.

**Phase 3 — Argon investigation**
- Collect organizer/official URLs from event, run online retrieval and extract agenda.
- Ask Argon for *structured JSON* identifying possible correction and mandatory vs optional subsegments.
- Show linked evidence and calibrated confirmation state.
- Rerun timing & routing checks to prove whether each suggestion fixes the conflict.

**Phase 4 — Preview + submission**
- Add resolution preview and user confirmation UI; avoid direct writes if time-limited.
- Demonstrate one conflict with inaccurate calendar end time that Argon resolves via official agenda.
- Record 1-minute demo; make repository public if submitting; clearly show what was built during event.

## Demo storyline
For the newly requested playback and previous-day features, follow the delivery order and acceptance criteria in [the requirement addendum](06-itinerary-playback-and-history.md). Add date navigation first, then fixture playback, then live-route integration. These additions preserve the existing build phases and working map integration.

1. Agenda shows back-to-back commitments across San Francisco.
2. Map highlights an impossible journey and calendar sidebar shows an alert.
3. Open conflict → Argon checks an organizer agenda.
4. Argon notices the calendar block includes optional networking after the main program (only if source confirms).
5. UI offers `Leave after required portion` and an alternative transit route.
6. Recalculated route proves arrival before next event; show changed itinerary without silently rewriting calendar.

## Suggested acceptance criteria
- Expanding/collapsing sidebar preserves map state.
- Both tabs retain map view and selecting entries synchronizes selected journey.
- Conflict logic yields expected outcomes for `examples/sample-events.json`.
- User can switch eligible route modes and inspect alternatives.
- Each departure recommendation states event start, duration, buffer and route freshness.
- Investigations show evidence status and URL; no unsupported factual assertion that an event segment is optional.
- Proposed fix is evaluated with the same conflict engine as the original itinerary.
- A user cannot accidentally trigger a calendar edit.

## Possible future milestones
- Historical travel preferences and per-event importance.
- Real push notifications, background calendar watchers, re-routing when traffic changes.
- Multi-day itinerary optimization, event category preferences and multi-calendar support.
- Privacy and data retention settings, live location, walking-to-station time, accessibility routing.
