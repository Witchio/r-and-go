# Product Requirements Document (PRD)

## Problem
A busy user has many calendar events with locations but lacks a consolidated understanding of **where to go, how to get there, when to leave**, and whether all scheduled commitments are physically feasible. Calendar applications provide partial departure alerts but do not present an integrated itinerary and investigation of bad event metadata.

## Primary user story
> As a person moving between events in a city, I want to see my calendar alongside a map, compare travel methods, and get reliable departure recommendations so I can arrive on time without continually opening mapping apps.

## Desktop information architecture — agreed
- Two vertical panes: **left collapsible navigation/sidebar**, **right dominant map**.
- Sidebar tabs: **Calendar** and **Conflicts / Notifications** (not three equal tabs; the map is always visible).
- Calendar tab: date selector, ordered events, locations, travel legs, expected duration and leave-by times.
- Conflicts / Notifications tab: severity-ordered issues, statuses, investigation results, suggested actions and departure alerts.
- Sidebar expanded roughly 330–400px on desktop (proposed design value, not yet decided); collapsed to narrow icon rail.
- Map shows event pins, selected route geometry, mode alternatives, relevant transit/traffic annotations when available.

## Core features
1. **Calendar connection:** Google OAuth and Google Calendar event read/sync. Read title, start/end, time zone, location, description, links, organizer if available. Normalize location geocodes.
2. **Journey itinerary:** For consecutive in-person events, choose departure origin (prior event, inferred current location only with consent, or specified origin), destination, arrival deadline and desired buffer.
3. **Multimodal routing:** Walking, transit, driving, cycling where supported; show alternative routes, estimated durations and map polylines. Allow choosing a preferred leg/mode.
4. **Departure intelligence:** `recommended_leave = next_event_start - arrival_buffer - travel_duration`; use service-provided arrival-time routes and consider dynamic conditions whenever supported. Show freshness and uncertainty of estimates.
5. **Conflict detection:** Hard calendar overlaps, unreachable journeys, insufficient buffer, ambiguous/missing locations and incomplete event information. Avoid flagging online-only events as physical journeys.
6. **AI event verification:** For detected conflicts, Gemini 4 Argon consults *retrieved online evidence* (official schedule / organizer pages / ticket link where possible) to check whether calendar dates, location, end times or event phases may be inaccurate.
7. **Optional event phases:** Distinguish required program from optional dinner/networking/post-event segments when the source explicitly supports that conclusion. Suggest leaving after core content, but do not assume optionality from the word 'dinner' alone.
8. **Resolution flow:** Show cause, evidence, travel alternatives and possible changes; let user preview impacts; **require approval** before any calendar write.
9. **Notifications:** Departure reminders and prioritized unresolved conflicts (delivery mechanism not yet selected).
10. **Animated 2D itinerary playback:** Play the selected day's journeys on the persistent map with a moving traveler, mode-specific icons, event stops, a simulated clock, and play/pause/restart/seeking controls. Reuse selected routes and deterministic timing. See [R10 details and acceptance criteria](06-itinerary-playback-and-history.md).
11. **Previous-day browsing and replay:** Select past dates and view their calendar events, journeys, conflicts, and available playback. Clearly distinguish reconstructed plans and route estimates from recorded history. See [R11 details and acceptance criteria](06-itinerary-playback-and-history.md).

## Conflict resolution interaction — target
- Detect → open conflict card → show timeline/travel gap → highlight leg on map.
- Investigation state: `Checking event details…` → `Confirmed / Likely / Unverified` with source URL(s), excerpt / phase times and timestamps.
- Suggest a short ranked set of resolutions: faster mode/route; leave optional session early; shift event if appropriate; correct location/time; mark as ignored.
- Preview impact on downstream events and travel legs. Re-run route checks to **verify** each proposal.
- User accepts a suggestion; if it modifies calendar, request explicit confirmation and OAuth write permission.
- Keep audit trail: original data, external evidence, user decision and chosen override.

## AI responsibilities vs deterministic logic
- **Deterministic:** calendar overlap arithmetic, geocoding, route durations from map provider, buffer rules, feasibility checks, revalidation.
- **Gemini Argon:** disambiguating event information, extracting structured agendas from online source material, classifying required vs optional phases with calibrated uncertainty, recommending trade-offs and explaining impact.
- Model output alone must not override verified calendar or routing data.

## Nonfunctional requirements
- Explainable recommendations with clickable citations / official event pages where feasible.
- Clear distinction between hard conflict and potential conflict.
- Handle timezone, all-day events, cancellations, virtual meetings, missing data and overlapping commitments.
- Data minimization, OAuth least privilege, transparent location permissions, safe handling of private calendar descriptions and external URLs.
- User-friendly errors when public event information is not discoverable.

## Not in initial MVP
- Direct integration with macOS internal Time to Leave alerts.
- Automatic changes to third-party attendees' events.
- Unattended calendar rescheduling.
- Full production notification delivery to every device.
- Guaranteeing live ETAs for modes/times unsupported by the selected routing API.
