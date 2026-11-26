import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { usePlannerStore } from './store/usePlannerStore';
import { resolveSchedule } from './engine/cycleEngine';
import { SidePanel } from './components/SidePanel';
import { BinderSpread } from './components/BinderSpread';
import { FlatGridView } from './components/FlatGridView';
import { PhoneAgendaView } from './components/PhoneAgendaView';
import { AnnotationDock } from './components/AnnotationDock';
import { FloatingEditBar, type ActiveEditTarget } from './components/FloatingEditBar';
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
  const canUndo = usePlannerStore((s) => s.past.length > 0);
  const canRedo = usePlannerStore((s) => s.future.length > 0);

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);

  const [activeEdit, setActiveEdit] = useState<ActiveEditTarget | null>(null);
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  const [flipKey, setFlipKey] = useState(0);

  const [googleSession, setGoogleSession] = useState<GoogleAuthSession | null>(null);
  const [conflictRemote, setConflictRemote] = useState<{
    workspace: PlannerWorkspace;
    modifiedTime: string;
    fileId: string;
  } | null>(null);

  const lastSyncedRev = useRef(0);

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
      setActiveEdit(null);
      setFlipDir(clamped > safeWeekIdx ? 'next' : 'prev');
      setFlipKey((k) => k + 1);
      setWeekIndex(clamped);
    },
    [safeWeekIdx, schedule.weeks.length, setWeekIndex],
  );

  // Close inline editor when clicking outside the edited cell or floating mini-toolbar
  useEffect(() => {
    if (!activeEdit) return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('.tt-slot.editing') || el.closest('.floating-toolbar')) return;
      setActiveEdit(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [activeEdit]);

  // Keyboard shortcuts
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
      if (!inField && !shelfOpen && !wizardOpen && !exportOpen && !activeEdit) {
        if (e.key === 'ArrowLeft') goToWeek(safeWeekIdx - 1);
        if (e.key === 'ArrowRight') goToWeek(safeWeekIdx + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToWeek, safeWeekIdx, undo, redo, shelfOpen, wizardOpen, exportOpen, activeEdit]);

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
  }, [dirtyRevision, googleSession, workspace, setSyncStatus, updateGoogleSync, showToast]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading MVPlanner…
      </div>
    );
  }

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

  const handleStartEdit = (
    date: string,
    periodId: string,
    rect: { top: number; bottom: number; left: number; width: number },
  ) => {
    setSelectedCell({ date, periodId });
    setActiveEdit({ date, periodId, rect });
  };

  return (
    <div className={`min-h-screen w-full ${fontClass}`}>
      {/* Single Auto-Hide Corner Button + Slide-Out Overlay Side Panel */}
      <SidePanel
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        onClose={() => setPanelOpen(false)}
        binder={activeBinder}
        schedule={schedule}
        weekIndex={safeWeekIdx}
        coverTheme={workspace.uiPreferences.coverTheme}
        noteFont={workspace.uiPreferences.noteFont}
        viewMode={viewMode}
        isLockedEnabled={Boolean(lockPassphrase)}
        syncStatus={syncStatus}
        googleEmail={googleSession?.profile?.email ?? null}
        canUndo={canUndo}
        canRedo={canRedo}
        onPrevWeek={() => goToWeek(safeWeekIdx - 1)}
        onNextWeek={() => goToWeek(safeWeekIdx + 1)}
        onSelectWeek={goToWeek}
        onCoverChange={setCoverTheme}
        onToggleFont={() =>
          setNoteFont(workspace.uiPreferences.noteFont === 'handwritten' ? 'sans' : 'handwritten')
        }
        onViewChange={(m) => {
          setActiveEdit(null);
          setViewMode(m);
        }}
        onUndo={undo}
        onRedo={redo}
        onOpenShelf={() => setShelfOpen(true)}
        onOpenWizard={() => setWizardOpen(true)}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenGoogleSync={() => setGoogleOpen(true)}
      />

      {/* Full-Screen Desk Stage */}
      <main
        className={`desk-stage ${viewMode !== 'phone' ? 'desk-fullscreen' : 'flex-col py-12 px-3'}`}
      >
        {viewMode === 'binder' && (
          <BinderSpread
            binder={activeBinder}
            schedule={schedule}
            week={currentWeek}
            coverTheme={workspace.uiPreferences.coverTheme}
            flipDir={flipDir}
            flipKey={flipKey}
            canPrev={safeWeekIdx > 0}
            canNext={safeWeekIdx < schedule.weeks.length - 1}
            selectedCell={selectedCell}
            editingCell={activeEdit ? { date: activeEdit.date, periodId: activeEdit.periodId } : null}
            onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
            onStartEdit={handleStartEdit}
            onStopEdit={() => setActiveEdit(null)}
            onPrevWeek={() => goToWeek(safeWeekIdx - 1)}
            onNextWeek={() => goToWeek(safeWeekIdx + 1)}
            onJumpWeek={goToWeek}
          />
        )}

        {viewMode === 'flat' && (
          <FlatGridView
            binder={activeBinder}
            schedule={schedule}
            week={currentWeek}
            selectedCell={selectedCell}
            editingCell={activeEdit ? { date: activeEdit.date, periodId: activeEdit.periodId } : null}
            onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
            onStartEdit={handleStartEdit}
            onStopEdit={() => setActiveEdit(null)}
          />
        )}

        {viewMode === 'phone' && (
          <div className="w-full max-w-md mx-auto">
            <PhoneAgendaView
              binder={activeBinder}
              week={currentWeek}
              dayIndex={phoneDayIndex}
              selectedCell={selectedCell}
              onSelectDay={setPhoneDayIndex}
              onSelectCell={(date, periodId) => setSelectedCell({ date, periodId })}
            />
            {selectedCell && (
              <AnnotationDock
                binder={activeBinder}
                schedule={schedule}
                week={currentWeek}
                selectedCell={selectedCell}
              />
            )}
          </div>
        )}
      </main>

      {/* Floating Mini-Toolbar (only visible while double-click inline editing) */}
      {activeEdit && viewMode !== 'phone' && (
        <FloatingEditBar
          binder={activeBinder}
          schedule={schedule}
          week={currentWeek}
          target={activeEdit}
          onDone={() => setActiveEdit(null)}
        />
      )}

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

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 text-white text-xs font-medium px-3.5 py-2.5 shadow-xl max-w-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
