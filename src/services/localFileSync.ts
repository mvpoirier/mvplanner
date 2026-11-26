// Linked sync file: saves the workspace to a .json file the teacher picks on their own computer
// (File System Access API). If that file lives in a folder synced by OneDrive / Dropbox / iCloud /
// Google Drive for desktop, the cloud copy happens with no sign-in from MVPlanner at all.
// Supported in Chromium browsers (Chrome, Edge, Brave, Arc…). Other browsers get manual backup buttons.

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import type { PlannerWorkspace } from '../types/planner';
import { decryptJSON, encryptJSON, isEncryptedEnvelope } from '../store/cryptoLock';

const HANDLE_IDB_KEY = 'mvplanner-linked-file-handle';
export const SYNC_FILE_SUGGESTED_NAME = 'mvplanner-workspace.json';

// Minimal typings for the parts of the File System Access API that TypeScript's DOM lib lacks.
type PermissionMode = { mode: 'read' | 'readwrite' };
export interface SyncFileHandle extends FileSystemFileHandle {
  queryPermission(desc: PermissionMode): Promise<PermissionState>;
  requestPermission(desc: PermissionMode): Promise<PermissionState>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}
interface PickerOptions {
  suggestedName?: string;
  id?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
}
type FsWindow = Window & {
  showSaveFilePicker?: (opts?: PickerOptions) => Promise<SyncFileHandle>;
  showOpenFilePicker?: (opts?: PickerOptions & { multiple?: boolean }) => Promise<SyncFileHandle[]>;
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
  return w.showSaveFilePicker!({
    suggestedName: SYNC_FILE_SUGGESTED_NAME,
    id: 'mvplanner-sync',
    types: PICKER_TYPES,
  });
}

export async function pickExistingSyncFile(): Promise<SyncFileHandle> {
  const w = window as FsWindow;
  const [handle] = await w.showOpenFilePicker!({
    id: 'mvplanner-sync',
    types: PICKER_TYPES,
    multiple: false,
  });
  return handle;
}

export async function rememberHandle(handle: SyncFileHandle): Promise<void> {
  await idbSet(HANDLE_IDB_KEY, handle);
}

export async function loadRememberedHandle(): Promise<SyncFileHandle | null> {
  try {
    return ((await idbGet(HANDLE_IDB_KEY)) as SyncFileHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function forgetHandle(): Promise<void> {
  await idbDel(HANDLE_IDB_KEY);
}

/** 'granted' | 'prompt' | 'denied'. Never shows a prompt. */
export async function checkPermission(handle: SyncFileHandle): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'readwrite' });
}

/** Must be called from a click handler (browsers require a user gesture). */
export async function askPermission(handle: SyncFileHandle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
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
  const file = await handle.getFile();
  const workspace = await parseSyncFileText(await file.text(), passphrase);
  return { workspace, lastModified: file.lastModified };
}

export async function getSyncFileLastModified(handle: SyncFileHandle): Promise<number> {
  return (await handle.getFile()).lastModified;
}

/** Serialise the workspace (encrypted when a passphrase lock is on) and write it. Returns new lastModified. */
export async function writeSyncFile(
  handle: SyncFileHandle,
  workspace: PlannerWorkspace,
  passphrase: string | null,
): Promise<number> {
  const payload = passphrase ? await encryptJSON(workspace, passphrase) : workspace;
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
  return getSyncFileLastModified(handle);
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
