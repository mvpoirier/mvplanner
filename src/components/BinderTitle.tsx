// The timetable's name on the left page, as a strip of label-maker tape in the cover colour.
// Click to rename.

import React, { useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';

export const BinderTitle: React.FC<{ title: string; readOnly?: boolean; isDemo?: boolean }> = ({
  title,
  readOnly,
  isDemo,
}) => {
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== title) updateActiveBinder((b) => ({ ...b, title: t }));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation(); // keep ← → T shortcuts out of the box
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="Timetable name"
        className="title-tape title-tape-input"
        style={{ width: `${Math.max(12, draft.length + 2)}ch` }}
      />
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        className="title-tape"
        onClick={() => {
          if (readOnly) return;
          setDraft(title);
          setEditing(true);
        }}
        title={readOnly ? title : 'Click to rename'}
      >
        {title}
      </button>
      {isDemo && <span className="title-demo-tag">DEMO</span>}
    </span>
  );
};
