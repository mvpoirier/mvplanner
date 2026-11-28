// Small status chip in the binder header: is the work saved, and where?

import React from 'react';
import type { FileSyncStatus } from '../hooks/useLocalFileSync';

interface SyncStatusChipProps {
  status: FileSyncStatus;
  fileName: string | null;
  localSaving: boolean;
  onClick: () => void;
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({ status, fileName, localSaving, onClick }) => {
  const { text, tone } = (() => {
    switch (status) {
      case 'idle':
        return { text: `Synced · ${fileName ?? 'sync file'}`, tone: 'ok' };
      case 'saving':
        return { text: 'Saving to sync file…', tone: 'busy' };
      case 'needs-permission':
        return { text: 'Sync paused · click to reconnect', tone: 'busy' };
      case 'conflict':
        return { text: 'Sync conflict · choose a copy', tone: 'warn' };
      case 'error':
        return { text: 'Sync problem · click to fix', tone: 'error' };
      default:
        return localSaving
          ? { text: 'Saving…', tone: 'busy' }
          : { text: 'Saved in this browser only · set up sync', tone: 'idle' };
    }
  })();

  return (
    <button type="button" onClick={onClick} className={`sync-chip sync-chip-${tone}`} title="Sync file settings">
      <span className="sync-chip-dot" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </button>
  );
};
