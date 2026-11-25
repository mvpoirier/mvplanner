// Milestone 2: Private Google Drive JSON sync for mvplanner-workspace.json with modifiedTime conflict guard.

import type { PlannerWorkspace } from '../types/planner';

const WORKSPACE_FILENAME = 'mvplanner-workspace.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface DriveSyncWriteResult {
  status: 'saved' | 'conflict';
  fileId: string;
  modifiedTime: string;
  remoteWorkspace?: PlannerWorkspace;
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Drive API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res;
}

export async function findWorkspaceDriveFile(token: string): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(`name='${WORKSPACE_FILENAME}' and trashed=false`);
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const res = await driveFetch(`${DRIVE_API}?q=${q}&fields=${fields}&spaces=drive`, token);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files?.[0] ?? null;
}

export async function getDriveFileMeta(token: string, fileId: string): Promise<DriveFileMeta> {
  const res = await driveFetch(`${DRIVE_API}/${fileId}?fields=id,name,modifiedTime`, token);
  return (await res.json()) as DriveFileMeta;
}

export async function downloadWorkspaceFromDrive(
  token: string,
  fileId: string,
): Promise<{ workspace: PlannerWorkspace; modifiedTime: string }> {
  const meta = await getDriveFileMeta(token, fileId);
  const res = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, token);
  const workspace = (await res.json()) as PlannerWorkspace;
  return { workspace, modifiedTime: meta.modifiedTime };
}

export async function saveWorkspaceToDrive(
  token: string,
  workspace: PlannerWorkspace,
  options: {
    fileId?: string;
    expectedRemoteModifiedTime?: string;
    forceOverwrite?: boolean;
  } = {},
): Promise<DriveSyncWriteResult> {
  let fileId = options.fileId;
  if (!fileId) {
    const existing = await findWorkspaceDriveFile(token);
    fileId = existing?.id;
  }

  // Conflict check against Drive modifiedTime before overwriting
  if (fileId && options.expectedRemoteModifiedTime && !options.forceOverwrite) {
    const latestMeta = await getDriveFileMeta(token, fileId);
    if (latestMeta.modifiedTime && latestMeta.modifiedTime !== options.expectedRemoteModifiedTime) {
      const { workspace: remoteWorkspace } = await downloadWorkspaceFromDrive(token, fileId);
      return {
        status: 'conflict',
        fileId,
        modifiedTime: latestMeta.modifiedTime,
        remoteWorkspace,
      };
    }
  }

  const boundary = 'mvplanner_multipart_boundary';
  const metadata = {
    name: WORKSPACE_FILENAME,
    mimeType: 'application/json',
  };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(workspace)}\r\n` +
    `--${boundary}--`;

  const url = fileId
    ? `${DRIVE_UPLOAD_API}/${fileId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await driveFetch(url, token, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const saved = (await res.json()) as DriveFileMeta;

  return {
    status: 'saved',
    fileId: saved.id,
    modifiedTime: saved.modifiedTime,
  };
}
