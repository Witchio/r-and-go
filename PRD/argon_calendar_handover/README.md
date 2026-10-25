# Argon Calendar Travel Planner — Local Development Handover

**Status:** Product concept + implementation handover (not a built application).  
**Prepared:** October 25, 2026.  
**Working name:** Argon Calendar Travel Planner (project name not finalized).

## Purpose
Build a browser-based calendar travel planner that puts your agenda and routes on one screen. It anticipates departure times, detects impossible journeys, and investigates whether apparent conflicts are caused by incorrect or overly broad event information—including optional dinners/networking sessions.

## Start here
1. Review `docs/01-product-requirements.md` for the agreed experience.
2. Inspect the **original illustrative mockup screenshots** in `assets/` (these are *not* screenshots of a working app).
3. Read `docs/02-technical-architecture.md`, `docs/03-implementation-plan.md`, and `docs/04-open-questions.md`.
4. Use `prompts/implementation-kickoff.md` as a starting prompt for a local coding agent.
5. Use `examples/sample-events.json` and `examples/sample-conflicts.json` as test fixtures.
6. Read `docs/06-itinerary-playback-and-history.md` for the October 25 additions: animated 2D itinerary playback and previous-day browsing/replay. These extend the current build; their implementation is pending.

## Folder structure
- `docs/` — PRD, architecture, implementation stages, unresolved decisions, hackathon context.
- `assets/` — Conceptual desktop interface screenshots and architecture diagram.
- `examples/` — Artificial, illustrative calendar events and detected conflict data.
- `prompts/` — Ready-to-use kickoff prompt for a local coding assistant.

## Non-negotiable UX decisions
- Desktop is split **vertically**: collapsible left sidebar; map fills the remaining width.
- Sidebar has **Calendar** and **Conflicts / Notifications** tabs. Map persists across tabs.
- Selecting an event, route, or conflict updates the map context.
- Suggested departure times and multiple travel modes/routes are first-class features.
- Detected conflicts trigger an *evidence-backed* Argon investigation of publicly available event details, when available.
- The assistant must distinguish confirmed schedule facts from hypotheses; never silently edit the calendar.

## Important caveats
- Google Maps, Google Calendar, online search and Gemini require API access, credentials and may incur usage costs.
- Real-time travel times, transit alternatives, and arrival/departure-time routing depend on mode, provider and supported geography.
- Apple's internal dynamic **Time to Leave** alerts are not established as an accessible API; calculate times independently from calendar + routing data.
- Gemini Argon capabilities/access and exact API/model identifiers must be validated with the hackathon's current developer guide; do not assume the quoted model ID is available to a given account.
- No actual user's calendar information, account tokens, private data or Wi-Fi passwords are included.
