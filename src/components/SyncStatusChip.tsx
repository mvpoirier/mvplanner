// "● Synced" at the bottom right of the planner. Hover says where it's saved and when.

import React from 'react';
import type { FileSyncStatus } from '../hooks/useLocalFileSync';

interface SyncStatusChipProps {
  status: FileSyncStatus;
  fileName: string | null;
  filePath: string | null;
  lastSavedAt: string | null;
  localSaving: boolean;
  onClick: () => void;
}

/** "~/Library/Mobile Documents/com~apple~CloudDocs/MVPlanner/x.json" → "iCloud Drive" */
function placeName(path: string | null): string | null {
  if (!path) return null;
  if (path.includes('com~apple~CloudDocs')) return 'iCloud Drive';
  const cs = path.match(/CloudStorage\/([^/]+)/)?.[1];
  if (cs) return cs.replace(/^OneDrive-?/, 'OneDrive ').replace(/^GoogleDrive-.*/, 'Google Drive').replace(/-/g, ' ').trim();
  if (/\/Dropbox\//.test(path)) return 'Dropbox';
  if (/\/OneDrive\//.test(path)) return 'OneDrive';
  return null;
}
const shortPath = (path: string) => {
  const parts = path.split('/');
  return parts.slice(-2).join('/');
};
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({
  status,
  fileName,
  filePath,
  lastSavedAt,
  localSaving,
  onClick,
}) => {
  const place = placeName(filePath);
  const saved = time(lastSavedAt);

  const { text, tone, tipTitle, tipLines } = (() => {
    switch (status) {
      case 'idle':
        return {
          text: 'Synced',
          tone: 'ok',
          tipTitle: place ? `Saved to ${place}` : 'Saved to your sync file',
          tipLines: [filePath ? shortPath(filePath) : (fileName ?? ''), `${saved ? `Last saved ${saved} · ` : ''}click for sync settings`],
        };
      case 'saving':
        return { text: 'Saving…', tone: 'busy', tipTitle: 'Saving to your sync file', tipLines: [filePath ?? fileName ?? ''] };
      case 'needs-permission':
        return {
          text: 'Reconnect',
          tone: 'busy',
          tipTitle: 'Sync paused',
          tipLines: ['Click to allow access to your sync file again.'],
        };
      case 'conflict':
        return {
          text: 'Conflict',
          tone: 'warn',
          tipTitle: 'Changed on another computer',
          tipLines: ['Click to choose which copy to keep.'],
        };
      case 'error':
        return { text: 'Sync problem', tone: 'error', tipTitle: 'Sync problem', tipLines: ['Click for details.'] };
      default:
        return localSaving
          ? { text: 'Saving…', tone: 'busy', tipTitle: 'Saving in this browser', tipLines: [] }
          : {
              text: 'Not synced',
              tone: 'idle',
              tipTitle: 'Saved in this browser only',
              tipLines: ['Click to set up a sync file in iCloud, OneDrive or Dropbox.'],
            };
    }
  })();

  return (
    <button type="button" onClick={onClick} className={`sync-chip sync-chip-${tone}`} aria-label={`${text}. ${tipTitle}`}>
      <span className="sync-chip-dot" aria-hidden="true" />
      <span>{text}</span>
      <span className="binder-tip binder-tip-up" role="tooltip">
        <strong>{tipTitle}</strong>
        {tipLines.filter(Boolean).map((l, i) => (
          <span key={i} className={i === 0 && filePath && status === 'idle' ? 'binder-tip-mono' : undefined}>
            {l}
          </span>
        ))}
      </span>
    </button>
  );
};
