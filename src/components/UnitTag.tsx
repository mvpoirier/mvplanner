// "U2 L3" in a lesson's corner; hover shows the unit's name and progress.

import React from 'react';
import type { AcademicYearBinder } from '../types/planner';

export const UnitTag: React.FC<{ binder: AcademicYearBinder; unit: { id: string; lesson: number } }> = ({
  binder,
  unit,
}) => {
  const u = binder.units?.[unit.id];
  if (!u) return null;
  // Last dated lesson of the unit, for "ends Wed 16 Dec"
  const keys = Object.keys(binder.cellPlans).filter((k) => binder.cellPlans[k].unit?.id === unit.id).sort();
  const last = keys[keys.length - 1]?.slice(0, 10);
  const ends = last
    ? new Date(`${last}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : null;
  const pct = Math.round((unit.lesson / Math.max(1, u.total)) * 100);
  return (
    <span className="unit-tag" tabIndex={0}>
      U{u.number} L{unit.lesson}
      <span className="binder-tip binder-tip-unit" role="tooltip">
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
      </span>
    </span>
  );
};
