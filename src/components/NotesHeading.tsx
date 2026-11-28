// The "Notes" heading on the right page. Click it to choose how weekly notes look:
// all one colour (light yellow by default), your own palette, or a plain bulleted list.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { DEFAULT_NOTES_DISPLAY, type NotesDisplayMode } from '../types/planner';

const SWATCHES = ['#fff59d', '#f8c9dc', '#cdeccd', '#d3e5fb', '#fed7aa', '#e9d5ff'];

export const NotesHeading: React.FC = () => {
  const display = usePlannerStore((s) => s.workspace.uiPreferences.notesDisplay ?? DEFAULT_NOTES_DISPLAY);
  const setNotesDisplay = usePlannerStore((s) => s.setNotesDisplay);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const mode = (m: NotesDisplayMode, label: string, hint: string) => (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="radio"
        name="notes-mode"
        checked={display.mode === m}
        onChange={() => setNotesDisplay({ mode: m })}
        className="mt-0.5 accent-[#1d3f7a]"
      />
      <span>
        <span className="block font-semibold text-slate-900">{label}</span>
        <span className="block text-[10.5px] text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="notes-panel-hdr notes-hdr-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        title="How notes look"
      >
        Notes <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="notes-display-menu" role="dialog" aria-label="How notes look">
          {mode('single', 'All one colour', 'Every note the same colour')}
          {display.mode === 'single' && (
            <div className="flex items-center gap-1.5 pl-6">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setNotesDisplay({ color: c })}
                  className={`w-5 h-5 rounded border cursor-pointer ${display.color === c ? 'ring-2 ring-offset-1 ring-blue-600 border-transparent' : 'border-slate-300'}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={display.color}
                onChange={(e) => setNotesDisplay({ color: e.target.value })}
                aria-label="Any colour"
                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              />
            </div>
          )}
          {mode('palette', 'My palette', 'Notes cycle through your colours')}
          {display.mode === 'palette' && (
            <div className="flex items-center gap-1.5 pl-6">
              {display.palette.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const palette = [...display.palette];
                    palette[i] = e.target.value;
                    setNotesDisplay({ palette });
                  }}
                  aria-label={`Palette colour ${i + 1}`}
                  className="w-7 h-7 p-0 border-0 bg-transparent cursor-pointer"
                />
              ))}
            </div>
          )}
          {mode('list', 'Bulleted list', 'Plain list, no sticky notes')}
        </div>
      )}
    </div>
  );
};
