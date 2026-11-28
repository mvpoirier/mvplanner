// Reminder settings (per device, kept in localStorage). On by default: 10 minutes before
// every class, duty, meeting/event and ECA. Shared by the table, the menu bar and the panel.

import { useSyncExternalStore } from 'react';

export type ReminderKind = 'class' | 'duty' | 'event' | 'eca' | 'free';

export interface ReminderPrefs {
  enabled: boolean;
  leadMin: number; // 0 = at the start
  kinds: Record<ReminderKind, boolean>;
  menuBar: boolean; // Mac app only
  includeNote: boolean;
  pausedOn: string | null; // ISO date reminders are paused for
  skips: string[]; // cell keys ("2026-11-26__P3") with no reminder
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: true,
  leadMin: 10,
  kinds: { class: true, duty: true, event: true, eca: true, free: false },
  menuBar: true,
  includeNote: true,
  pausedOn: null,
  skips: [],
};

const KEY = 'mvplanner-reminders';
const listeners = new Set<() => void>();

function load(): ReminderPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved) return DEFAULT_REMINDER_PREFS;
    return { ...DEFAULT_REMINDER_PREFS, ...saved, kinds: { ...DEFAULT_REMINDER_PREFS.kinds, ...saved.kinds } };
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

let current: ReminderPrefs = typeof localStorage === 'undefined' ? DEFAULT_REMINDER_PREFS : load();

export function getReminderPrefs(): ReminderPrefs {
  return current;
}

export function updateReminderPrefs(patch: Partial<ReminderPrefs>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function toggleReminderSkip(cellKey: string): boolean {
  const skipped = current.skips.includes(cellKey);
  // Keep the list small: drop skips for dates more than a week past
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const kept = current.skips.filter((k) => k !== cellKey && k.slice(0, 10) >= cutoff);
  updateReminderPrefs({ skips: skipped ? kept : [...kept, cellKey] });
  return !skipped;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(subscribe, getReminderPrefs, getReminderPrefs);
}
