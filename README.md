# R & Go

An intelligent itinerary and travel feasibility planner built with Next.js and TypeScript. **R & Go** transforms your daily calendar into a unified timeline of **Event/Location stops** and **Transportation legs**, automatically detecting schedule overlaps, impossible transit windows, and missing venues—and resolving them with verified evidence.

---

## ✨ Key Features

- **Dual-Component Itinerary Sidebar**:
  - **Event & Location Cards**: Shows where you are, stay duration, venue address, and required vs. optional event phases.
  - **Transportation Cards**: Shows travel between stops with instant mode switching (**Transit**, **Walk**, **Drive**, **Bike**), exact departure/arrival times, route summaries, and buffer status.
  - **Automatic Home Origin & Return**: Automatically routes your morning commute from home to your first stop and sets **Home as your final destination** at the end of the day.
- **Conflict Investigation & 1-Click Resolution**: Investigates schedule overlaps, tight travel buffers, and missing event addresses against official organizer pages, letting you preview and apply verified fixes in one click (with instant Undo).
- **Interactive 2D Map & Playback**: Visualizes corridors, transit lines, and an animated 2D traveler simulation across the day.

---

## 📅 Demo Mode vs. Your Own Google Calendar

- **Runs on Demo Calendar by Default**: Out of the box, **R & Go** loads with curated San Francisco / California demo schedules so you can immediately test route switching, conflict resolution, and 2D playback with zero setup.
- **Connect Your Own Google Calendar *(California only for now)***:
  - Click the **Connect Calendar (🔗)** button in the top-left sidebar to connect your personal Google Calendar (via OAuth, API token, or `.ics` feed) or import `.ics` files.
  - **Geographic Scope**: Map rendering, address autocomplete, and deterministic transit/road routing are **currently scoped to California** (San Francisco Bay Area, Silicon Valley, LA, San Diego, etc.).

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Optional Environment Variables

The app works out-of-the-box without API keys. To enable live Gemini conflict analysis or Google OAuth calendar sync, copy [`.env.example`](.env.example) to `.env.local`:

```bash
cp .env.example .env.local
```

### Run Tests

```bash
npm test
```
