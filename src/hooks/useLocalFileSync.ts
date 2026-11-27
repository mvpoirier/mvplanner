// Keeps the in-browser workspace and the linked sync file in step:
//  • on open: loads the file if it is newer, or writes ours if we are newer
//  • on every edit: saves to the file (debounced), plus immediately when a cell edit finishes
//  • when the tab regains focus: picks up changes another device synced into the file
//  • if both sides changed: pauses and asks which copy to keep

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import type { PlannerWorkspace } from '../types/planner';
import {
  askPermission,
  checkPermission,
  forgetHandle,
  getSyncFileLastModified,
  isFileSyncSupported,
  isPickerCancel,
  loadRememberedHandle,
  pickExistingSyncFile,
  pickNewSyncFile,
  pickNewerCopy,
  readSyncFile,
  rememberHandle,
  SyncFileLockedError,
  writeSyncFile,
  pathTarget,
  type SyncFileHandle,
} from '../services/localFileSync';
import { findCloudFolders, getDesktopApp, syncPathIn, type CloudFolder, type DesktopApi } from '../platform/desktop';

export type FileSyncStatus =
  | 'unsupported' // browser has no File System Access API
  | 'unlinked' // no file chosen yet
  | 'needs-permission' // file remembered, but browser wants a click to allow access again
  | 'idle' // linked and up to date
  | 'saving'
  | 'conflict'
  | 'error';

export interface FileSyncState {
  status: FileSyncStatus;
  fileName: string | null;
  lastSavedAt: string | null;
  error: string | null;
  conflictFileWorkspace: PlannerWorkspace | null;
  /** Running as the installed Mac app: sync by folder path, no file picker. */
  desktopMode: boolean;
  /** Path of the linked file (Mac app only). */
  filePath: string | null;
  cloudFolders: CloudFolder[] | null;
}

export interface FileSyncControls extends FileSyncState {
  /** Mac app: list iCloud / OneDrive / Dropbox / Google Drive folders (asks for file access once). */
  findCloudFolders: () => Promise<void>;
  /** Mac app: use (or create) MVPlanner/mvplanner-workspace.json inside this folder. */
  linkFolder: (folder: string) => Promise<void>;
  revealFile: () => Promise<void>;
  createFile: () => Promise<void>;
  openExistingFile: () => Promise<void>;
  reconnect: () => Promise<void>;
  unlink: () => Promise<void>;
  saveNow: () => Promise<void>;
  resolveConflict: (keep: 'mine' | 'file') => Promise<void>;
}

const SAVE_DEBOUNCE_MS = 800;

function describeError(err: unknown): string {
  if (err instanceof SyncFileLockedError) return err.message;
  if (err instanceof DOMException) {
    if (err.name === 'NotFoundError') return 'The sync file was moved or deleted. Link it again.';
    if (err.name === 'NotAllowedError') return 'The browser blocked access to the sync file.';
  }
  if (err instanceof SyntaxError) return "The sync file isn't valid JSON — it may be damaged.";
  return err instanceof Error ? err.message : 'Sync file error.';
}

export function useLocalFileSync(): FileSyncControls {
  const hydrated = usePlannerStore((s) => s.hydrated);
  const locked = usePlannerStore((s) => s.locked);
  const dirtyRevision = usePlannerStore((s) => s.dirtyRevision);

  const [state, setState] = useState<FileSyncState>(() => ({
    status: isFileSyncSupported() ? 'unlinked' : 'unsupported',
    fileName: null,
    lastSavedAt: null,
    error: null,
    conflictFileWorkspace: null,
    desktopMode: false,
    filePath: null,
    cloudFolders: null,
  }));
  const desktopRef = useRef<DesktopApi | null>(null);
  const patch = useCallback((p: Partial<FileSyncState>) => setState((s) => ({ ...s, ...p })), []);

  const handleRef = useRef<SyncFileHandle | null>(null);
  const knownModifiedRef = useRef<number | null>(null); // file lastModified after our last read/write
  const syncedRevRef = useRef<number>(-1); // store dirtyRevision that the file matches
  const busyRef = useRef(false);
  const pendingRef = useRef(false);
  const activeRef = useRef(false); // linked + permission granted + not in conflict
  const statusRef = useRef<FileSyncStatus>(state.status);
  statusRef.current = state.status;

  const passphrase = () => usePlannerStore.getState().lockPassphrase;
  const hasUnsavedChanges = () => usePlannerStore.getState().dirtyRevision !== syncedRevRef.current;

  const applyFileWorkspace = useCallback((ws: PlannerWorkspace) => {
    usePlannerStore.getState().replaceWorkspace(ws);
    syncedRevRef.current = usePlannerStore.getState().dirtyRevision;
  }, []);

  const fail = useCallback(
    (err: unknown) => {
      activeRef.current = false;
      const notAllowed = err instanceof DOMException && err.name === 'NotAllowedError';
      patch({ status: notAllowed ? 'needs-permission' : 'error', error: describeError(err) });
    },
    [patch],
  );

  const enterConflict = useCallback(
    (fileWs: PlannerWorkspace | null, modified: number) => {
      activeRef.current = false;
      knownModifiedRef.current = modified;
      patch({ status: 'conflict', conflictFileWorkspace: fileWs, error: null });
    },
    [patch],
  );

  /** Write the current workspace to the file. */
  const writeNow = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    const { workspace, dirtyRevision: rev } = usePlannerStore.getState();
    patch({ status: 'saving' });
    knownModifiedRef.current = await writeSyncFile(handle, workspace, passphrase());
    syncedRevRef.current = rev;
    activeRef.current = true;
    patch({ status: 'idle', lastSavedAt: new Date().toISOString(), error: null, conflictFileWorkspace: null });
  }, [patch]);

  /** Auto-save path: refuses to overwrite changes another device synced into the file. */
  const saveNow = useCallback(async () => {
    if (!activeRef.current || !handleRef.current || !hasUnsavedChanges()) return;
    if (busyRef.current) {
      pendingRef.current = true;
      return;
    }
    busyRef.current = true;
    try {
      const handle = handleRef.current;
      const current = await getSyncFileLastModified(handle);
      if (knownModifiedRef.current !== null && current !== knownModifiedRef.current) {
        const snap = await readSyncFile(handle, passphrase());
        enterConflict(snap.workspace, snap.lastModified);
        return;
      }
      await writeNow();
    } catch (err) {
      fail(err);
    } finally {
      busyRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void saveNow();
      }
    }
  }, [enterConflict, fail, writeNow]);

  /** Bring file and browser in step, newest copy wins. Used on app open and after reconnecting. */
  const reconcile = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    busyRef.current = true;
    try {
      const snap = await readSyncFile(handle, passphrase());
      knownModifiedRef.current = snap.lastModified;
      const local = usePlannerStore.getState().workspace;
      const winner = pickNewerCopy(local, snap.workspace);
      activeRef.current = true;
      if (winner === 'file' && snap.workspace) {
        applyFileWorkspace(snap.workspace);
        usePlannerStore.getState().showToast('Loaded the latest version from your sync file.');
        patch({ status: 'idle', error: null });
      } else if (winner === 'local') {
        await writeNow();
      } else {
        syncedRevRef.current = usePlannerStore.getState().dirtyRevision;
        patch({ status: 'idle', error: null });
      }
    } catch (err) {
      fail(err);
    } finally {
      busyRef.current = false;
    }
  }, [applyFileWorkspace, fail, patch, writeNow]);

  const adoptHandle = useCallback(
    async (handle: SyncFileHandle) => {
      handleRef.current = handle;
      await rememberHandle(handle);
      patch({ fileName: handle.name, filePath: handle.path ?? null });
    },
    [patch],
  );

  // On startup (after IndexedDB hydrate & passphrase unlock): reconnect to the remembered file.
  useEffect(() => {
    if (!hydrated || locked) return;
    let cancelled = false;
    void (async () => {
      const desktop = await getDesktopApp();
      if (cancelled) return;
      if (desktop) {
        desktopRef.current = desktop;
        patch({ desktopMode: true });
        setState((st) => (st.status === 'unsupported' ? { ...st, status: 'unlinked' } : st));
      }
      const handle = await loadRememberedHandle();
      if (!handle || cancelled) return;
      handleRef.current = handle;
      patch({ fileName: handle.name, filePath: handle.path ?? null });
      try {
        const perm = await checkPermission(handle);
        if (cancelled) return;
        if (perm === 'granted') await reconcile();
        else patch({ status: 'needs-permission', error: null });
      } catch (err) {
        fail(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, locked, patch, reconcile, fail]);

  // Debounced auto-save after every edit.
  useEffect(() => {
    if (!activeRef.current || dirtyRevision === syncedRevRef.current) return;
    const t = setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [dirtyRevision, saveNow]);

  // When returning to the tab, pick up anything another device synced into the file.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const handle = handleRef.current;
      if (!activeRef.current || !handle || busyRef.current) return;
      busyRef.current = true;
      try {
        const current = await getSyncFileLastModified(handle);
        if (current === knownModifiedRef.current) return;
        const snap = await readSyncFile(handle, passphrase());
        if (hasUnsavedChanges()) {
          enterConflict(snap.workspace, snap.lastModified);
        } else {
          knownModifiedRef.current = snap.lastModified;
          if (snap.workspace && pickNewerCopy(usePlannerStore.getState().workspace, snap.workspace) !== 'same') {
            applyFileWorkspace(snap.workspace);
            usePlannerStore.getState().showToast('Loaded newer changes from your sync file.');
          }
        }
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
      }
    };
    const onVis = () => void check();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [applyFileWorkspace, enterConflict, fail]);

  // Best-effort save when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveNow();
    };
    const onPageHide = () => void saveNow();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [saveNow]);

  // ---- User actions (each called from a click, which the browser requires) ----

  const createFile = useCallback(async () => {
    try {
      const handle = await pickNewSyncFile();
      await adoptHandle(handle);
      knownModifiedRef.current = null;
      await writeNow();
      usePlannerStore.getState().showToast(`Linked ${handle.name} — changes now save there automatically.`);
    } catch (err) {
      if (!isPickerCancel(err)) fail(err);
    }
  }, [adoptHandle, fail, writeNow]);

  const openExistingFile = useCallback(async () => {
    try {
      const handle = await pickExistingSyncFile();
      if (!(await askPermission(handle))) {
        patch({ status: 'needs-permission', fileName: handle.name });
        return;
      }
      const snap = await readSyncFile(handle, passphrase());
      await adoptHandle(handle);
      knownModifiedRef.current = snap.lastModified;
      activeRef.current = true;
      if (snap.workspace) {
        // Explicitly opening a file means "use what's in it" — e.g. setting up a second computer.
        applyFileWorkspace(snap.workspace);
        patch({ status: 'idle', error: null, conflictFileWorkspace: null });
        usePlannerStore.getState().showToast(`Opened ${handle.name} — changes now save there automatically.`);
      } else {
        await writeNow();
      }
    } catch (err) {
      if (!isPickerCancel(err)) fail(err);
    }
  }, [adoptHandle, applyFileWorkspace, fail, patch, writeNow]);

  const reconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    try {
      if (await askPermission(handle)) await reconcile();
      else patch({ status: 'needs-permission' });
    } catch (err) {
      fail(err);
    }
  }, [fail, patch, reconcile]);

  const findFolders = useCallback(async () => {
    const d = desktopRef.current;
    if (!d) return;
    try {
      const perm = (await d.permissions?.request(['full-access']))?.['full-access'];
      if (perm !== 'granted') {
        patch({ error: 'MVPlanner needs file access to find your cloud folders. Allow it when asked.' });
        return;
      }
      patch({ cloudFolders: await findCloudFolders(d), error: null });
    } catch (err) {
      fail(err);
    }
  }, [fail, patch]);

  const linkFolder = useCallback(
    async (folder: string) => {
      const d = desktopRef.current;
      if (!d) return;
      try {
        const target = pathTarget(d, syncPathIn(folder));
        if (!(await askPermission(target))) {
          patch({ status: 'needs-permission', error: 'File access was not allowed.' });
          return;
        }
        const snap = await readSyncFile(target, passphrase());
        await adoptHandle(target);
        knownModifiedRef.current = snap.lastModified;
        activeRef.current = true;
        if (snap.workspace) {
          // A file is already there (e.g. saved from another computer): use what's in it.
          applyFileWorkspace(snap.workspace);
          patch({ status: 'idle', error: null, conflictFileWorkspace: null });
          usePlannerStore.getState().showToast('Found your sync file there and loaded it.');
        } else {
          await writeNow();
          usePlannerStore.getState().showToast('Sync file created — changes now save there automatically.');
        }
      } catch (err) {
        fail(err);
      }
    },
    [adoptHandle, applyFileWorkspace, fail, patch, writeNow],
  );

  const revealFile = useCallback(async () => {
    const path = handleRef.current?.path;
    if (path) await desktopRef.current?.shell?.showItemInFolder(path).catch(() => undefined);
  }, []);

  const unlink = useCallback(async () => {
    activeRef.current = false;
    handleRef.current = null;
    knownModifiedRef.current = null;
    await forgetHandle();
    patch({
      status: desktopRef.current || isFileSyncSupported() ? 'unlinked' : 'unsupported',
      fileName: null,
      filePath: null,
      error: null,
      conflictFileWorkspace: null,
      lastSavedAt: null,
    });
  }, [patch]);

  const resolveConflict = useCallback(
    async (keep: 'mine' | 'file') => {
      try {
        if (keep === 'file' && state.conflictFileWorkspace) {
          applyFileWorkspace(state.conflictFileWorkspace);
          activeRef.current = true;
          patch({ status: 'idle', conflictFileWorkspace: null, error: null });
        } else {
          await writeNow(); // overwrite the file with this browser's copy
        }
      } catch (err) {
        fail(err);
      }
    },
    [applyFileWorkspace, fail, patch, state.conflictFileWorkspace, writeNow],
  );

  return {
    ...state,
    createFile,
    openExistingFile,
    reconnect,
    unlink,
    saveNow,
    resolveConflict,
    findCloudFolders: findFolders,
    linkFolder,
    revealFile,
  };
}
