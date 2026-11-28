// "U2 L3" in a lesson's corner; hover shows the unit's name and progress (drawn above the page,
// so the cell's edges never clip it).

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { AcademicYearBinder } from '../types/planner';

export const UnitTag: React.FC<{ binder: AcademicYearBinder; unit: { id: string; lesson: number } }> = ({
  binder,
  unit,
}) => {
  const [tip, setTip] = useState<{ top: number; right: number } | null>(null);
  const u = binder.units?.[unit.id];
  if (!u) return null;
  const keys = Object.keys(binder.cellPlans)
    .filter((k) => binder.cellPlans[k].unit?.id === unit.id)
    .sort();
  const last = keys[keys.length - 1]?.slice(0, 10);
  const ends = last
    ? new Date(`${last}T00:00:00Z`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : null;
  const pct = Math.round((unit.lesson / Math.max(1, u.total)) * 100);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  return (
    <span
      className="unit-tag"
      tabIndex={0}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setTip(null)}
      aria-label={`Unit ${u.number}${u.name ? `, ${u.name}` : ''}: lesson ${unit.lesson} of ${u.total}`}
    >
      U{u.number} L{unit.lesson}
      {tip &&
        createPortal(
          <span className="unit-tip" role="tooltip" style={{ top: tip.top, right: tip.right }}>
            <strong>
              Unit {u.number}
              {u.name ? ` · ${u.name}` : ''}
            </strong>
            <span>
              Lesson {unit.lesson} of {u.total}
              {ends ? ` · ends ${ends}` : ''}
            </span>
            <span className="unit-tip-bar">
              <span style={{ width: `${pct}%` }} />
            </span>
          </span>,
          document.body,
        )}
    </span>
  );
};
