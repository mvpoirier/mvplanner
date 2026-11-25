// Milestone 2: Google Sheets REST API v4 import/refresh (Grid + FINAL) and optional plain-text mirror push.

import type { AcademicYearBinder } from '../types/planner';
import { parseGridAndFinalArrays, type SheetImportResult } from './xlsxImporter';
import { buildFinalSheetRows } from './exporters/xlsxExporter';
import { resolveSchedule } from '../engine/cycleEngine';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function sheetsFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google Sheets API error (${res.status}): ${txt.slice(0, 220)}`);
  }
  return res;
}

export async function importOrRefreshFromGoogleSheet(
  token: string,
  spreadsheetIdOrUrl: string,
  existingBinder?: AcademicYearBinder,
): Promise<SheetImportResult & { spreadsheetId: string; finalTabName: string }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) throw new Error('Invalid Google Sheet URL or ID.');

  // 1. Fetch spreadsheet metadata to discover Grid and FINAL tabs
  const metaRes = await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    token,
  );
  const meta = (await metaRes.json()) as {
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  };
  const sheetNames = (meta.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter(Boolean);

  const gridTab = sheetNames.find((n) => /^grid$/i.test(n.trim())) ?? sheetNames[0];
  const finalTab =
    sheetNames.find((n) => /^final/i.test(n.trim())) ??
    sheetNames.find((n) => /final/i.test(n)) ??
    sheetNames.find((n) => n !== gridTab) ??
    sheetNames[0];

  const ranges = [gridTab, finalTab]
    .filter(Boolean)
    .map((name) => `ranges=${encodeURIComponent(`'${name.replace(/'/g, "''")}'`)}`)
    .join('&');

  const valRes = await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`,
    token,
  );
  const valData = (await valRes.json()) as {
    valueRanges?: { values?: unknown[][] }[];
  };

  const gridRows = valData.valueRanges?.[0]?.values ?? [];
  const finalRows = valData.valueRanges?.[1]?.values ?? [];

  const parsed = parseGridAndFinalArrays(
    gridRows,
    finalRows,
    meta.properties?.title ?? 'Google Sheet Timetable',
    existingBinder,
  );

  return {
    ...parsed,
    spreadsheetId,
    finalTabName: finalTab,
  };
}

/**
 * Push a clean plain-text mirror of lesson notes & weekly NOTES to a dedicated `MVPlanner_Mirror` tab
 * so the user's original formula-driven tabs are never overwritten or broken.
 */
export async function pushPlainTextMirrorToSheet(
  token: string,
  spreadsheetIdOrUrl: string,
  binder: AcademicYearBinder,
  targetTab = 'MVPlanner_Mirror',
): Promise<{ rowsWritten: number; tabName: string }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) throw new Error('Invalid Google Sheet URL or ID.');

  // Check if targetTab exists; if not, create it
  const metaRes = await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    token,
  );
  const meta = (await metaRes.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const exists = (meta.sheets ?? []).some((s) => s.properties?.title === targetTab);

  if (!exists) {
    await sheetsFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: targetTab } } }],
      }),
    });
  }

  const sched = resolveSchedule(binder);
  const values = buildFinalSheetRows(binder, 0, Math.max(0, sched.weeks.length - 1));
  const range = encodeURIComponent(`'${targetTab.replace(/'/g, "''")}'!A1`);

  await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  );

  return { rowsWritten: values.length, tabName: targetTab };
}
