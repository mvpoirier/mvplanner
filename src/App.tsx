import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { usePlannerStore } from './store/usePlannerStore';
import { locateToday, resolveSchedule } from './engine/cycleEngine';
import { todayISO } from './engine/dateUtils';
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
import { FileSyncDrawer } from './components/FileSyncDrawer';
import { useLocalFileSync } from './hooks/useLocalFileSync';
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
  const dirtyRevision = usePlannerStore((s) => s.dirtyRevision);
  const localSaveStatus = usePlannerStore((s) => s.localSaveStatus);
  const lastLocalSavedAt = usePlannerStore((s) => s.lastLocalSavedAt);
  const canUndo = usePlannerStore((s) => s.past.length > 0);
  const canRedo = usePlannerStore((s) => s.future.length > 0);

  const hydrate = usePlannerStore((s) => s.hydrate);
  const flushPersist = usePlannerStore((s) => s.flushPersist);
  const unlockWithPassphrase = usePlannerStore((s) => s.unlockWithPassphrase);
  const setWeekIndex = usePlannerStore((s) => s.setWeekIndex);
  const setPhoneDayIndex = usePlannerStore((s) => s.setPhoneDayIndex);
  const setViewMode = usePlannerStore((s) => s.setViewMode);
  const setSelectedCell = usePlannerStore((s) => s.setSelectedCell);
  const setCoverTheme = usePlannerStore((s) => s.setCoverTheme);
  const setNoteFont = usePlannerStore((s) => s.setNoteFont);
  const undo = usePlannerStore((s) => s.undo);
  const redo = usePlannerStore((s) => s.redo);
  const showToast = usePlannerStore((s) => s.showToast);

  const [unlockInput, setUnlockInput] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fileSyncOpen, setFileSyncOpen] = useState(false);
  const fileSync = useLocalFileSync();
  const fileSyncSaveNow = fileSync.saveNow;

  const [activeEdit, setActiveEdit] = useState<ActiveEditTarget | null>(null);
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  const [flipKey, setFlipKey] = useState(0);

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

  const [showSaveBadge, setShowSaveBadge] = useState(false);

  const finishEditingCell = useCallback(() => {
    setActiveEdit(null);
    void flushPersist();
    void fileSyncSaveNow();
  }, [flushPersist, fileSyncSaveNow]);

  const goToWeek = useCallback(
    (targetIdx: number) => {
      const clamped = Math.min(Math.max(0, targetIdx), schedule.weeks.length - 1);
      if (clamped === safeWeekIdx) return;
      if (activeEdit) finishEditingCell();
      setFlipDir(clamped > safeWeekIdx ? 'next' : 'prev');
      setFlipKey((k) => k + 1);
      setWeekIndex(clamped);
    },
    [safeWeekIdx, schedule.weeks.length, setWeekIndex, activeEdit, finishEditingCell],
  );

  const goToToday = useCallback(() => {
    const pos = locateToday(schedule, todayISO());
    goToWeek(pos.weekIndex);
    setPhoneDayIndex(pos.dayIndex);
  }, [schedule, goToWeek, setPhoneDayIndex]);

  // Close inline editor & auto-save immediately when clicking outside
  useEffect(() => {
    if (!activeEdit) return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('.tt-slot.editing') || el.closest('.floating-toolbar')) return;
      finishEditingCell();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [activeEdit, finishEditingCell]);

  // Flush pending local save if tab is hidden or closed
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushPersist();
    };
    const onPageHide = () => {
      void flushPersist();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flushPersist]);

  // Show subtle bottom-left save badge briefly after each save
  useEffect(() => {
    if (localSaveStatus === 'idle') return;
    setShowSaveBadge(true);
    if (localSaveStatus === 'saving') return;
    const t = setTimeout(() => setShowSaveBadge(false), 2600);
    return () => clearTimeout(t);
  }, [localSaveStatus, lastLocalSavedAt]);

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
        if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) goToToday();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToWeek, goToToday, safeWeekIdx, undo, redo, shelfOpen, wizardOpen, exportOpen, activeEdit]);

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
        canUndo={canUndo}
        canRedo={canRedo}
        onPrevWeek={() => goToWeek(safeWeekIdx - 1)}
        onNextWeek={() => goToWeek(safeWeekIdx + 1)}
        onSelectWeek={goToWeek}
        onJumpToday={goToToday}
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
        fileSyncStatus={fileSync.status}
        fileSyncName={fileSync.fileName}
        onOpenFileSync={() => setFileSyncOpen(true)}
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
            onStopEdit={finishEditingCell}
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
            onStopEdit={finishEditingCell}
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
          onDone={finishEditingCell}
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

      {/* Sync file needs attention: visible without opening the side panel */}
      {!fileSyncOpen && (fileSync.status === 'needs-permission' || fileSync.status === 'conflict' || fileSync.status === 'error') && (
        <button
          type="button"
          onClick={() => {
            if (fileSync.status === 'needs-permission') void fileSync.reconnect();
            else setFileSyncOpen(true);
          }}
          className={`fixed bottom-14 left-4 z-40 rounded-full px-3.5 py-1.5 text-[11px] font-semibold shadow-md border cursor-pointer ${
            fileSync.status === 'needs-permission'
              ? 'bg-blue-700 border-blue-800 text-white hover:bg-blue-800'
              : 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100'
          }`}
        >
          {fileSync.status === 'needs-permission'
            ? `Reconnect ${fileSync.fileName ?? 'sync file'}`
            : fileSync.status === 'conflict'
              ? 'Sync file changed elsewhere — choose a copy'
              : 'Sync file problem — tap to fix'}
        </button>
      )}

      <FileSyncDrawer open={fileSyncOpen} onClose={() => setFileSyncOpen(false)} sync={fileSync} />

      {/* Subtle Auto-Save Status Pill (fades away cleanly when idle) */}
      {showSaveBadge && (
        <div className="fixed bottom-4 left-4 z-40 rounded-full px-3 py-1 text-[11px] font-semibold shadow-md border backdrop-blur transition-opacity bg-white/90 border-slate-200 text-slate-700">
          {localSaveStatus === 'saving'
            ? 'Saving…'
            : fileSync.status === 'idle'
              ? 'Saved to sync file ✓'
              : 'Saved locally ✓'}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 text-white text-xs font-medium px-3.5 py-2.5 shadow-xl max-w-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
