import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Redo2, Undo2 } from 'lucide-react';
import { usePlannerStore } from './store/usePlannerStore';
import { locateToday, resolveSchedule, resolveSlot } from './engine/cycleEngine';
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
import { SearchBox } from './components/SearchBox';
import { CalendarImportModal } from './components/CalendarImportModal';
import { RemindersDrawer } from './components/RemindersDrawer';
import { SequencePrompt } from './components/SequencePrompt';
import { UnitPlannerModal } from './components/UnitPlannerModal';
import { findSequenceStart } from './engine/richText';
import {
  fillSequence,
  removeUnit,
  removeWholeSequence,
  sequenceAlreadyFilled,
} from './engine/unitsAndSequences';
import { SyncStatusChip } from './components/SyncStatusChip';
import type { SearchHit } from './engine/search';
import { useLocalFileSync } from './hooks/useLocalFileSync';
import { useDesktopApp } from './hooks/useDesktopApp';
import type { PhoneLayout } from './components/SidePanel';
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
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
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
  const [calendarImportOpen, setCalendarImportOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [unitPlanner, setUnitPlanner] = useState<{ courseId: string; startKey: string } | null>(null);
  const [seqMake, setSeqMake] = useState(false);
  const [seqDismissed, setSeqDismissed] = useState<Set<string>>(() => new Set());
  const fileSync = useLocalFileSync();
  const fileSyncSaveNow = fileSync.saveNow;

  const [activeEdit, setActiveEdit] = useState<ActiveEditTarget | null>(null);
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  const [flipKey, setFlipKey] = useState(0);

  // Phones only: landscape shows the binder, portrait the phone view (unless locked in ☰).
  // Computers, browsers and the Mac app never switch to the phone view by themselves.
  const readPhone = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches &&
    Math.min(window.screen.width, window.screen.height) < 600;
  const readPortrait = () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches;
  const [isPhone, setIsPhone] = useState(readPhone);
  const [isPortrait, setIsPortrait] = useState(readPortrait);
  const [phoneLayout, setPhoneLayoutState] = useState<PhoneLayout>(() => {
    try {
      return (localStorage.getItem('mvplanner-phone-layout') as PhoneLayout) || 'rotate';
    } catch {
      return 'rotate';
    }
  });
  const setPhoneLayout = useCallback((l: PhoneLayout) => {
    setPhoneLayoutState(l);
    try {
      localStorage.setItem('mvplanner-phone-layout', l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const on = () => {
      setIsPortrait(mq.matches);
      setIsPhone(readPhone());
    };
    mq.addEventListener('change', on);
    window.addEventListener('resize', on);
    return () => {
      mq.removeEventListener('change', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    const current = usePlannerStore.getState().viewMode;
    if (!isPhone) {
      if (current === 'phone') setViewMode('binder');
      return;
    }
    const want = phoneLayout === 'rotate' ? (isPortrait ? 'phone' : 'binder') : phoneLayout;
    if (current !== want && !(want === 'binder' && current === 'flat')) setViewMode(want);
  }, [isPhone, isPortrait, phoneLayout, setViewMode]);

  const activeBinder =
    workspace.binders[workspace.activeBinderId] ?? Object.values(workspace.binders)[0];

  const schedule = useMemo(() => resolveSchedule(activeBinder), [activeBinder]);
  const desktopApp = useDesktopApp(activeBinder, schedule);
  const safeWeekIdx = Math.min(Math.max(0, weekIndex), Math.max(0, schedule.weeks.length - 1));
  const currentWeek = schedule.weeks[safeWeekIdx];

  const [showSaveBadge, setShowSaveBadge] = useState(false);

  const finishEditingCell = useCallback(() => {
    setActiveEdit(null);
    void flushPersist();
    void fileSyncSaveNow();
  }, [flushPersist, fileSyncSaveNow]);

  // Tab / Shift+Tab while editing: save and open the next / previous lesson (down the day, then the next day)
  const [pendingEditKey, setPendingEditKey] = useState<string | null>(null);
  const tabEdit = useCallback(
    (dir: 1 | -1) => {
      if (!activeEdit) return;
      const lessons: { key: string; weekIdx: number }[] = [];
      const lo = Math.max(0, safeWeekIdx - 2);
      const hi = Math.min(schedule.weeks.length - 1, safeWeekIdx + 2);
      for (let w = lo; w <= hi; w++) {
        for (const day of schedule.weeks[w].days) {
          if (!day.inBinderRange) continue;
          for (const period of activeBinder.periods) {
            if (period.kind !== 'period') continue;
            const slot = resolveSlot(activeBinder, day, period);
            if (!slot.course || slot.exceptionKind === 'full') continue;
            lessons.push({ key: `${day.iso}__${period.id}`, weekIdx: w });
          }
        }
      }
      const curKey = `${activeEdit.date}__${activeEdit.periodId}`;
      let i = lessons.findIndex((l) => l.key === curKey);
      if (i === -1) {
        // Editing a non-lesson cell: start from the nearest lesson after it
        i = lessons.findIndex((l) => l.key > curKey) - (dir === 1 ? 1 : 0);
      }
      const next = lessons[i + dir];
      if (!next) return;
      finishEditingCell();
      if (next.weekIdx !== safeWeekIdx) setWeekIndex(next.weekIdx);
      setPendingEditKey(next.key);
    },
    [activeEdit, activeBinder, schedule, safeWeekIdx, finishEditingCell, setWeekIndex],
  );
  useEffect(() => {
    if (!pendingEditKey) return;
    let tries = 0;
    const open = () => {
      const el = document.querySelector<HTMLElement>(`[data-cell="${pendingEditKey}"]`);
      if (!el) {
        if (tries++ < 20) requestAnimationFrame(open);
        else setPendingEditKey(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const [date, periodId] = pendingEditKey.split('__');
      setSelectedCell({ date, periodId });
      setActiveEdit({ date, periodId, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } });
      setPendingEditKey(null);
    };
    requestAnimationFrame(open);
  }, [pendingEditKey, setSelectedCell]);

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

  const openSearchHit = useCallback(
    (hit: SearchHit) => {
      goToWeek(hit.weekIndex);
      if (hit.dayIso && hit.periodId) setSelectedCell({ date: hit.dayIso, periodId: hit.periodId });
      if (hit.dayIso) {
        const di = schedule.weeks[hit.weekIndex]?.days.findIndex((d) => d.iso === hit.dayIso) ?? -1;
        if (di >= 0) setPhoneDayIndex(di);
      }
    },
    [goToWeek, schedule, setSelectedCell, setPhoneDayIndex],
  );

  // Close inline editor & auto-save immediately when clicking outside
  useEffect(() => {
    if (!activeEdit) return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('.tt-slot.editing') || el.closest('.floating-toolbar') || el.closest('.seq-prompt')) return;
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

  // ----- Sequences & units for the lesson being edited -----
  const editKey = activeEdit ? `${activeEdit.date}__${activeEdit.periodId}` : null;
  const editPlan = editKey ? activeBinder.cellPlans[editKey] : undefined;
  const editCourseId = (() => {
    if (!activeEdit) return null;
    const day = schedule.daysByIso[activeEdit.date];
    const period = activeBinder.periods.find((p) => p.id === activeEdit.periodId);
    return day && period ? resolveSlot(activeBinder, day, period).courseId ?? null : null;
  })();
  const seqStart = editPlan && !editPlan.seqFrom ? findSequenceStart(editPlan.text) : null;
  const showSeqPrompt =
    !!editKey &&
    !!editCourseId &&
    (seqMake ||
      (!!seqStart && !sequenceAlreadyFilled(activeBinder, editKey) && !seqDismissed.has(`${editKey}|${seqStart.line}`)));
  const addSequence = (total: number) => {
    if (!editKey || !editCourseId) return;
    updateActiveBinder((b) => {
      const plan = b.cellPlans[editKey] ?? { text: '', ink: 'pencil' as const };
      let text = plan.text;
      let rest = seqStart?.rest ?? '';
      if (seqMake || !seqStart) {
        const [first, ...others] = text.split('\n');
        rest = first.trim();
        text = [`1/${total} ${rest}`, ...others].join('\n');
      }
      const withSource = { ...b, cellPlans: { ...b.cellPlans, [editKey]: { ...plan, text } } };
      return { ...withSource, cellPlans: fillSequence(withSource, editCourseId, editKey, total, rest) };
    });
    setSeqMake(false);
  };
  const extraUnitItems: { label: string; onClick: () => void }[] = [];
  if (editKey && sequenceAlreadyFilled(activeBinder, editKey)) {
    extraUnitItems.push({
      label: 'Remove the lines this 1/N added',
      onClick: () => updateActiveBinder((b) => ({ ...b, cellPlans: removeWholeSequence(b, editKey) })),
    });
  }
  if (editPlan?.seqFrom) {
    const src = editPlan.seqFrom;
    extraUnitItems.push({
      label: 'Remove this whole sequence',
      onClick: () => updateActiveBinder((b) => ({ ...b, cellPlans: removeWholeSequence(b, src) })),
    });
  }

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
        isPhone={isPhone}
        phoneLayout={phoneLayout}
        onPhoneLayout={setPhoneLayout}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        fileSyncStatus={fileSync.status}
        fileSyncName={fileSync.fileName}
        onOpenFileSync={() => setFileSyncOpen(true)}
        onOpenCalendarImport={() => setCalendarImportOpen(true)}
        desktopApp={desktopApp}
        onOpenReminders={() => setRemindersOpen(true)}
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
            onJumpToday={goToToday}
            todayIso={todayISO()}
            onTabEdit={tabEdit}
            onStartWizard={() => setWizardOpen(true)}
            onOpenSync={() => setFileSyncOpen(true)}
            searchSlot={<SearchBox binder={activeBinder} schedule={schedule} onPick={openSearchHit} />}
            statusSlot={
              <span className="flex items-center gap-1.5">
              <button
                type="button"
                className="undo-btn"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                title={`Undo (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}Z)`}
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                className="undo-btn"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title={`Redo (${navigator.platform.includes('Mac') ? '⌘⇧Z' : 'Ctrl+Y'})`}
              >
                <Redo2 className="w-3 h-3" />
              </button>
              <SyncStatusChip
                status={fileSync.status}
                fileName={fileSync.fileName}
                filePath={fileSync.filePath}
                lastSavedAt={fileSync.lastSavedAt}
                localSaving={localSaveStatus === 'saving'}
                onClick={() => {
                  if (fileSync.status === 'needs-permission') void fileSync.reconnect();
                  else setFileSyncOpen(true);
                }}
              />
              </span>
            }
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
            onTabEdit={tabEdit}
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
          onPlanUnit={() => {
            if (editCourseId && editKey) {
              setUnitPlanner({ courseId: editCourseId, startKey: editKey });
              finishEditingCell();
            }
          }}
          onMakeSequence={() => setSeqMake(true)}
          onRemoveUnit={() => {
            const id = editPlan?.unit?.id;
            if (id) updateActiveBinder((b) => removeUnit(b, id));
          }}
          extraUnitItems={extraUnitItems}
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


      {activeEdit && showSeqPrompt && editKey && editCourseId && (
        <SequencePrompt
          key={`${editKey}-${seqMake ? 'make' : seqStart?.total}`}
          binder={activeBinder}
          schedule={schedule}
          courseId={editCourseId}
          fromKey={editKey}
          total={seqMake ? null : (seqStart?.total ?? null)}
          anchor={{
            top: Math.min(activeEdit.rect.bottom + 6, window.innerHeight - 230),
            left: Math.min(activeEdit.rect.left, window.innerWidth - 350),
          }}
          onAdd={addSequence}
          onDismiss={() => {
            if (seqMake) setSeqMake(false);
            else if (seqStart) setSeqDismissed((d) => new Set(d).add(`${editKey}|${seqStart.line}`));
          }}
        />
      )}

      <UnitPlannerModal
        open={!!unitPlanner}
        onClose={() => setUnitPlanner(null)}
        binder={activeBinder}
        schedule={schedule}
        courseId={unitPlanner?.courseId ?? null}
        startKey={unitPlanner?.startKey ?? null}
      />

      <RemindersDrawer
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        binder={activeBinder}
        schedule={schedule}
        desktopApp={desktopApp}
      />

      <CalendarImportModal
        open={calendarImportOpen}
        onClose={() => setCalendarImportOpen(false)}
        binder={activeBinder}
      />

      <FileSyncDrawer open={fileSyncOpen} onClose={() => setFileSyncOpen(false)} sync={fileSync} />

      {/* Subtle Auto-Save Status Pill (fades away cleanly when idle) */}
      {showSaveBadge && viewMode !== 'binder' && (
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
