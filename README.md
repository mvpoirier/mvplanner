# MVPlanner

A tactile, physical 2-ring binder teacher timetable planner backed by a rotating-cycle scheduling engine, Smart Bump Forward lesson shifting, multi-year binder archiving, private Google Drive/Sheets sync, and a 6-format duplex print & archive studio.

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
- **Milestone 2 — Zero-Backend Google Drive & Sheets Sync**: Client-side Google Identity Services (GIS) OAuth saves your full workspace to a private `mvplanner-workspace.json` file in your Google Drive (with `modifiedTime` conflict guard), imports/refreshes from your Google Sheet without wiping lesson notes, and optionally pushes a plain-text mirror to a `MVPlanner_Mirror` tab.

- **Linked Sync File (no sign-in)**: Link a `mvplanner-workspace.json` file inside a folder that OneDrive, Dropbox, iCloud or Google Drive for desktop already syncs. Every edit saves to it automatically; on open (and whenever you return to the tab) MVPlanner loads newer changes from your other computers, and asks which copy to keep if both changed. Works without Google OAuth, so it keeps working if a school blocks third-party sign-in. Chrome/Edge only (File System Access API); other browsers get manual download/open buttons. Encrypted with your passphrase when the lock is on.

---

## Development

```bash
npm install
npm test        # Vitest engine & schedule verification suite
npm run dev     # http://localhost:5173/mvplanner/
npm run build   # Type-checks and builds static bundle into dist/
```

### Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. To bake in a Google Client ID, add a repository variable `VITE_GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables).

---

## Google Cloud Console OAuth Setup Guide (Milestone 2)

MVPlanner uses client-side **Google Identity Services (GIS)** — no backend server or database required. To enable **"Sign in with Google"** for private Drive sync and Google Sheets import:

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a new free project (e.g. `MVPlanner`).
2. Go to **APIs & Services → Library** and enable:
   - **Google Drive API**
   - **Google Sheets API**
3. Go to **APIs & Services → OAuth consent screen**:
   - Choose **External** (or Internal if using a school Workspace org).
   - Add scopes: `.../auth/drive.file` and `.../auth/spreadsheets`.
   - Under **Test users**, add your own Google email address (no app verification needed for personal use).
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://mvpoirier.github.io`
     - `http://localhost:5173`
   - Click **Create** and copy the generated **Client ID** (`xxxx.apps.googleusercontent.com`).
5. Use the Client ID in either of two ways:
   - **Per-browser**: Open the **Google Sync** drawer in MVPlanner and paste the Client ID directly, **or**
   - **Baked into build**: Create `.env.local` with `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` before running `npm run build`.
