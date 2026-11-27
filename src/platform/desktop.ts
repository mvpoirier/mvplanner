// The Claude desktop app's `desktop` capability, when MVPlanner runs as an installed Mac app.
// On GitHub Pages (or any normal browser) there is no `window.claude`, and everything here is null.

export type DesktopPermission = 'notifications' | 'shortcuts' | 'overlay' | 'menu-bar' | 'full-access';
export type DesktopPermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable';

interface DesktopStats {
  mtimeMs: number;
  isFile: boolean;
  isDirectory: boolean;
}
interface DesktopDirEntry {
  name: string;
  isDirectory: boolean;
}
interface TrayMenuItem {
  label?: string;
  type?: 'normal' | 'separator';
  enabled?: boolean;
  click?: () => void;
}

/** The parts of the desktop API MVPlanner uses (see the capability's desktop.d.ts). */
export interface DesktopApi {
  install: {
    state(): Promise<'available' | 'installed' | 'unavailable'>;
    request(): Promise<'installed' | 'cancelled' | 'unavailable' | 'failed'>;
  };
  permissions?: {
    state(name: DesktopPermission): Promise<DesktopPermissionState>;
    request(names?: DesktopPermission[]): Promise<Record<DesktopPermission, DesktopPermissionState>>;
    manage(): Promise<void>;
  };
  window?: {
    setOptions(o: Record<string, unknown>): Promise<unknown>;
    show(): Promise<void>;
  };
  app?: { dock: { setIcon(png: string): Promise<unknown>; setBadge(text: string): Promise<boolean> } };
  fs?: {
    readFile(path: string, encoding: 'utf8'): Promise<string>;
    writeFile(path: string, data: string, encoding?: 'utf8'): Promise<void>;
    stat(path: string): Promise<DesktopStats>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    readdir(path: string): Promise<DesktopDirEntry[]>;
    rename(from: string, to: string): Promise<void>;
  };
  shell?: { showItemInFolder(path: string): Promise<void> };
  notification?: { show(o: { body: string }): Promise<void> };
  tray?: {
    set(o: { title?: string; icon?: string; toolTip?: string; menu?: TrayMenuItem[] }): Promise<boolean>;
    remove(): Promise<void>;
  };
}

type ClaudeGlobal = { use(name: string): Promise<unknown> };

let desktopPromise: Promise<DesktopApi | null> | null = null;

/** The desktop API (resolves null outside Claude). Only `install` exists outside the installed app. */
export function getDesktop(): Promise<DesktopApi | null> {
  if (!desktopPromise) {
    desktopPromise = (async () => {
      // window.claude is provided by the artifact host; give it a moment to appear.
      let claude: ClaudeGlobal | undefined;
      for (let i = 0; i < 10 && !claude; i++) {
        claude = (window as unknown as { claude?: ClaudeGlobal }).claude;
        if (!claude) await new Promise((r) => setTimeout(r, 100));
      }
      if (!claude?.use) return null;
      try {
        const api = (await Promise.race([
          claude.use('desktop'),
          new Promise((r) => setTimeout(() => r(null), 10_000)),
        ])) as DesktopApi | null;
        return api ?? null;
      } catch {
        return null;
      }
    })();
  }
  return desktopPromise;
}

/** Non-null only inside the installed Mac app, where files and the menu bar are reachable. */
export async function getDesktopApp(): Promise<DesktopApi | null> {
  const d = await getDesktop();
  return d?.fs ? d : null;
}

export const errCode = (err: unknown) => (err instanceof Error ? err.message.split(':')[0] : '');

export interface CloudFolder {
  label: string;
  path: string; // folder that the cloud app syncs
}

/** Folders on this Mac that a cloud app keeps in sync, best first. Needs full access. */
export async function findCloudFolders(d: DesktopApi): Promise<CloudFolder[]> {
  const fs = d.fs!;
  const out: CloudFolder[] = [];
  const isDir = async (p: string) => {
    try {
      return (await fs.stat(p)).isDirectory;
    } catch {
      return false;
    }
  };
  try {
    for (const e of await fs.readdir('~/Library/CloudStorage')) {
      if (!e.isDirectory) continue;
      const base = `~/Library/CloudStorage/${e.name}`;
      if (e.name.startsWith('OneDrive')) out.push({ label: e.name.replace(/^OneDrive-?/, 'OneDrive ').trim(), path: base });
      else if (e.name.startsWith('Dropbox')) out.push({ label: 'Dropbox', path: base });
      else if (e.name.startsWith('GoogleDrive')) {
        const my = `${base}/My Drive`;
        out.push({ label: `Google Drive (${e.name.replace(/^GoogleDrive-/, '')})`, path: (await isDir(my)) ? my : base });
      } else if (e.name.startsWith('Box')) out.push({ label: 'Box', path: base });
    }
  } catch {
    /* no CloudStorage folder */
  }
  const icloud = '~/Library/Mobile Documents/com~apple~CloudDocs';
  if (await isDir(icloud)) out.push({ label: 'iCloud Drive', path: icloud });
  for (const [label, p] of [
    ['Dropbox', '~/Dropbox'],
    ['OneDrive', '~/OneDrive'],
  ] as const) {
    if (!out.some((f) => f.label.startsWith(label)) && (await isDir(p))) out.push({ label, path: p });
  }
  out.push({ label: 'Documents (this Mac only)', path: '~/Documents' });
  return out;
}

export const syncPathIn = (folder: string) => `${folder.replace(/\/+$/, '')}/MVPlanner/mvplanner-workspace.json`;
