// Mac app extras (only inside the installed app): Dock icon, next lesson in the menu bar,
// and a notification 5 minutes before each lesson. Elsewhere it just reports whether the
// page can be installed as an app.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { agendaFor, dueReminders, menuBarText, reminderText } from '../engine/todayAgenda';
import { getReminderPrefs, useReminderPrefs } from '../store/reminderPrefs';
import { todayISO } from '../engine/dateUtils';
import { getDesktop, type DesktopApi } from '../platform/desktop';

export type NotifyAccess = 'granted' | 'prompt' | 'denied' | 'unsupported';

/** 256 px app icon: navy binder cover, white page, two silver rings, "MV". */
function drawIcon(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  const cover = g.createLinearGradient(0, 0, 256, 256);
  cover.addColorStop(0, '#2457a7');
  cover.addColorStop(1, '#15376f');
  rr(16, 16, 224, 224, 50);
  g.fillStyle = cover;
  g.fill();
  rr(62, 44, 152, 168, 10);
  g.fillStyle = '#f8f8f5';
  g.fill();
  g.fillStyle = '#fde68a';
  g.fillRect(150, 150, 46, 44); // a sticky note
  for (const y of [92, 164]) {
    rr(40, y - 8, 46, 16, 8);
    g.fillStyle = '#c7ced9';
    g.fill();
  }
  g.fillStyle = '#1d3f7a';
  g.font = '800 54px -apple-system, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('MV', 138, 132);
  return c.toDataURL('image/png');
}

export interface DesktopAppControls {
  /** Running as the installed Mac app. */
  isApp: boolean;
  /** 'available' → show an "Install as Mac app" button. */
  installState: 'available' | 'installed' | 'unavailable';
  install: () => Promise<void>;
  /** Can reminders reach the screen? (Mac notifications, or the browser's) */
  notifyAccess: NotifyAccess;
  /** From a click: ask for notification (and, in the Mac app, menu bar) access. */
  allowNotifications: () => Promise<void>;
  menuBarAccess: NotifyAccess;
  sendTestReminder: () => Promise<void>;
  problem: string | null;
}

const browserNotifyAccess = (): NotifyAccess => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
};
const fromDesktop = (st: string | undefined): NotifyAccess =>
  st === 'granted' ? 'granted' : st === 'prompt' ? 'prompt' : st === 'denied' ? 'denied' : 'unsupported';

export function useDesktopApp(binder: AcademicYearBinder, schedule: ResolvedSchedule): DesktopAppControls {
  const [desktop, setDesktop] = useState<DesktopApi | null>(null);
  const [installState, setInstallState] = useState<DesktopAppControls['installState']>('unavailable');
  const [notifyAccess, setNotifyAccess] = useState<NotifyAccess>(browserNotifyAccess);
  const [menuBarAccess, setMenuBarAccess] = useState<NotifyAccess>('unsupported');
  const [problem, setProblem] = useState<string | null>(null);
  const prefs = useReminderPrefs();
  const sent = useRef(new Set<string>());
  const dataRef = useRef({ binder, schedule });
  dataRef.current = { binder, schedule };
  const isApp = !!desktop?.fs;

  const refreshAccess = useCallback(async (d: DesktopApi | null) => {
    if (d?.fs && d.permissions) {
      setNotifyAccess(fromDesktop(await d.permissions.state('notifications').catch(() => undefined)));
      setMenuBarAccess(fromDesktop(await d.permissions.state('menu-bar').catch(() => undefined)));
    } else {
      setNotifyAccess(browserNotifyAccess());
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void getDesktop().then(async (d) => {
      if (!alive || !d) return;
      setDesktop(d);
      setInstallState(await d.install.state().catch(() => 'unavailable' as const));
      if (d.fs) d.app?.dock.setIcon(drawIcon()).catch(() => undefined);
      await refreshAccess(d);
    });
    return () => {
      alive = false;
    };
  }, [refreshAccess]);

  const show = useCallback(
    async (body: string) => {
      if (desktop?.fs) {
        await desktop.notification?.show({ body });
      } else if (browserNotifyAccess() === 'granted') {
        new Notification('MVPlanner', { body, tag: body });
      }
    },
    [desktop],
  );

  const allowNotifications = useCallback(async () => {
    setProblem(null);
    if (desktop?.fs && desktop.permissions) {
      const res = await desktop.permissions.request(['notifications', 'menu-bar']).catch(() => null);
      if (res?.notifications === 'denied' || res?.['menu-bar'] === 'denied') {
        setProblem("Turned off for MVPlanner. Turn them back on in the app's Permissions (MVPlanner menu).");
      }
    } else if (typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      if (res === 'denied') setProblem("Your browser is blocking notifications for this site. Allow them in the site's settings.");
    }
    await refreshAccess(desktop);
  }, [desktop, refreshAccess]);

  const sendTestReminder = useCallback(async () => {
    const { binder: b, schedule: s } = dataRef.current;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const next = agendaFor(b, s, todayISO()).find((i) => i.startMin > nowMin);
    await show(
      next ? `Test · ${reminderText(next, nowMin, getReminderPrefs().includeNote)}` : 'Test · Reminders are working.',
    ).catch(() => setProblem("Couldn't show a notification."));
  }, [show]);

  // Every 30 s: refresh the menu bar item and send any reminder that is due.
  useEffect(() => {
    const wantsNotify = prefs.enabled && notifyAccess === 'granted';
    const wantsMenuBar = isApp && prefs.menuBar && menuBarAccess === 'granted';
    if (!wantsNotify && !wantsMenuBar) {
      if (isApp) desktop?.tray?.remove().catch(() => undefined);
      return;
    }
    const tick = async () => {
      const { binder: b, schedule: s } = dataRef.current;
      const today = todayISO();
      const items = agendaFor(b, s, today);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const p = getReminderPrefs();

      if (wantsMenuBar) {
        await desktop!.tray
          ?.set({
            title: menuBarText(items, nowMin),
            toolTip: 'Today in MVPlanner',
            menu: [
              ...(items.length
                ? items
                    .filter((i) => i.kind !== 'free')
                    .map((i) => ({
                      label: `${i.start}  ${i.periodLabel}  ${i.title}${i.note ? ` — ${i.note.slice(0, 40)}` : ''}`,
                      enabled: false,
                    }))
                : [{ label: 'No lessons today', enabled: false }]),
              { type: 'separator' as const },
              { label: 'Open MVPlanner', click: () => void desktop!.window?.show() },
            ],
          })
          .catch(() => undefined);
      }

      if (wantsNotify && p.pausedOn !== today) {
        for (const i of dueReminders(items, nowMin, p, sent.current)) {
          sent.current.add(i.cellKey);
          await show(reminderText(i, nowMin, p.includeNote)).catch(() => undefined);
        }
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 30_000);
    return () => clearInterval(t);
  }, [desktop, isApp, prefs.enabled, prefs.menuBar, notifyAccess, menuBarAccess, show]);

  const install = useCallback(async () => {
    if (!desktop) return;
    const res = await desktop.install.request().catch(() => 'failed' as const);
    if (res === 'installed') setInstallState('installed');
  }, [desktop]);

  return {
    isApp,
    installState,
    install,
    notifyAccess,
    allowNotifications,
    menuBarAccess,
    sendTestReminder,
    problem,
  };
}

