// ⌘K / Ctrl+K search across the whole binder: lesson notes, weekly notes, courses, events, holidays.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { searchBinder, type SearchHit } from '../engine/search';

interface SearchBoxProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  onPick: (hit: SearchHit) => void;
  className?: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const SearchBox: React.FC<SearchBoxProps> = ({ binder, schedule, onPick, className = '' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced so typing stays smooth on a full year of data
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(t);
  }, [query]);
  const hits = useMemo(() => searchBinder(binder, schedule, debounced), [binder, schedule, debounced]);
  useEffect(() => setActive(0), [debounced]);

  // ⌘K / Ctrl+K focuses the box from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setOpen(false);
    inputRef.current?.blur();
  };

  const showList = open && debounced.trim().length > 0;

  return (
    <div ref={wrapRef} className={`binder-search ${className}`} onDoubleClick={(e) => e.stopPropagation()}>
      <label className="binder-search-pill">
        <Search className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              pick(hits[active]);
            }
            e.stopPropagation(); // keep ←/→/T week shortcuts out of the search box
          }}
          placeholder="Search lessons, notes, dates…"
          aria-label="Search the binder"
          className="binder-search-input"
        />
        <kbd className="binder-search-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </label>

      {showList && (
        <div className="binder-search-results" role="listbox">
          <div className="text-[10px] font-bold tracking-wider text-slate-500 px-2 pt-1 pb-1.5">
            {hits.length === 0
              ? `NO RESULTS FOR “${debounced.toUpperCase()}”`
              : `${hits.length}${hits.length === 30 ? '+' : ''} RESULTS`}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {hits.map((h, i) => (
              <button
                key={`${h.kind}-${h.dayIso}-${h.periodId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={`w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left cursor-pointer ${
                  i === active ? 'bg-slate-100' : ''
                }`}
              >
                <span
                  className="shrink-0 min-w-[52px] px-1.5 h-[20px] rounded text-[9.5px] font-bold flex items-center justify-center truncate"
                  style={{ backgroundColor: h.chipColor, color: h.chipTextColor }}
                >
                  {h.chipLabel}
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[11.5px] font-semibold text-slate-900 truncate">{h.title}</span>
                  <span className="text-[10.5px] text-slate-500">{h.where}</span>
                </span>
              </button>
            ))}
          </div>
          {hits.length > 0 && (
            <div className="border-t border-slate-100 mt-1 px-2 pt-1.5 text-[10px] text-slate-500">
              ↑↓ to move · Enter to open that week
            </div>
          )}
        </div>
      )}
    </div>
  );
};
