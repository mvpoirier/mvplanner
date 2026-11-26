import { describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../../presets/demoBinder';
import {
  parseSyncFileText,
  pickNewerCopy,
  SyncFileLockedError,
} from '../../services/localFileSync';
import { encryptJSON } from '../../store/cryptoLock';
import type { PlannerWorkspace } from '../../types/planner';

const at = (iso: string | undefined): PlannerWorkspace => ({ ...createInitialWorkspace(), updatedAt: iso });

describe('linked sync file', () => {
  it('picks whichever copy was edited most recently', () => {
    expect(pickNewerCopy(at('2026-11-01T10:00:00Z'), at('2026-11-02T10:00:00Z'))).toBe('file');
    expect(pickNewerCopy(at('2026-11-03T10:00:00Z'), at('2026-11-02T10:00:00Z'))).toBe('local');
    expect(pickNewerCopy(at('2026-11-02T10:00:00Z'), at('2026-11-02T10:00:00Z'))).toBe('same');
  });

  it('keeps the local copy when the file is empty', () => {
    expect(pickNewerCopy(at('2026-11-01T10:00:00Z'), null)).toBe('local');
  });

  it('treats a missing timestamp as oldest', () => {
    expect(pickNewerCopy(at(undefined), at('2026-11-02T10:00:00Z'))).toBe('file');
  });

  it('parses a plain workspace file and an empty file', async () => {
    const ws = at('2026-11-02T10:00:00Z');
    expect((await parseSyncFileText(JSON.stringify(ws), null))?.activeBinderId).toBe(ws.activeBinderId);
    expect(await parseSyncFileText('   ', null)).toBeNull();
  });

  it('decrypts a passphrase-locked file, and refuses without the passphrase', async () => {
    const ws = at('2026-11-02T10:00:00Z');
    const text = JSON.stringify(await encryptJSON(ws, 'hunter2'));
    expect((await parseSyncFileText(text, 'hunter2'))?.updatedAt).toBe(ws.updatedAt);
    await expect(parseSyncFileText(text, null)).rejects.toBeInstanceOf(SyncFileLockedError);
  });

  it('rejects JSON that is not an MVPlanner workspace', async () => {
    await expect(parseSyncFileText('{"hello":"world"}', null)).rejects.toThrow(/MVPlanner workspace/);
  });
});
