// Mac app extras (only inside the installed app): Dock icon, next lesson in the menu bar,
// and a notification 5 minutes before each lesson. Elsewhere it just reports whether the
// page can be installed as an app.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { agendaFor, menuBarText } from '../engine/todayAgenda';
import { todayISO } from '../engine/dateUtils';
import { getDesktop, type DesktopApi, type DesktopPermission } from '../platform/desktop';

const PREFS_KEY = 'mvplanner-desktop-prefs';
const REMIND_MIN = 5;

interface Prefs {
  menuBar: boolean;
  reminders: boolean;
}
const loadPrefs = (): Prefs => {
  try {
    return { menuBar: false, reminders: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { menuBar: false, reminders: false };
  }
};

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
  menuBar: boolean;
  reminders: boolean;
  setMenuBar: (on: boolean) => Promise<void>;
  setReminders: (on: boolean) => Promise<void>;
  problem: string | null;
}

export function useDesktopApp(binder: AcademicYearBinder, schedule: ResolvedSchedule): DesktopAppControls {
  const [desktop, setDesktop] = useState<DesktopApi | null>(null);
  const [installState, setInstallState] = useState<DesktopAppControls['installState']>('unavailable');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [problem, setProblem] = useState<string | null>(null);
  const notified = useRef(new Set<string>());
  const dataRef = useRef({ binder, schedule });
  dataRef.current = { binder, schedule };

  useEffect(() => {
    let alive = true;
    void getDesktop().then(async (d) => {
      if (!alive || !d) return;
      setDesktop(d);
      setInstallState(await d.install.state().catch(() => 'unavailable' as const));
      if (d.fs) d.app?.dock.setIcon(drawIcon()).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isApp = !!desktop?.fs;

  const savePrefs = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* storage unavailable */
    }
  };

  /** Ask for a permission from a click; false (with a message) if refused. */
  const ensure = useCallback(
    async (name: DesktopPermission, what: string) => {
      if (!desktop?.permissions) return false;
      const st = (await desktop.permissions.request([name]).catch(() => null))?.[name];
      if (st === 'granted') return true;
      setProblem(
        st === 'denied'
          ? `${what} was turned off for MVPlanner. Turn it on in the app's Permissions (MVPlanner menu).`
          : `${what} isn't available on this Mac.`,
      );
      return false;
    },
    [desktop],
  );

  const setMenuBar = useCallback(
    async (on: boolean) => {
      setProblem(null);
      if (on && !(await ensure('menu-bar', 'The menu bar item'))) return;
      if (!on) await desktop?.tray?.remove().catch(() => undefined);
      savePrefs({ ...prefs, menuBar: on });
    },
    [desktop, ensure, prefs],
  );

  const setReminders = useCallback(
    async (on: boolean) => {
      setProblem(null);
      if (on && !(await ensure('notifications', 'Notifications'))) return;
      savePrefs({ ...prefs, reminders: on });
    },
    [ensure, prefs],
  );

  // Every 30 s: refresh the menu bar item and send any lesson reminder that is due.
  useEffect(() => {
    if (!isApp || (!prefs.menuBar && !prefs.reminders)) return;
    const tick = async () => {
      const { binder: b, schedule: s } = dataRef.current;
      const today = todayISO();
      const items = agendaFor(b, s, today);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      if (prefs.menuBar && (await desktop!.permissions?.state('menu-bar')) === 'granted') {
        await desktop!.tray
          ?.set({
            title: menuBarText(items, nowMin),
            toolTip: 'Today in MVPlanner',
            menu: [
              ...(items.length
                ? items.map((i) => ({
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

      if (prefs.reminders && (await desktop!.permissions?.state('notifications')) === 'granted') {
        for (const i of items) {
          const key = `${today}-${i.periodLabel}`;
          const due = i.startMin - REMIND_MIN;
          if (nowMin >= due && nowMin < i.startMin && !notified.current.has(key)) {
            notified.current.add(key);
            await desktop!.notification
              ?.show({ body: `In ${i.startMin - nowMin} min · ${i.periodLabel} ${i.title}${i.note ? ` — ${i.note}` : ''}`.slice(0, 300) })
              .catch(() => undefined);
          }
        }
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 30_000);
    return () => clearInterval(t);
  }, [desktop, isApp, prefs]);

  const install = useCallback(async () => {
    if (!desktop) return;
    const res = await desktop.install.request().catch(() => 'failed' as const);
    if (res === 'installed') setInstallState('installed');
  }, [desktop]);

  return {
    isApp,
    installState,
    install,
    menuBar: prefs.menuBar,
    reminders: prefs.reminders,
    setMenuBar,
    setReminders,
    problem,
  };
}
