import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { usePlannerStore } from './store/usePlannerStore';
import { formatWeekHeading, resolveSchedule } from './engine/cycleEngine';
import { TopToolbar } from './components/TopToolbar';
import { BinderSpread } from './components/BinderSpread';
import { FlatGridView } from './components/FlatGridView';
import { PhoneAgendaView } from './components/PhoneAgendaView';
import { AnnotationDock } from './components/AnnotationDock';
import { BinderShelfModal } from './components/BinderShelfModal';
import { ExportStudioModal } from './components/ExportStudioModal';
import { SetupWizardModal } from './components/SetupWizardModal';
import { SetupDrawer } from './components/SetupDrawer';
import { GoogleSyncDrawer } from './components/GoogleSyncDrawer';
import type { GoogleAuthSession } from './services/googleAuth';
import { saveWorkspaceToDrive } from './services/googleDriveSync';
import type { PlannerWorkspace } from './types/planner';

export default function App() {
  const workspace = usePlannerStore((s) => s.workspace);
  const hydrated = usePlannerStore((s) => s.hydrated);
  const locked = usePlannerStore((s) => s.locked);
  const lockPassphrase = usePlannerStore((s) => s.lockPassphrase);
  const weekIndex = usePlannerStore((s) => s.weekIndex);
  const phoneDayIndex = usePlannerStore((s) => s.phoneDayIndex);
  const viewMode = usePlannerStore((s) => s.viewMode);
  const selectedCell = usePlannerStore((s) => s.selectedCell);
  const toastMessage = usePlannerStore((s) => s.toastMessage);
  const syncStatus = usePlannerStore((s) => s.syncStatus);
  const dirtyRevision = usePlannerStore((s) => s.dirtyRevision);

  const hydrate = usePlannerStore((s) => s.hydrate);
  const unlockWithPassphrase = usePlannerStore((s) => s.unlockWithPassphrase);
  const setWeekIndex = usePlannerStore((s) => s.setWeekIndex);
  const setPhoneDayIndex = usePlannerStore((s) => s.setPhoneDayIndex);
  const setViewMode = usePlannerStore((s) => s.setViewMode);
  const setSelectedCell = usePlannerStore((s) => s.setSelectedCell);
  const setCoverTheme = usePlannerStore((s) => s.setCoverTheme);
  const setNoteFont = usePlannerStore((s) => s.setNoteFont);
  const undo = usePlannerStore((s) => s.undo);
  const redo = usePlannerStore((s) => s.redo);
  const setSyncStatus = usePlannerStore((s) => s.setSyncStatus);
  const updateGoogleSync = usePlannerStore((s) => s.updateGoogleSync);
  const showToast = usePlannerStore((s) => s.showToast);

  const [unlockInput, setUnlockInput] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);

  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  const [flipKey, setFlipKey] = useState(0);

  const [googleSession, setGoogleSession] = useState<GoogleAuthSession | null>(null);
  const [conflictRemote, setConflictRemote] = useState<{
    workspace: PlannerWorkspace;
    modifiedTime: string;
    fileId: string;
  } | null>(null);

  const lastSyncedRev = useRef(0);

  // Hydrate from IndexedDB on mount & auto-activate Phone view on narrow viewports
  useEffect(() => {
    hydrate();
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('phone');
    }
  }, [hydrate, setViewMode]);

  const activeBinder =
    workspace.binders[workspace.activeBinderId] ?? Object.values(workspace.binders)[0];

  const schedule = useMemo(() => resolveSchedule(activeBinder), [activeBinder]);
  const safeWeekIdx = Math.min(Math.max(0, weekIndex), Math.max(0, schedule.weeks.length - 1));
  const currentWeek = schedule.weeks[safeWeekIdx];

  const goToWeek = useCallback(
    (targetIdx: number) => {
      const clamped = Math.min(Math.max(0, targetIdx), schedule.weeks.length - 1);
      if (clamped === safeWeekIdx) return;
      setFlipDir(clamped > safeWeekIdx ? 'next' : 'prev');
      setFlipKey((k) => k + 1);
      setWeekIndex(clamped);
    },
    [safeWeekIdx, schedule.weeks.length, setWeekIndex],
  );

  // Keyboard shortcuts: Left/Right arrows flip weeks; Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (!inField && !shelfOpen && !wizardOpen && !exportOpen) {
        if (e.key === 'ArrowLeft') goToWeek(safeWeekIdx - 1);
        if (e.key === 'ArrowRight') goToWeek(safeWeekIdx + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToWeek, safeWeekIdx, undo, redo, shelfOpen, wizardOpen, exportOpen]);

  // Debounced auto-save to private Google Drive JSON (2s after edits when signed in)
  useEffect(() => {
    if (!googleSession || dirtyRevision === 0 || dirtyRevision === lastSyncedRev.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const res = await saveWorkspaceToDrive(googleSession.accessToken, workspace, {
          fileId: workspace.googleSync?.driveFileId,
          expectedRemoteModifiedTime: workspace.googleSync?.remoteModifiedTime,
        });
        if (res.status === 'conflict' && res.remoteWorkspace) {
          setConflictRemote({
            workspace: res.remoteWorkspace,
            modifiedTime: res.modifiedTime,
            fileId: res.fileId,
          });
          setSyncStatus('conflict', 'Remote Drive file changed on another device.');
          showToast('Google Drive sync conflict — open Google Sync to resolve.');
        } else {
          lastSyncedRev.current = dirtyRevision;
          updateGoogleSync({
            driveFileId: res.fileId,
            remoteModifiedTime: res.modifiedTime,
            lastSyncedAt: new Date().toISOString(),
          });
          setSyncStatus('saved');
        }
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Auto-sync failed.');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    dirtyRevision,
    googleSession,
    workspace,
    setSyncStatus,
    updateGoogleSync,
    showToast,
  ]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading MVPlanner…
      </div>
    );
  }

  // Local AES-GCM Passphrase Unlock Gate
  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1b4487] text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">MVPlanner Locked</h1>
              <p className="text-xs text-slate-500">
                Enter your AES-GCM passphrase to unlock this browser&apos;s binder
              </p>
            </div>
          </div>
          <input
            type="password"
            value={unlockInput}
            onChange={(e) => {
              setUnlockInput(e.target.value);
              setUnlockErr('');
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const ok = await unlockWithPassphrase(unlockInput);
                if (!ok) setUnlockErr('Incorrect passphrase. Try again.');
              }
            }}
            placeholder="Passphrase…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            autoFocus
          />
          {unlockErr && <div className="text-xs text-red-600 font-medium">{unlockErr}</div>}
          <button
            type="button"
            onClick={async () => {
              const ok = await unlockWithPassphrase(unlockInput);
              if (!ok) setUnlockErr('Incorrect passphrase. Try again.');
            }}
            className="w-full py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer"
          >
            Unlock Binder
          </button>
        </div>
      </div>
    );
  }

  const fontClass =
    workspace.uiPreferences.noteFont === 'handwritten' ? 'font-handwritten' : 'font-sans';

  const cycleSummaryStr = currentWeek.days
    .map((d) => d.occurrenceTag ?? (d.classification.pause ? 'Paused' : '—'))
    .join(' · ');

  return (
    <div className={`min-h-screen flex flex-col ${fontClass}`}>
      <TopToolbar
        binder={activeBinder}
        schedule={schedule}
        weekIndex={safeWeekIdx}
        coverTheme={workspace.uiPreferences.coverTheme}
        noteFont={workspace.uiPreferences.noteFont}
        viewMode={viewMode}
        isLockedEnabled={Boolean(lockPassphrase)}
        syncStatus={syncStatus}
        googleEmail={googleSession?.profile?.email ?? null}
        onPrevWeek={() => goToWeek(safeWeekIdx - 1)}
        onNextWeek={() => goToWeek(safeWeekIdx + 1)}
        onSelectWeek={goToWeek}
        onCoverChange={setCoverTheme}
        onToggleFont={() =>
          setNoteFont(workspace.uiPreferences.noteFont === 'handwritten' ? 'sans' : 'handwritten')
        }
        onViewChange={setViewMode}
        onOpenShelf={() => setShelfOpen(true)}
        onOpenWizard={() => setWizardOpen(true)}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenGoogleSync={() => setGoogleOpen(true)}
      />

      <main className="desk-stage flex-1 px-3 md:px-10 py-4">
        <div className="max-w-[1280px] mx-auto">
          {/* Sub-header info strip */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-800 shadow-2xs">
                {formatWeekHeading(currentWeek)} · ({cycleSummaryStr})
              </span>
              {activeBinder.id === 'demo-2026-2027' && !googleSession && (
                <span className="text-[11px] text-slate-500">
                  Interactive zero-PII demo —{' '}
                  <button
                    type="button"
                    onClick={() => setGoogleOpen(true)}
                    className="underline font-semibold text-blue-700 cursor-pointer"
                  >
                    Sign in with Google
                  </button>{' '}
                  or click{' '}
                  <button
                    type="button"
                    onClick={() => setWizardOpen(true)}
                    className="underline font-semibold text-blue-700 cursor-pointer"
                  >
                    New Planner
                  </button>{' '}
                  to build yours.
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3a3f47] inline-block" />
                Pencil
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1648a8] inline-block" />
                Blue
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c02323] inline-block" />
                Red Urgent
              </span>
            </div>
          </div>

          {/* Active View */}
          {viewMode === 'binder' && (
            <BinderSpread
              binder={activeBinder}
              schedule={schedule}
              week={currentWeek}
              coverTheme={workspace.uiPreferences.coverTheme}
              flipDir={flipDir}
              flipKey={flipKey}
              selectedCell={selectedCell}
              onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
              onJumpWeek={goToWeek}
            />
          )}

          {viewMode === 'flat' && (
            <FlatGridView
              binder={activeBinder}
              schedule={schedule}
              week={currentWeek}
              selectedCell={selectedCell}
              onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
            />
          )}

          {viewMode === 'phone' && (
            <PhoneAgendaView
              binder={activeBinder}
              week={currentWeek}
              dayIndex={phoneDayIndex}
              selectedCell={selectedCell}
              onSelectDay={setPhoneDayIndex}
              onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
            />
          )}

          {/* Inline Editor & Smart Bump Dock */}
          <AnnotationDock
            binder={activeBinder}
            schedule={schedule}
            week={currentWeek}
            selectedCell={selectedCell}
          />
        </div>
      </main>

      {/* Modals & Drawers */}
      <BinderShelfModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        onOpenWizard={() => setWizardOpen(true)}
      />

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <SetupDrawer open={setupOpen} onClose={() => setSetupOpen(false)} binder={activeBinder} />

      <ExportStudioModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        binder={activeBinder}
        schedule={schedule}
      />

      <GoogleSyncDrawer
        open={googleOpen}
        onClose={() => setGoogleOpen(false)}
        binder={activeBinder}
        session={googleSession}
        onSessionChange={setGoogleSession}
        conflictRemote={conflictRemote}
        onClearConflict={() => setConflictRemote(null)}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 text-white text-xs font-medium px-3.5 py-2.5 shadow-xl max-w-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
