// Linked sync file: saves the workspace to a .json file the teacher picks on their own computer
// (File System Access API). If that file lives in a folder synced by OneDrive / Dropbox / iCloud /
// Google Drive for desktop, the cloud copy happens with no sign-in from MVPlanner at all.
// Supported in Chromium browsers (Chrome, Edge, Brave, Arc…). Other browsers get manual backup buttons.

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import type { PlannerWorkspace } from '../types/planner';
import { decryptJSON, encryptJSON, isEncryptedEnvelope } from '../store/cryptoLock';
import { errCode, getDesktopApp, type DesktopApi } from '../platform/desktop';

const HANDLE_IDB_KEY = 'mvplanner-linked-file-handle';
export const SYNC_FILE_SUGGESTED_NAME = 'mvplanner-workspace.json';

// Minimal typings for the parts of the File System Access API that TypeScript's DOM lib lacks.
type PermissionMode = { mode: 'read' | 'readwrite' };
interface BrowserFileHandle extends FileSystemFileHandle {
  queryPermission(desc: PermissionMode): Promise<PermissionState>;
  requestPermission(desc: PermissionMode): Promise<PermissionState>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

/**
 * Where the sync file lives: a file the person picked in the browser (File System Access API),
 * or a path on disk when MVPlanner runs as the installed Mac app.
 */
export interface SyncFileHandle {
  kind: 'handle' | 'path';
  name: string;
  /** Path on disk (Mac app only). */
  path?: string;
  queryPermission(): Promise<PermissionState>;
  /** Must be called from a click: browsers and the Mac app both require a user gesture. */
  requestPermission(): Promise<PermissionState>;
  lastModified(): Promise<number>;
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  /** What to keep in IndexedDB to find this file again next time. */
  persisted(): unknown;
}

export function wrapBrowserHandle(h: BrowserFileHandle): SyncFileHandle {
  return {
    kind: 'handle',
    name: h.name,
    queryPermission: () => h.queryPermission({ mode: 'readwrite' }),
    requestPermission: async () =>
      (await h.queryPermission({ mode: 'readwrite' })) === 'granted'
        ? 'granted'
        : h.requestPermission({ mode: 'readwrite' }),
    lastModified: async () => (await h.getFile()).lastModified,
    readText: async () => (await h.getFile()).text(),
    writeText: async (text) => {
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
    },
    persisted: () => h,
  };
}

/** Mac app: a plain path, read and written directly — no picker, no re-prompt after restarts. */
export function pathTarget(d: DesktopApi, path: string): SyncFileHandle {
  const fs = d.fs!;
  const toPerm = (st: string): PermissionState =>
    st === 'granted' ? 'granted' : st === 'prompt' ? 'prompt' : 'denied';
  return {
    kind: 'path',
    name: path.split('/').pop() || path,
    path,
    queryPermission: async () => toPerm((await d.permissions?.state('full-access')) ?? 'denied'),
    requestPermission: async () => toPerm((await d.permissions?.request(['full-access']))?.['full-access'] ?? 'denied'),
    lastModified: async () => {
      try {
        return (await fs.stat(path)).mtimeMs;
      } catch (err) {
        if (errCode(err) === 'ENOENT') return 0;
        throw err;
      }
    },
    readText: async () => {
      try {
        return await fs.readFile(path, 'utf8');
      } catch (err) {
        if (errCode(err) === 'ENOENT') return '';
        throw err;
      }
    },
    writeText: async (text) => {
      await fs.mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
      // Write beside, then swap in, so a cloud app never syncs a half-written file.
      const tmp = `${path}.saving`;
      await fs.writeFile(tmp, text, 'utf8');
      await fs.rename(tmp, path);
    },
    persisted: () => ({ kind: 'path', path }),
  };
}
interface PickerOptions {
  suggestedName?: string;
  id?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
}
type FsWindow = Window & {
  showSaveFilePicker?: (opts?: PickerOptions) => Promise<BrowserFileHandle>;
  showOpenFilePicker?: (opts?: PickerOptions & { multiple?: boolean }) => Promise<BrowserFileHandle[]>;
};

const PICKER_TYPES: PickerOptions['types'] = [
  { description: 'MVPlanner workspace', accept: { 'application/json': ['.json'] } },
];

export function isFileSyncSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as FsWindow;
  return typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
}

/** True when the user closed the picker without choosing — not an error worth showing. */
export function isPickerCancel(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function pickNewSyncFile(): Promise<SyncFileHandle> {
  const w = window as FsWindow;
  return wrapBrowserHandle(
    await w.showSaveFilePicker!({
      suggestedName: SYNC_FILE_SUGGESTED_NAME,
      id: 'mvplanner-sync',
      types: PICKER_TYPES,
    }),
  );
}

export async function pickExistingSyncFile(): Promise<SyncFileHandle> {
  const w = window as FsWindow;
  const [handle] = await w.showOpenFilePicker!({
    id: 'mvplanner-sync',
    types: PICKER_TYPES,
    multiple: false,
  });
  return wrapBrowserHandle(handle);
}

export async function rememberHandle(handle: SyncFileHandle): Promise<void> {
  await idbSet(HANDLE_IDB_KEY, handle.persisted());
}

export async function loadRememberedHandle(): Promise<SyncFileHandle | null> {
  try {
    const saved = (await idbGet(HANDLE_IDB_KEY)) as unknown;
    if (!saved) return null;
    // Browser file handle (also how files linked before the Mac app existed were saved)
    if (typeof (saved as BrowserFileHandle).getFile === 'function') {
      return wrapBrowserHandle(saved as BrowserFileHandle);
    }
    const rec = saved as { kind?: string; path?: string };
    if (rec.kind === 'path' && rec.path) {
      const d = await getDesktopApp();
      return d ? pathTarget(d, rec.path) : null; // a path only means something inside the Mac app
    }
    return null;
  } catch {
    return null;
  }
}

export async function forgetHandle(): Promise<void> {
  await idbDel(HANDLE_IDB_KEY);
}

/** 'granted' | 'prompt' | 'denied'. Never shows a prompt. */
export async function checkPermission(handle: SyncFileHandle): Promise<PermissionState> {
  return handle.queryPermission();
}

/** Must be called from a click handler (browsers require a user gesture). */
export async function askPermission(handle: SyncFileHandle): Promise<boolean> {
  return (await handle.requestPermission()) === 'granted';
}

export interface SyncFileSnapshot {
  /** null when the file is empty (freshly created) */
  workspace: PlannerWorkspace | null;
  lastModified: number;
}

export class SyncFileLockedError extends Error {
  constructor() {
    super(
      'This sync file is passphrase-locked. Turn on the same passphrase lock in this browser to open it.',
    );
  }
}

export function isValidWorkspace(data: unknown): data is PlannerWorkspace {
  const ws = data as PlannerWorkspace | null;
  return !!ws && ws.schemaVersion === 1 && !!ws.binders && !!ws.binders[ws.activeBinderId];
}

/** Parse file text into a workspace (decrypting when the file is passphrase-locked). */
export async function parseSyncFileText(
  text: string,
  passphrase: string | null,
): Promise<PlannerWorkspace | null> {
  if (text.trim() === '') return null;
  let data: unknown = JSON.parse(text);
  if (isEncryptedEnvelope(data)) {
    if (!passphrase) throw new SyncFileLockedError();
    data = await decryptJSON<PlannerWorkspace>(data, passphrase);
  }
  if (!isValidWorkspace(data)) {
    throw new Error("That file isn't an MVPlanner workspace.");
  }
  return data;
}

export async function readSyncFile(
  handle: SyncFileHandle,
  passphrase: string | null,
): Promise<SyncFileSnapshot> {
  const lastModified = await handle.lastModified();
  const workspace = await parseSyncFileText(await handle.readText(), passphrase);
  return { workspace, lastModified };
}

export async function getSyncFileLastModified(handle: SyncFileHandle): Promise<number> {
  return handle.lastModified();
}

/** Serialise the workspace (encrypted when a passphrase lock is on) and write it. Returns new lastModified. */
export async function writeSyncFile(
  handle: SyncFileHandle,
  workspace: PlannerWorkspace,
  passphrase: string | null,
): Promise<number> {
  const payload = passphrase ? await encryptJSON(workspace, passphrase) : workspace;
  await handle.writeText(JSON.stringify(payload, null, 2));
  return handle.lastModified();
}

const ts = (iso?: string) => (iso ? Date.parse(iso) || 0 : 0);

/**
 * Which copy should win when the app opens or a file is linked?
 * Whichever workspace was edited most recently (by its updatedAt stamp).
 */
export function pickNewerCopy(
  local: PlannerWorkspace,
  file: PlannerWorkspace | null,
): 'file' | 'local' | 'same' {
  if (!file) return 'local';
  const a = ts(local.updatedAt);
  const b = ts(file.updatedAt);
  if (a === b) return 'same';
  return b > a ? 'file' : 'local';
}
