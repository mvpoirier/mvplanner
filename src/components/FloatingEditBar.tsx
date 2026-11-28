// Lesson editor toolbar, anchored above the lesson being edited:
//   Ink ▾ · Style ▾ · List ▾ · Link · Unit ▾ | Bump ▾ · Done
// Formatting is stored as light markup in the note text (see engine/richText.ts).

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Link2, List, SkipForward } from 'lucide-react';
import { cellKey, type AcademicYearBinder, type InkTone } from '../types/planner';
import { resolveSlot, type ResolvedSchedule, type ResolvedWeek } from '../engine/cycleEngine';
import { usePlannerStore } from '../store/usePlannerStore';
import type { BumpScope } from '../engine/smartBumpEngine';
import { insertLink, setList, toggleWrap, type EditResult, type WrapStyle } from '../engine/richText';

export interface ActiveEditTarget {
  date: string;
  periodId: string;
  rect: { top: number; bottom: number; left: number; width: number };
}

interface FloatingEditBarProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  week: ResolvedWeek;
  target: ActiveEditTarget;
  onDone: () => void;
  onPlanUnit?: () => void;
  onMakeSequence?: () => void;
  onRemoveUnit?: () => void;
}

const INKS: [InkTone, string, string][] = [
  ['pencil', 'Black', '#111827'],
  ['blue', 'Blue', '#1648a8'],
  ['red', 'Red', '#c02323'],
];

type MenuId = 'ink' | 'style' | 'list' | 'link' | 'unit' | 'bump' | null;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

/** Apply an edit to the open lesson's textarea, keeping the selection. */
export function editActiveTextarea(
  fn: (value: string, s: number, e: number) => EditResult,
  save: (text: string) => void,
): void {
  const ta = document.querySelector<HTMLTextAreaElement>('textarea.inline-cell-editor');
  if (!ta) return;
  const res = fn(ta.value, ta.selectionStart, ta.selectionEnd);
  // Update the textarea right away so fast typing lands in the right place,
  // then save (React re-renders with the same value and leaves the caret alone).
  ta.value = res.value;
  ta.setSelectionRange(res.selStart, res.selEnd);
  save(res.value);
  if (document.activeElement !== ta) {
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(res.selStart, res.selEnd);
    });
  }
}

export const FloatingEditBar: React.FC<FloatingEditBarProps> = ({
  binder,
  schedule,
  target,
  onDone,
  onPlanUnit,
  onMakeSequence,
  onRemoveUnit,
}) => {
  const updateCellPlan = usePlannerStore((s) => s.updateCellPlan);
  const bumpCourseForward = usePlannerStore((s) => s.bumpCourseForward);
  const [open, setOpen] = useState<MenuId>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const barRef = useRef<HTMLDivElement>(null);

  // Close a menu when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    // Esc closes the open menu (not the whole editor)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const day = schedule.daysByIso[target.date];
  const period = binder.periods.find((p) => p.id === target.periodId);
  if (!day || !period) return null;

  const slot = resolveSlot(binder, day, period);
  const plan = binder.cellPlans[cellKey(target.date, target.periodId)];
  const ink = INKS.find(([t]) => t === (plan?.ink ?? 'pencil')) ?? INKS[0];
  const canBump =
    !binder.archived && Boolean(slot.courseId) && slot.course?.category !== 'duty' && period.kind === 'period';
  const hasText = Boolean(plan?.text.trim());

  const save = (text: string) => updateCellPlan(target.date, target.periodId, { text });
  const wrap = (style: WrapStyle) => {
    editActiveTextarea((v, s, e) => toggleWrap(v, s, e, style), save);
    setOpen(null);
  };
  const list = (kind: 'bullet' | 'number' | 'none') => {
    editActiveTextarea((v, s, e) => setList(v, s, e, kind), save);
    setOpen(null);
  };
  const bump = (scope: BumpScope) => {
    if (slot.courseId) {
      bumpCourseForward(slot.courseId, target.date, target.periodId, scope);
      setOpen(null);
      onDone();
    }
  };

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const top = target.rect.top > 56 ? target.rect.top - 46 : target.rect.bottom + 6;
  const left = Math.min(Math.max(12, target.rect.left - 20), Math.max(12, vw - 600));

  const btn = 'inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 cursor-pointer';
  const item = 'w-full flex items-center gap-2 h-7 px-2 rounded-md text-left hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-default';
  const kbd = 'ml-auto pl-3 text-[10px] text-slate-400';
  const menu = 'absolute top-full mt-1 left-0 z-10 min-w-[190px] p-1 rounded-lg bg-white border border-slate-200 shadow-lg';
  const chev = <ChevronDown className="w-3 h-3 text-slate-400" />;
  const toggle = (m: MenuId) => setOpen((o) => (o === m ? null : m));

  return (
    <div
      ref={barRef}
      className="floating-toolbar"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => {
        // Keep the caret in the lesson unless typing in the link box
        if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault();
      }}
    >
      {/* Ink */}
      <span className="relative">
        <button type="button" className={btn} onClick={() => toggle('ink')} aria-haspopup="menu">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ink[2] }} />
          {ink[1]}
          {chev}
        </button>
        {open === 'ink' && (
          <div className={menu} role="menu">
            {INKS.map(([tone, label, color]) => (
              <button
                key={tone}
                type="button"
                role="menuitemradio"
                aria-checked={ink[0] === tone}
                className={item}
                onClick={() => {
                  updateCellPlan(target.date, target.periodId, { ink: tone });
                  setOpen(null);
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span style={{ color }}>{label}</span>
                {ink[0] === tone && <span className="ml-auto text-blue-700">✓</span>}
              </button>
            ))}
          </div>
        )}
      </span>

      {/* Style */}
      <span className="relative">
        <button type="button" className={btn} onClick={() => toggle('style')} aria-haspopup="menu">
          <b>B</b>
          <i className="-ml-0.5 font-serif">I</i>
          Style
          {chev}
        </button>
        {open === 'style' && (
          <div className={menu} role="menu">
            <button type="button" className={item} onClick={() => wrap('bold')}>
              <b className="w-4 text-center">B</b>Bold<span className={kbd}>{mod}B</span>
            </button>
            <button type="button" className={item} onClick={() => wrap('italic')}>
              <i className="w-4 text-center font-serif">I</i>Italic<span className={kbd}>{mod}I</span>
            </button>
            <button type="button" className={item} onClick={() => wrap('strike')}>
              <s className="w-4 text-center">S</s>Strikethrough<span className={kbd}>{mod}⇧X</span>
            </button>
            <button type="button" className={item} onClick={() => wrap('mark')}>
              <span className="w-4 h-3.5 rounded-sm bg-yellow-300 text-[9px] font-bold flex items-center justify-center">ab</span>
              Highlight<span className={kbd}>{mod}⇧H</span>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              className={item}
              onClick={() => updateCellPlan(target.date, target.periodId, { circled: !plan?.circled })}
            >
              <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-slate-800 mx-px" />
              Circle first line
              {plan?.circled && <span className="ml-auto text-blue-700">✓</span>}
            </button>
            <button
              type="button"
              className={item}
              onClick={() => updateCellPlan(target.date, target.periodId, { star: !plan?.star })}
            >
              <span className="w-4 text-center">★</span>Star this lesson
              {plan?.star && <span className="ml-auto text-blue-700">✓</span>}
            </button>
          </div>
        )}
      </span>

      {/* Lists */}
      <span className="relative">
        <button type="button" className={btn} onClick={() => toggle('list')} aria-haspopup="menu">
          <List className="w-3.5 h-3.5" />
          List
          {chev}
        </button>
        {open === 'list' && (
          <div className={menu} role="menu">
            <button type="button" className={item} onClick={() => list('bullet')}>
              <span className="w-4 text-center">•</span>Bulleted list
            </button>
            <button type="button" className={item} onClick={() => list('number')}>
              <span className="w-4 text-center text-[11px] font-bold">1.</span>Numbered list
            </button>
            <button type="button" className={`${item} text-slate-500`} onClick={() => list('none')}>
              <span className="w-4" />
              No list
            </button>
          </div>
        )}
      </span>

      {/* Link */}
      <span className="relative">
        <button
          type="button"
          className={btn}
          onClick={() => {
            const ta = document.querySelector<HTMLTextAreaElement>('textarea.inline-cell-editor');
            setLinkText(ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '');
            setLinkUrl('');
            toggle('link');
          }}
          aria-label="Add link"
        >
          <Link2 className="w-3.5 h-3.5" />
          Link
        </button>
        {open === 'link' && (
          <form
            className={`${menu} w-64 p-2.5 space-y-2`}
            onSubmit={(e) => {
              e.preventDefault();
              if (!linkUrl.trim()) return;
              const text = linkText;
              editActiveTextarea((v, s, en) => insertLink(v, s, en, text, linkUrl), save);
              setOpen(null);
            }}
          >
            <label className="block text-[10.5px] font-semibold text-slate-500">
              Text
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="mt-0.5 w-full h-7 rounded-md border border-slate-300 px-2 text-[11.5px] text-slate-900"
              />
            </label>
            <label className="block text-[10.5px] font-semibold text-slate-500">
              Link
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
                className="mt-0.5 w-full h-7 rounded-md border border-slate-300 px-2 text-[11.5px] text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={!linkUrl.trim()}
              className="w-full h-7 rounded-md bg-[#1d3f7a] text-white font-bold cursor-pointer disabled:opacity-40"
            >
              Add link
            </button>
          </form>
        )}
      </span>

      {/* Unit */}
      <span className="relative">
        <button type="button" className={btn} onClick={() => toggle('unit')} aria-haspopup="menu" disabled={!slot.courseId}>
          <BookOpen className="w-3.5 h-3.5" />
          {plan?.unit && binder.units?.[plan.unit.id]
            ? `U${binder.units[plan.unit.id].number} L${plan.unit.lesson}`
            : 'Unit'}
          {chev}
        </button>
        {open === 'unit' && (
          <div className={`${menu} min-w-[230px]`} role="menu">
            <button type="button" className={item} onClick={() => { setOpen(null); onPlanUnit?.(); }}>
              Plan a unit from here…
            </button>
            <button
              type="button"
              className={item}
              disabled={!hasText}
              onClick={() => { setOpen(null); onMakeSequence?.(); }}
            >
              Make this a 1/3 sequence…
            </button>
            {plan?.unit && binder.units?.[plan.unit.id] && (
              <button type="button" className={`${item} text-slate-500`} onClick={() => { setOpen(null); onRemoveUnit?.(); }}>
                Remove U{binder.units[plan.unit.id].number} from its lessons
              </button>
            )}
          </div>
        )}
      </span>

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Bump */}
      {canBump && (
        <span className="relative">
          <button
            type="button"
            onClick={() => toggle('bump')}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
            aria-haspopup="menu"
          >
            <SkipForward className="w-3 h-3" /> Bump
            <ChevronDown className="w-3 h-3 text-blue-200" />
          </button>
          {open === 'bump' && (
            <div className={`${menu} min-w-[230px]`} role="menu">
              <button type="button" className={item} disabled={!hasText} onClick={() => bump('next')}>
                Text to next lesson<span className={kbd}>default</span>
              </button>
              <button type="button" className={item} disabled={!hasText} onClick={() => bump('blank')}>
                Text to next blank lesson
              </button>
              <button type="button" className={item} onClick={() => bump('term')}>
                Move all lessons from here
              </button>
            </div>
          )}
        </span>
      )}

      <button
        type="button"
        onClick={onDone}
        title={`Done (Esc or ${mod}↵)`}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
      >
        Done <span className="text-[10px] text-slate-400">{mod}↵</span>
      </button>
    </div>
  );
};
