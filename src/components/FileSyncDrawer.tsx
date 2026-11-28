// Linked sync file drawer: no-sign-in sync via a .json file in a folder the teacher's own cloud app
// (OneDrive, Dropbox, iCloud, Google Drive for desktop) already syncs. Falls back to manual
// download / open buttons in browsers without the File System Access API (Safari, Firefox).

import React, { useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FilePlus2,
  FolderOpen,
  FolderSync,
  KeyRound,
  Link2Off,
  Upload,
  X,
} from 'lucide-react';
import type { FileSyncControls } from '../hooks/useLocalFileSync';
import { usePlannerStore } from '../store/usePlannerStore';
import { parseSyncFileText, SYNC_FILE_SUGGESTED_NAME } from '../services/localFileSync';
import { encryptJSON } from '../store/cryptoLock';

interface FileSyncDrawerProps {
  open: boolean;
  onClose: () => void;
  sync: FileSyncControls;
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition';
const primary = `${btn} bg-blue-700 text-white hover:bg-blue-800`;
const secondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

export const FileSyncDrawer: React.FC<FileSyncDrawerProps> = ({ open, onClose, sync }) => {
  const replaceWorkspace = usePlannerStore((s) => s.replaceWorkspace);
  const showToast = usePlannerStore((s) => s.showToast);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // ---- Fallback for browsers without the File System Access API ----
  const downloadCopy = async () => {
    const { workspace, lockPassphrase } = usePlannerStore.getState();
    const payload = lockPassphrase ? await encryptJSON(workspace, lockPassphrase) : workspace;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = SYNC_FILE_SUGGESTED_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const openCopy = async (file: File) => {
    try {
      const ws = await parseSyncFileText(await file.text(), usePlannerStore.getState().lockPassphrase);
      if (!ws) throw new Error('That file is empty.');
      replaceWorkspace(ws);
      showToast(`Loaded ${file.name}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open that file.');
    }
  };

  const { status } = sync;
  const linked = status === 'idle' || status === 'saving' || status === 'conflict' || status === 'error';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FolderSync className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sync File</h2>
              <p className="text-[11px] text-slate-500">
                No sign-in · Uses OneDrive, Dropbox, iCloud or Google Drive for desktop
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4">
          {status === 'unsupported' && (
            <>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4" /> Automatic file sync needs Chrome or Edge
                </div>
                <p>
                  This browser can&apos;t keep a file linked, so saving and loading are manual here. Your
                  planner still saves automatically inside this browser.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={primary} onClick={() => void downloadCopy()}>
                  <Download className="w-3.5 h-3.5" /> Download a copy
                </button>
                <button type="button" className={secondary} onClick={() => fileInput.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Open a copy
                </button>
              </div>
              <p className="text-slate-500">
                Opening a copy replaces what&apos;s in this browser with the file&apos;s contents.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void openCopy(f);
                  e.target.value = '';
                }}
              />
            </>
          )}

          {status === 'unlinked' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-slate-700">
                <p className="font-bold text-slate-900">How it works</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Save your sync file inside a folder your cloud app already syncs (e.g.{' '}
                    <span className="font-mono">OneDrive</span> or <span className="font-mono">Dropbox</span>).
                  </li>
                  <li>MVPlanner saves every change to that file automatically.</li>
                  <li>On another computer, choose &ldquo;Open existing sync file&rdquo; and pick the same file.</li>
                </ol>
              </div>
              <div className="space-y-2">
                <button type="button" className={`${primary} w-full`} onClick={() => void sync.createFile()}>
                  <FilePlus2 className="w-3.5 h-3.5" /> Create a new sync file
                </button>
                <button
                  type="button"
                  className={`${secondary} w-full`}
                  onClick={() => void sync.openExistingFile()}
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Open existing sync file
                </button>
                <p className="text-slate-500">
                  Opening an existing file loads its contents and replaces what&apos;s in this browser —
                  use it when setting up a second computer.
                </p>
              </div>
            </>
          )}

          {status === 'needs-permission' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 space-y-2.5 text-blue-900">
              <div className="flex items-center gap-1.5 font-bold">
                <KeyRound className="w-4 h-4" /> Allow access to {sync.fileName ?? 'your sync file'}
              </div>
              <p>
                Your browser asks again after it restarts. Choose <strong>&ldquo;Allow on every visit&rdquo;</strong>{' '}
                if it&apos;s offered and you won&apos;t be asked next time.
              </p>
              <button type="button" className={`${primary} w-full`} onClick={() => void sync.reconnect()}>
                Reconnect
              </button>
            </div>
          )}

          {linked && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                {status === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{sync.fileName}</div>
                  <div className="text-[11px] text-slate-500">
                    {status === 'saving' ? 'Saving…' : `Last saved ${fmtTime(sync.lastSavedAt)}`}
                  </div>
                </div>
              </div>
              <p className="text-slate-600">
                Changes save automatically. When you come back to this tab, newer changes from your other
                computers are loaded.
              </p>
              <div className="flex gap-2">
                <button type="button" className={secondary} onClick={() => void sync.saveNow()}>
                  Save now
                </button>
                <button type="button" className={secondary} onClick={() => void sync.unlink()}>
                  <Link2Off className="w-3.5 h-3.5" /> Unlink
                </button>
              </div>
            </div>
          )}

          {status === 'conflict' && (
            <div className="rounded-xl border border-amber-400 bg-amber-50 p-3.5 space-y-2.5 text-amber-900">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4" /> The file changed on another computer
              </div>
              <p>
                Both this browser and the sync file have changes the other doesn&apos;t. Choose which copy to
                keep — the other will be replaced.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={secondary} onClick={() => void sync.resolveConflict('file')}>
                  Use the file&apos;s copy
                </button>
                <button type="button" className={primary} onClick={() => void sync.resolveConflict('mine')}>
                  Keep this browser&apos;s
                </button>
              </div>
            </div>
          )}

          {sync.error && status !== 'conflict' && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-800 space-y-2">
              <div>{sync.error}</div>
              {status === 'error' && (
                <button type="button" className={secondary} onClick={() => void sync.unlink()}>
                  Unlink and choose the file again
                </button>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            If you&apos;ve turned on the passphrase lock, the sync file is encrypted with the same
            passphrase.
          </p>
        </div>
      </div>
    </div>
  );
};
