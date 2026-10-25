# Prompt for a local coding assistant

Build an MVP of the **Argon Calendar Travel Planner** based on `README.md`, `docs/01-product-requirements.md`, `docs/02-technical-architecture.md`, and the image mockups in `assets/`.

Implement first with deterministic mock fixtures (`examples/`) so it runs immediately without any cloud credentials. Use Next.js, TypeScript, Tailwind, a left collapsible sidebar containing Calendar and Conflicts/Notifications tabs, and a map taking the rest of the screen. Selecting an event, route or conflict should update map selection. Create an API adapter layer for Calendar, Maps routing, and Gemini Argon; supply mocks for each initially. Implement conflict detection and departure recommendations deterministically, using model logic only for event-source investigation and candidate resolutions.

After the mock mode works, add Google Calendar OAuth read-only, Google Maps mapping/routing, server-side external event page retrieval, and Gemini 4 Argon structured extraction with source citations. Implement an inspect → propose → deterministically verify → user approves loop. Never change calendar data automatically. Respect incomplete evidence and do not assume that dinner/networking is optional without support from an organizer source.

Work incrementally; ensure TypeScript checks, a running demo, and test fixtures for overlapping events, impossible travel, optional tail and missing location. Flag limitations and any unresolved API/UX choices instead of inventing support.
