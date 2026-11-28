# MVPlanner

A tactile, physical 2-ring binder teacher timetable planner backed by a rotating-cycle scheduling engine, Smart Bump Forward lesson shifting, multi-year binder archiving, no-sign-in sync via a linked file, and a 6-format duplex print & archive studio.

Live deployment: **https://mvpoirier.github.io/mvplanner/**

---

## Features (Milestones 1 & 2)

- **3D 2-Ring Physical Binder Spread**: Pixel-locked `Mon–Wed` verso and `Thu–Fri + NOTES` recto pages, 5 binder cover swatches, Handwritten/Sans note font toggle, 3D page-flip animations, right-edge monthly tabs, and clean `Week X / Y remaining` teaching-week headers (excluding non-teaching break weeks).
- **3 Views**: 3D Binder Spread (desktop primary), Flat Bulk-Edit Grid, and Responsive Phone Agenda View.
- **Rotating-Cycle Engine**: Configurable 5/6/8/10-day cycles with built-in **NIST 2026–2027 A–J Preset** (38 teaching weeks, 178 instructional days, zero personal PII).
- **Exceptions & Recurring Rules**: Pause cycle (holidays/PL days), Skip letter, Partial-day block, Alternate bell (e.g., Early Dismissal 11:30), Year-group cohort overrides, and date-bounded recurring weekday rules.
- **Smart Lesson Bump Forward**: Course-scoped shift forward (`Stop at next blank/buffer` or `Ripple full term`), automatically skipping holidays, blocks, and cohort overrides, with instant `Ctrl/Cmd+Z` Undo/Redo.
- **5-Step Bespoke Yearly Setup Wizard**: Clone a prior year, start from NIST A–J or blank custom cycle, or import `.xlsx`/`.csv`; interactive bell-row builder, course palette, visual cycle grid painter with load counters, and `.ics`/CSV/paste bulk holiday importer.
- **Local-First Privacy**: Auto-saves offline to browser `IndexedDB` with optional **Web Crypto AES-256-GCM Passphrase Lock** and plain/encrypted JSON backups.
- **Export & Print Studio (6 Formats)**:
  1. A4 / US Letter Duplex Binder Print (mirrored `18mm` 2-ring punch gutters)
  2. Blank Printable Binder Sheets (empty writable cells for pen/pencil)
  3. Single-Course Chronological Pacing Sheet (`A1..H18` in Print/PDF, Markdown, or CSV)
  4. Full Workspace JSON Archive (optional AES-GCM encryption)
  5. Excel (`.xlsx`) / CSV Workbook (`Grid` + `FINAL` tabs)
  6. RFC 5545 Calendar Feed (`.ics`) & Standalone Offline HTML / Markdown Archive

- **Import School Calendar**: Load holidays, no-school days and events from an `.ics` file (Google / Apple / Outlook Calendar, or the school website) or a `.csv` (`date,end_date,type,label`). Preview shows what's new versus already in the binder; *No school* pauses the cycle, *Event* adds a banner.
- **Reminders (on by default)**: a notification 10 minutes before each class, duty, meeting/event and ECA (5 / 10 / 15 min or at start; choose which kinds). Never on no-school days; right-click a lesson → no reminder for that one; pause for today. On the website they arrive while a tab is open; the Mac app reminds you in the background.
- **Search (⌘K / Ctrl+K)**: Find lesson notes, weekly notes, courses, events and holidays across the year and jump straight to that week.
- **Linked Sync File (no sign-in)**: Link a `mvplanner-workspace.json` file inside a folder that OneDrive, Dropbox, iCloud or Google Drive for desktop already syncs. Every edit saves to it automatically; on open (and whenever you return to the tab) MVPlanner loads newer changes from your other computers, and asks which copy to keep if both changed. No accounts or sign-in, so school sign-in policies can't block it. Chrome/Edge only (File System Access API); other browsers get manual download/open buttons. Encrypted with your passphrase when the lock is on.

---

## Development

```bash
npm install
npm test        # Vitest engine & schedule verification suite
npm run dev     # http://localhost:5173/mvplanner/
npm run build   # Type-checks and builds static bundle into dist/
```

### Mac app (via the Claude desktop app)

The same app is also published as a Claude artifact that can be installed as a Mac app (☰ → **Install as Mac app**, or "Install as app" in the artifact's menu in the Claude desktop app). In the app:
- **Sync without prompts**: pick your iCloud Drive / OneDrive / Dropbox / Google Drive folder once; MVPlanner reads and writes `MVPlanner/mvplanner-workspace.json` there directly. Choose that same file on the website to share it.
- **Menu bar**: next lesson ("P3 9.7 SCI · 12:30"); click for today's list.
- **Reminders** arrive even when the window is in the background.

Build it with `npm run build:app` (relative asset paths, output in `dist-app/`). The permissions it asks for are listed in the `claude-artifacts-manifest` tag in `index.html`.

### Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
