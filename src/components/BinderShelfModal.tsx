// Multi-Year Binder Shelf Modal: switch, archive (read-only), clone to new year, delete,
// manage AES-GCM local passphrase lock, and import/restore JSON workspace backups.

import React, { useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  Copy,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { resolveSchedule } from '../engine/cycleEngine';
import { decryptJSON, isEncryptedEnvelope } from '../store/cryptoLock';
import type { PlannerWorkspace } from '../types/planner';

interface BinderShelfModalProps {
  open: boolean;
  onClose: () => void;
  onOpenWizard: () => void;
}

export const BinderShelfModal: React.FC<BinderShelfModalProps> = ({
  open,
  onClose,
  onOpenWizard,
}) => {
  const workspace = usePlannerStore((s) => s.workspace);
  const lockPassphrase = usePlannerStore((s) => s.lockPassphrase);
  const switchBinder = usePlannerStore((s) => s.switchBinder);
  const toggleArchiveBinder = usePlannerStore((s) => s.toggleArchiveBinder);
  const deleteBinder = usePlannerStore((s) => s.deleteBinder);
  const cloneBinderToNewYear = usePlannerStore((s) => s.cloneBinderToNewYear);
  const enableLocalLock = usePlannerStore((s) => s.enableLocalLock);
  const disableLocalLock = usePlannerStore((s) => s.disableLocalLock);
  const replaceWorkspace = usePlannerStore((s) => s.replaceWorkspace);
  const showToast = usePlannerStore((s) => s.showToast);

  const [newPass, setNewPass] = useState('');
  const [importPass, setImportPass] = useState('');
  const [pendingEncrypted, setPendingEncrypted] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const binders = Object.values(workspace.binders);

  const handleQuickClone = (id: string, title: string) => {
    const nextYear = title.replace(/(\d{4})/g, (y) => String(Number(y) + 1));
    const finalTitle = nextYear !== title ? nextYear : `${title} (Next Year)`;
    const src = workspace.binders[id];
    const bumpYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
    cloneBinderToNewYear(
      id,
      finalTitle,
      bumpYear(src.startDate),
      bumpYear(src.endDate),
      bumpYear(src.firstCycleDate),
    );
  };

  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (isEncryptedEnvelope(parsed)) {
        setPendingEncrypted(parsed);
        showToast('Encrypted JSON detected — enter passphrase below to restore.');
        return;
      }
      if (parsed?.schemaVersion === 1 && parsed?.binders) {
        replaceWorkspace(parsed as PlannerWorkspace);
        showToast('Workspace restored from JSON backup.');
        onClose();
      } else {
        showToast('Unrecognized MVPlanner JSON format.');
      }
    } catch {
      showToast('Failed to read JSON file.');
    }
  };

  const handleDecryptImport = async () => {
    if (!isEncryptedEnvelope(pendingEncrypted)) return;
    try {
      const ws = await decryptJSON<PlannerWorkspace>(pendingEncrypted, importPass);
      replaceWorkspace(ws);
      setPendingEncrypted(null);
      setImportPass('');
      showToast('Encrypted workspace decrypted & restored!');
      onClose();
    } catch {
      showToast('Incorrect passphrase for encrypted backup.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Multi-Year Binder Shelf &amp; Local Privacy
              </h2>
              <p className="text-xs text-slate-500">
                Switch school years, archive past binders, clone settings forward, or lock local storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Binders List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                Your Binders ({binders.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWizard();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Year Wizard
              </button>
            </div>

            <div className="space-y-2">
              {binders.map((b) => {
                const isActive = b.id === workspace.activeBinderId;
                const sched = resolveSchedule(b);
                const planCount = Object.keys(b.cellPlans).length;
                return (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2 ${
                      isActive ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{b.title}</span>
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                            Active
                          </span>
                        )}
                        {b.archived && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                            Archived (Read-Only)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {b.startDate} → {b.endDate} · {sched.summary.totalTeachingWeeks} teaching wks ·{' '}
                        {sched.summary.totalInstructionalDays} days · {planCount} saved notes
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            switchBinder(b.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-md bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleQuickClone(b.id, b.title)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 font-medium cursor-pointer"
                        title="Clone courses, colors & bell rows into next academic year (clears lesson notes)"
                      >
                        <Copy className="w-3 h-3" /> Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchiveBinder(b.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 font-medium cursor-pointer"
                      >
                        <Archive className="w-3 h-3" /> {b.archived ? 'Unarchive' : 'Archive'}
                      </button>
                      {binders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteBinder(b.id)}
                          className="p-1 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 cursor-pointer"
                          title="Delete binder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local AES-GCM Passphrase Lock */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                {lockPassphrase ? (
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                )}
                Local Browser AES-GCM Passphrase Lock
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  lockPassphrase
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {lockPassphrase ? 'Encrypted' : 'Unencrypted'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Encrypts your IndexedDB workspace on this browser with Web Crypto AES-256-GCM (useful on shared classroom computers).
            </p>
            {lockPassphrase ? (
              <button
                type="button"
                onClick={() => disableLocalLock()}
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Remove Passphrase Lock
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter a passphrase (min 6 chars)…"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={newPass.trim().length < 6}
                  onClick={async () => {
                    await enableLocalLock(newPass.trim());
                    setNewPass('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-40 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Enable Lock
                </button>
              </div>
            )}
          </div>

          {/* Restore Workspace JSON */}
          <div className="rounded-lg border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Restore from JSON Backup</div>
                <div className="text-[11px] text-slate-500">
                  Supports both plain and AES-GCM encrypted MVPlanner `.json` archives
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportJson(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Choose JSON…
              </button>
            </div>

            {pendingEncrypted !== null && (
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <input
                  type="password"
                  value={importPass}
                  onChange={(e) => setImportPass(e.target.value)}
                  placeholder="Enter backup passphrase…"
                  className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleDecryptImport}
                  className="px-3 py-1.5 rounded-md bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Decrypt &amp; Restore
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
