# Items Still to Discuss / Decide

## Product / UX
- [ ] Final app name and visual branding.
- [ ] Sidebar default width, collapsed behavior, mobile layout and map-first responsive design.
- [ ] Calendar style: agenda list vs day/week grid. Single-day browsing, including previous days, is required by [R11](06-itinerary-playback-and-history.md); simultaneous multi-day views remain undecided.
- [ ] Historical snapshots: storage and retention for preserving an original daily plan or actual journeys. Initial previous-day browsing uses currently available calendar data and labels route estimates.
- [ ] Should conflict count represent critical only or all types? Notification priority and snooze behavior.
- [ ] Resolution controls: inline choices, slide-over drawer, preview diff, or wizard?
- [ ] Do users prefer a chosen default travel mode, cheapest, fastest, lowest walking, or least transfers?
- [ ] How to handle user-supplied locations, work/home, and permission to access current device location?

## Data / integrations
- [ ] Google Calendar only initially, or Apple/Outlook later?
- [ ] Which Google calendars are in scope? Can events be private/busy-only?
- [ ] Maps API quotas, pricing, route mode coverage and traffic/arrival-time support.
- [ ] Search provider for official event agendas: Gemini grounding/search vs third-party search API.
- [ ] Sources without public URLs, dynamic pages, gated events and PDFs.
- [ ] Source freshness and evidence cache expiration.

## Reasoning / trust
- [ ] Define optional-session policy: only explicit official text vs inferred segments with approval.
- [ ] Confidence thresholds and human confirmation when sources disagree.
- [ ] Relative priorities: never miss mandatory meeting, minimize travel, cost or disruption.
- [ ] Could a calendar event represent a broad availability block rather than mandatory attendance?
- [ ] Show all candidate schedule corrections or only highest-confidence suggestions?
- [ ] Whether Gemini gets whole day/week or only relevant neighborhood of events.

## Actions / engineering
- [ ] Should user be able to edit Google Calendar inside app, or only open original event?
- [ ] Read/write OAuth scopes and security model.
- [ ] Should notifications ship for hackathon or stay in app?
- [ ] DB and persistence strategy, deployment target, observability and evaluation metrics.
- [ ] Exact Argon model access and supported API usage in the hackathon environment.
- [ ] Baseline benchmarks: rate of correctly detected conflicts, verified corrections, false positives, end-to-end latency.

## Explicitly not agreed yet
- Exact left navigation labels (working labels: Calendar, Conflicts & Notifications).
- User-editable schedule automation, calendar writes, billing and production-ready auth.
- Treating networking/dinner as optional by default: **not agreed and not safe**.
