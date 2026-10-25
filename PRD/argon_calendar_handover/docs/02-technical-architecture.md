# Technical Architecture

## Proposed stack (not yet implemented)
| Area | Technology | Notes |
|---|---|---|
| App | Next.js / React / TypeScript | App Router, client-side interactive map |
| UI | Tailwind CSS | Split layout, collapse controls, conflict panels |
| Authentication | Google OAuth 2.0 | Read-only Calendar first; request write separately |
| Calendar | Google Calendar API | Event paging, calendar selection, sync tokens later |
| Map | Google Maps JavaScript API | Map, markers, selected route polyline |
| Journey computation | Google Maps Routes API | Modal alternatives depending on availability |
| AI | Gemini 4 Argon API | Server-side call; validate live model/SDK/entitlements |
| Online evidence | Search API + HTML fetch/extract | Prefer organizer/event URLs; avoid unsupported scraping |
| Backend | Next.js route handlers / Node.js | Keep tokens and paid API calls server-side |
| Storage | In-memory/local for demo; Supabase/Postgres later | Preferences, geocodes, caches, evidence, decisions |
| Hosting | Local dev, Vercel optional | Protect sensitive env vars |

## Data flow
1. User grants calendar read access.
2. Fetch and normalize events for chosen date range; geocode physical locations.
3. Compute candidate route options for each successive physical event.
4. Detect hard overlap / infeasible travel / low buffer / incomplete event data.
5. For a conflict, retrieve credible event-page evidence. Send sanitized event metadata + excerpts to Argon.
6. Receive structured hypothesis: corrected details, event phases, confidence, citation URLs, recommended solutions.
7. Verify each suggested route/time against deterministic APIs and recompute downstream legs.
8. Present proposed changes and evidence; optional user-confirmed calendar writes later.

## Suggested TypeScript domain models
```ts
type EventPhase = { label: string; start: string; end: string; optionality: 'required'|'optional'|'unknown'; evidenceUrl?: string };
type CalendarEvent = { id: string; title: string; start: string; end: string; timezone?: string; location?: string; eventUrl?: string; description?: string; isVirtual?: boolean; phases?: EventPhase[] };
type RouteOption = { id: string; mode: 'walking'|'transit'|'driving'|'bicycling'; durationMinutes: number; startEventId: string; endEventId: string; provider: string; lastCheckedAt: string; polyline?: string };
type Conflict = { id: string; type: 'overlap'|'travel_impossible'|'tight_buffer'|'missing_location'|'uncertain_schedule'; severity: 'critical'|'warning'|'info'; eventIds: string[]; availableMinutes?: number; requiredMinutes?: number; status: 'new'|'investigating'|'ready'|'resolved'|'dismissed' };
type Investigation = { conflictId: string; evidence: {url: string; publishedAt?: string; excerpt?: string}[]; findings: string[]; possiblePhases: EventPhase[]; confidence: 'confirmed'|'likely'|'unverified'; suggestions: string[] };
```

## Key engineering precautions
- Store Google refresh tokens securely; never ship Maps/Gemini private credentials in the browser bundle. Browser-exposed Google Maps keys should be restricted to allowed origins and API usage.
- Calendar write access only with informed confirmation; default to read-only in MVP.
- Map route geometry and duration should come from Maps provider, **not** hallucinated by the model.
- Evaluate event page trustworthiness; distinguish primary official source from third-party discussion.
- Protect against prompt injection embedded in event descriptions and scraped pages (treat as data, not instructions).
- API cost / latency limits: cache geocoding, routing and investigated pages; perform AI investigation only when relevant conflicts arise.
- Unknown events or ambiguous venue names require an explicit uncertainty status.
- For the hackathon, build a mock-data mode that works without OAuth or paid APIs and clearly labels mock values.
