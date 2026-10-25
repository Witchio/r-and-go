# Requirement Addendum — 2D Itinerary Playback and Previous Days

**Added:** October 25, 2026.  
**Status:** Requested product requirements; implementation pending.  
**Scope:** Extend the existing calendar/sidebar/map experience.

## Requirement R10 — Animated 2D itinerary playback

### User story
As a user, I want to play through my selected day's itinerary on a 2D map and see a traveler move between events using my selected transportation methods, so I can understand the journeys and timing of my day.

### Required behavior
- Add a `Play my day` control to the existing map experience, with play/pause, restart, a time slider, and a visible simulated date/time.
- Display event destinations and the selected routes between them. Highlight the active journey and synchronize the active event/journey with the sidebar.
- Animate a traveler along the selected route geometry, rather than directly between event coordinates. Change its icon to match walking, cycling, driving, or the relevant transit vehicle when known; a generic transit icon is an acceptable fallback.
- Represent transit walking, waiting, and vehicle segments separately when provider data supports them (using structured `walk`, `wait`, and `ride` sub-steps with sub-polyline coordinates). Keep the traveler stationary during waiting and event attendance.
- Scale total playback duration dynamically with the number of events and journeys on the selected day rather than forcing a fixed duration. Travel segments play at a readable pace (e.g., ~1s per 4–5 minutes of real travel), while in-event attendance is time-lapsed/accelerated (especially for long multi-hour events) while keeping the displayed itinerary clock accurate. Seeking must derive the same position and active segment as normal playback. Event duration must not require real-time waiting.
- Pause briefly at normal event destinations and display the event title and scheduled time. When playback reaches an unresolved conflict or overlap decision point (i.e., the `recommended_leave` time required to reach the next event on time while the current event is still ongoing), pause playback and present an **interactive on-map choice**:
  1. **Leave now to arrive on time** — depart at `recommended_leave` (e.g., skipping an optional networking tail or leaving early) and animate on-time arrival at the next destination.
  2. **Stay until scheduled end** — remain at the current venue until its scheduled end time, then animate the delayed departure and late arrival at the next event with a visible conflict/late badge.
  Overlapping events and infeasible journeys remain visibly flagged; playback must not imply that an impossible plan is feasible without making that trade-off explicit.
- Changing a route or transportation mode pauses playback, revalidates the affected itinerary, and resets playback to the start of the updated day. Never continue animating stale route data.
- Stop playback on date changes. Sidebar collapse and tab changes preserve playback state and the existing map.
- Missing locations, unavailable routes, virtual events, or unknown origins show an explanatory state. Do not invent a journey or animate a traveler across unknown geography. Allow replay of valid portions with gaps clearly marked.
- Use a user-specified origin, such as home, if available. A home address is not required to play the known event-to-event legs.
- Label this as a planned itinerary preview, with route freshness and mock/estimated data clearly identified. It does not represent live tracking or actual travel history.

### Implementation guidance
- Reuse the existing map, routing adapter, selected route, departure calculations, and conflict engine.
- Suggested implementation: Google Maps JavaScript API, a custom Advanced Marker using SVG/CSS, Geometry utilities for route interpolation, and browser `requestAnimationFrame` for playback. A React wrapper such as `@vis.gl/react-google-maps` is optional; preserve an existing working map integration.
- Routes API supplies paths, timing, and steps where supported. Fetch when itinerary inputs change, never for every animation frame.
- Create a timeline of event, travel, waiting, and unavailable segments. Map playback time to segment progress, then map progress to distance along that segment's path. Use available step durations; movement within a step is an approximation.
- Keep itinerary time separate from playback speed so compressed event pauses and travel playback remain consistent when seeking. Update the moving marker without rerendering the entire app each frame.
- Model-generated routes and timing are not accepted inputs. Argon continues to investigate and explain conflicts; animation follows deterministic itinerary data.
- Initial scope is interactive 2D playback. Immersive 3D worlds, first/third-person environments, generated activity scenes, and video export are deferred.

### Acceptance criteria
- A demo day with at least three physical destinations plays along predefined route geometry with correct mode icons and event stops.
- Total playback length scales with the number of events and journeys, and long events fast-forward (accelerate the simulated clock) smoothly.
- Play/pause, restart, and seeking keep the marker, displayed clock, and sidebar selection in sync.
- A transit fixture shows walking and riding as different segments, and waiting when supplied.
- Changing the selected mode updates route, duration, departure calculation, and conflicts before playback restarts.
- At an unresolved conflict/overlap boundary, playback pauses with an interactive choice to either **leave on time** (`recommended_leave`) or **stay until the venue's scheduled end** (animating the resulting late arrival with a conflict indicator); missing route/location data never produces an invented connecting path.
- Playback works with clearly labeled mock data without Calendar, routing, or AI credentials.

## Requirement R11 — Browse and replay previous days

### User story
As a user, I want to select a previous date and see that day's calendar, map, journeys, and conflicts, with the same playback controls available for usable itinerary segments.

### Required behavior
- Provide previous-day and next-day controls, a date picker supporting past dates, and a `Today` shortcut in the Calendar tab. Always show the selected date.
- Load events for the selected day's boundaries in the active calendar/display timezone. Include events overlapping the day, including cross-midnight events; handle daylight-saving boundaries correctly.
- Switching dates updates the agenda, map pins, routes, conflicts, and playback timeline together. Clear obsolete selection, stop playback, and prevent a slower response for a previous selection from replacing the current day.
- Keep today's departure reminders tied to today's actual schedule. Browsing or replaying a past day must not emit overdue departure notifications or initiate automatic investigations.
- Distinguish a day with no events from loading, failed loading, or unavailable calendar access. Returning to today restores the current day's itinerary.
- In the initial implementation, previous days show the events currently returned by the calendar for those dates. Later calendar edits may change what appears. This is not a snapshot of what the calendar originally contained or proof of attendance.
- Do not send unsupported historical-time routing requests. When a provider cannot reconstruct historical routing, show a clearly labeled present-day estimate if a suitable estimate is available, or a route-unavailable state. Do not claim historical traffic, transit schedules, ETAs, or actual transportation choices.
- Playback of past days reconstructs a planned itinerary from available data. Any selected modes are planning choices unless a stored user choice exists; never label inferred modes as what the user actually used.
- No background location tracking is required.

### Implementation guidance
- Parameterize event loading, conflict calculation, route selection, and playback by selected date and timezone; do not hardcode today or the fixture date.
- Scope route selections and overrides by date and relevant event/journey identifiers, so one day's choices do not leak into another day.
- Key any day cache by account/calendar selection, date, and timezone. Expose data freshness and preserve existing calendar access controls.
- Add fictional fixtures for at least one previous day and an empty day. Label mock history clearly.
- Immutable daily snapshots and recorded actual journeys are separate future features. Their storage, retention, consent, and routing-data permissions require a later design decision.

### Acceptance criteria
- The date picker and day controls can open a previous day, and `Today` returns to the current local calendar date.
- Previous-day fixtures display their own events, destinations, conflicts, and playable journeys, rather than repeating today's data.
- Date changes during loading or playback cannot display mixed-day data.
- Empty days, unavailable routes, and loading failures have distinct, usable states.
- Past-day views identify reconstructed/estimated routes and trigger no historical departure reminders.
- Cross-midnight events and timezone/daylight-saving boundaries are assigned to the appropriate selected-day interval.

## Delivery order
1. Add selected-date plumbing, previous-day fixtures, and day navigation.
2. Build deterministic playback for fixture routes on the existing 2D map.
3. Connect playback to selected live routes and supported transit steps.
4. Complete history labeling, unavailable-data handling, and interaction checks against the acceptance criteria above.

Implement these as additions to the current build. No framework or map-provider migration is required.
