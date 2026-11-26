// Milestone 2: 1-Click Google Sign-In (baked-in Client ID + collapsible custom Client ID & guided links),
// Private Google Drive JSON Sync (with conflict guard), and Google Sheets Import/Refresh + Plain-Text Mirror Push.

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  LogIn,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import type { AcademicYearBinder, PlannerWorkspace } from '../types/planner';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  getActiveSession,
  getConfiguredClientId,
  saveCustomClientId,
  signInWithGoogle,
  signOutGoogle,
  type GoogleAuthSession,
} from '../services/googleAuth';
import {
  downloadWorkspaceFromDrive,
  findWorkspaceDriveFile,
  saveWorkspaceToDrive,
} from '../services/googleDriveSync';
import {
  importOrRefreshFromGoogleSheet,
  pushPlainTextMirrorToSheet,
} from '../services/googleSheetsSync';

interface GoogleSyncDrawerProps {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
  session: GoogleAuthSession | null;
  onSessionChange: (session: GoogleAuthSession | null) => void;
  conflictRemote: { workspace: PlannerWorkspace; modifiedTime: string; fileId: string } | null;
  onClearConflict: () => void;
}

export const GoogleSyncDrawer: React.FC<GoogleSyncDrawerProps> = ({
  open,
  onClose,
  binder,
  session,
  onSessionChange,
  conflictRemote,
  onClearConflict,
}) => {
  const workspace = usePlannerStore((s) => s.workspace);
  const syncStatus = usePlannerStore((s) => s.syncStatus);
  const syncError = usePlannerStore((s) => s.syncError);
  const setSyncStatus = usePlannerStore((s) => s.setSyncStatus);
  const updateGoogleSync = usePlannerStore((s) => s.updateGoogleSync);
  const replaceWorkspace = usePlannerStore((s) => s.replaceWorkspace);
  const addBinder = usePlannerStore((s) => s.addBinder);
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
  const showToast = usePlannerStore((s) => s.showToast);

  const [clientId, setClientId] = useState(() => getConfiguredClientId());
  const [sheetUrl, setSheetUrl] = useState(
    () => workspace.googleSync?.linkedSpreadsheetId ?? '',
  );
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSignIn = async () => {
    setBusy(true);
    try {
      const effectiveId = clientId.trim() || DEFAULT_GOOGLE_CLIENT_ID;
      if (effectiveId !== DEFAULT_GOOGLE_CLIENT_ID) {
        saveCustomClientId(effectiveId);
      }
      const sess = await signInWithGoogle(effectiveId);
      onSessionChange(sess);
      showToast(`Signed in as ${sess.profile?.email ?? 'Google User'}.`);

      setSyncStatus('syncing');
      const existing = await findWorkspaceDriveFile(sess.accessToken);
      if (existing) {
        const { workspace: remoteWs, modifiedTime } = await downloadWorkspaceFromDrive(
          sess.accessToken,
          existing.id,
        );
        replaceWorkspace({
          ...remoteWs,
          googleSync: {
            ...remoteWs.googleSync,
            driveFileId: existing.id,
            remoteModifiedTime: modifiedTime,
            lastSyncedAt: new Date().toISOString(),
          },
        });
        setSyncStatus('saved');
        showToast('Loaded your private workspace from Google Drive.');
      } else {
        const res = await saveWorkspaceToDrive(sess.accessToken, workspace);
        updateGoogleSync({
          driveFileId: res.fileId,
          remoteModifiedTime: res.modifiedTime,
          lastSyncedAt: new Date().toISOString(),
        });
        setSyncStatus('saved');
        showToast('Created private mvplanner-workspace.json in Google Drive.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setSyncStatus('error', msg);
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleManualSaveDrive = async (forceOverwrite = false) => {
    const sess = session ?? getActiveSession();
    if (!sess) return;
    setBusy(true);
    setSyncStatus('syncing');
    try {
      const res = await saveWorkspaceToDrive(sess.accessToken, workspace, {
        fileId: workspace.googleSync?.driveFileId,
        expectedRemoteModifiedTime: workspace.googleSync?.remoteModifiedTime,
        forceOverwrite,
      });
      if (res.status === 'conflict') {
        setSyncStatus('conflict', 'Drive file was modified on another device.');
        showToast('Sync conflict detected — choose Keep Local or Load Remote.');
      } else {
        updateGoogleSync({
          driveFileId: res.fileId,
          remoteModifiedTime: res.modifiedTime,
          lastSyncedAt: new Date().toISOString(),
        });
        onClearConflict();
        setSyncStatus('saved');
        showToast('Saved workspace to Google Drive.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Drive save failed.';
      setSyncStatus('error', msg);
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleImportSheet = async (mode: 'new' | 'refresh') => {
    const sess = session ?? getActiveSession();
    if (!sess) {
      showToast('Sign in with Google first to access your Google Sheets.');
      return;
    }
    if (!sheetUrl.trim()) {
      showToast('Paste a Google Sheet URL or ID first.');
      return;
    }
    setBusy(true);
    try {
      const result = await importOrRefreshFromGoogleSheet(
        sess.accessToken,
        sheetUrl,
        mode === 'refresh' ? binder : undefined,
      );
      if (mode === 'refresh') {
        updateActiveBinder(() => result.binder);
        showToast(
          `Refreshed schedule from "${result.finalTabName}" (${result.importedExceptions} dates) while preserving all lesson notes!`,
        );
      } else {
        addBinder(result.binder, true);
        showToast(`Imported new binder "${result.binder.title}" from Google Sheets.`);
      }
      updateGoogleSync({
        linkedSpreadsheetId: result.spreadsheetId,
        linkedSheetTab: result.finalTabName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sheets import failed.';
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handlePushPlainText = async () => {
    const sess = session ?? getActiveSession();
    if (!sess || !sheetUrl.trim()) return;
    setBusy(true);
    try {
      const res = await pushPlainTextMirrorToSheet(sess.accessToken, sheetUrl, binder);
      showToast(`Pushed ${res.rowsWritten} plain-text rows to "${res.tabName}" tab.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Push to Sheets failed.');
    } finally {
      setBusy(false);
    }
  };

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://mvpoirier.github.io';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Google Drive &amp; Sheets Sync</h2>
              <p className="text-[11px] text-slate-500">
                Private Drive JSON · Syncs automatically across laptop &amp; phone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4">
          {/* OAuth Connection Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            {session ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-bold text-slate-900">
                        {session.profile?.name ?? 'Connected'}
                      </div>
                      <div className="text-[11px] text-slate-500">{session.profile?.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOutGoogle();
                      onSessionChange(null);
                      setSyncStatus('idle');
                      showToast('Signed out of Google.');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" /> Sign out
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                  <span className="text-slate-600">
                    Drive status: <strong className="capitalize">{syncStatus}</strong>
                    {workspace.googleSync?.lastSyncedAt && (
                      <> · {new Date(workspace.googleSync.lastSyncedAt).toLocaleTimeString()}</>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleManualSaveDrive(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-700 text-white font-semibold hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Sync Now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-slate-900">1-Click Google Account Sync</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sign in with Google to save all your binders, rich notes, ink colors &amp; markers into a private{' '}
                  <code className="bg-white px-1 rounded">mvplanner-workspace.json</code> file in your own Google Drive.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSignIn}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-4 h-4" /> Sign in with Google
                </button>

                <details className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px]">
                  <summary className="font-semibold text-slate-700 cursor-pointer">
                    Advanced: Custom OAuth Client ID &amp; Self-Hosting Links
                  </summary>
                  <div className="mt-2.5 space-y-2.5 text-slate-600">
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>
                        Enable{' '}
                        <a
                          href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-700 inline-flex items-center gap-0.5"
                        >
                          Drive API <ExternalLink className="w-2.5 h-2.5" />
                        </a>{' '}
                        &amp;{' '}
                        <a
                          href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-700 inline-flex items-center gap-0.5"
                        >
                          Sheets API <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </li>
                      <li>
                        Create an OAuth Web Client ID in{' '}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-700 inline-flex items-center gap-0.5"
                        >
                          Google Cloud Credentials <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </li>
                      <li>
                        Add Authorized JavaScript Origin:
                        <div className="mt-1 flex items-center gap-1">
                          <code className="flex-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                            {currentOrigin}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(currentOrigin);
                              showToast(`Copied ${currentOrigin}`);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      </li>
                    </ol>

                    <label className="flex flex-col gap-1 pt-1">
                      <span className="font-semibold text-slate-700">OAuth Web Client ID</span>
                      <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder={DEFAULT_GOOGLE_CLIENT_ID}
                        className="rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[10px]"
                      />
                    </label>
                  </div>
                </details>
              </>
            )}
            {syncError && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {syncError}
              </div>
            )}
          </div>

          {/* Conflict Guard Prompt */}
          {conflictRemote && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Sync Conflict Detected
              </div>
              <p className="text-[11px] text-amber-900">
                Your Drive file was updated on another device (
                {new Date(conflictRemote.modifiedTime).toLocaleString()}). Choose which version to keep:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleManualSaveDrive(true)}
                  className="flex-1 py-1.5 rounded bg-amber-700 text-white font-semibold cursor-pointer"
                >
                  Keep Local &amp; Overwrite Drive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    replaceWorkspace({
                      ...conflictRemote.workspace,
                      googleSync: {
                        ...conflictRemote.workspace.googleSync,
                        driveFileId: conflictRemote.fileId,
                        remoteModifiedTime: conflictRemote.modifiedTime,
                        lastSyncedAt: new Date().toISOString(),
                      },
                    });
                    onClearConflict();
                    setSyncStatus('saved');
                    showToast('Loaded latest version from Google Drive.');
                  }}
                  className="flex-1 py-1.5 rounded border border-amber-600 bg-white text-amber-950 font-semibold cursor-pointer"
                >
                  Load Remote Version
                </button>
              </div>
            </div>
          )}

          {/* Google Sheets Interop */}
          <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Google Sheets Integration
            </div>
            <p className="text-[11px] text-slate-600">
              Paste your <code>MVP Timetable 2026-2027</code> URL or Sheet ID to import or refresh{' '}
              <code>Grid</code> + <code>FINAL</code> structure without wiping your lesson notes.
            </p>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy || !session}
                onClick={() => handleImportSheet('refresh')}
                className="py-1.5 px-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
              >
                Refresh Active Binder
              </button>
              <button
                type="button"
                disabled={busy || !session}
                onClick={() => handleImportSheet('new')}
                className="py-1.5 px-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Import as New Binder
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={busy || !session || !sheetUrl.trim()}
                onClick={handlePushPlainText}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100 disabled:opacity-40 cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                Push Plain-Text Mirror to MVPlanner_Mirror Tab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
