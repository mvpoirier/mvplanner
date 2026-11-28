# Changelog

All notable changes to MVPlanner. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

## Roadmap

### v2.0 — native apps (planned)
- Unsigned **macOS app (.dmg)** and **Android app (.apk)** built from this codebase, downloadable from GitHub Releases. No app stores.
- **Google Drive sync** (optional) using the narrow `drive.file` / `drive.appdata` scopes, alongside the sync file.

## [1.4.0] — 2026-11-28
### Added
- New lesson editor toolbar: **Ink ▾** (black, blue, red), **Style ▾** (bold, italic, strikethrough, yellow highlight, circle first line, star), **List ▾** (bulleted, numbered), **Link**, **Unit ▾**, **Bump ▾**.
- Shortcuts while editing: ⌘B / ⌘I / ⌘⇧X / ⌘⇧H, Esc or ⌘↵ for Done, Tab / ⇧Tab to save and jump to the next / previous lesson.
- **Bump** choices: text to next lesson (default), text to next blank lesson, move all lessons from here.
- **Sequences**: a line starting `1/3` offers to add `2/3`, `3/3` to the class's next lessons (✕ removes one).
- **Unit planner**: tags lessons `U2 L1…L8`, skipping holidays, with optional titles; hover a tag for progress. Tags move with Bump.
- **Notes display**: click the Notes heading for one colour, your own palette, or a bulleted list. Notes follow the Aa note font.
- **Demo Timetable** for first-time visitors: made-up classes, one week filled in that explains the app, a start card on other weeks.
- Timetable **title** on the left page as label-maker tape in the cover colour (click to rename).
- **Undo / redo** beside the Synced chip.
- Phones: landscape shows the binder, portrait the phone view (☰ → Phone layout to lock it).
- Mac app: new **MVP** icon; the menu bar item is just a binder icon with today's list in its menu.
- Version number shown at the bottom of the ☰ menu.
### Changed
- Search moved above Friday.
- Phone view only appears on phones.
### Removed
- "→ NOTES" pin and the "1/3" sequence box in the editor; the separate undo button in the editor; the duplicate bottom-left sync alert.

## [1.3.0] — 2026-11-28
### Added
- **Reminders**, on by default: 10 minutes before each class, duty, meeting/event and ECA (5 / 10 / 15 min or at start). Never on no-school days; right-click a lesson to skip it; pause for today; test reminder.
### Changed
- Today's column: thin orange outline with the day and date in orange (no blue fill).
- Today ribbon: always in the top-right corner, no text, hover tooltip.
- Sync status: just "Synced" at the bottom right; hover shows where and when.

## [1.2.0] — 2026-11-27
### Added
- Binder redesign: sticky notes, Today ribbon, ⌘K search, sync status chip, "Week N of total" with a progress bar, attached month tabs, darker page corners.
- **Import school calendar** from .ics or .csv, with a preview of new vs. existing dates.
- **Mac app** via the Claude desktop app: direct sync-file access without prompts, Dock icon, menu bar, notifications.
### Removed
- Google OAuth (Drive and Sheets sync), replaced by the sync file.

## [1.1.0] — 2026-11-26
### Added
- **Linked sync file** (no sign-in): saves to a file in a OneDrive / Dropbox / iCloud folder, picks up changes from other computers, conflict prompt.
- **Open on Today** with today's column highlighted and a Today button (T).
- Setup Wizard Step 1 redesign: NIST School Setup (any school year) or Other School / Custom; Clone Previous Year and Import fast-track.
- GitHub Pages deploys automatically from `main`.

## [1.0.0]
- Initial build: 3D binder spread, flat grid and phone views, rotating A–J cycle engine with the NIST 2026–27 preset, holidays and recurring rules, Smart Bump Forward, 5-step setup wizard, passphrase lock, Google Drive/Sheets sync, export studio.
