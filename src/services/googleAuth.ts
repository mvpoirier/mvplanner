// Milestone 2: Zero-backend Google Identity Services (GIS) OAuth 2.0 token client.
// Supports VITE_GOOGLE_CLIENT_ID env var OR a user-supplied Client ID saved in Settings.

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

const CLIENT_ID_STORAGE_KEY = 'mvplanner_google_client_id';

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
}

export interface GoogleAuthSession {
  accessToken: string;
  expiresAt: number;
  profile: GoogleUserProfile | null;
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GisTokenResponse) => void;
          }) => GisTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;
let currentSession: GoogleAuthSession | null = null;

export const DEFAULT_GOOGLE_CLIENT_ID =
  '230821830423-ndu4ulp9unu970mia4jeqght530phij4.apps.googleusercontent.com';

export function getConfiguredClientId(): string {
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (envId) return envId;
  try {
    const custom = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
    if (custom) return custom;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_GOOGLE_CLIENT_ID;
}

export function saveCustomClientId(clientId: string): void {
  try {
    if (clientId.trim()) localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId.trim());
    else localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser window'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Failed to load Google Identity Services script (accounts.google.com).'));
    };
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

export function getActiveSession(): GoogleAuthSession | null {
  if (!currentSession) return null;
  if (Date.now() >= currentSession.expiresAt - 30_000) {
    currentSession = null;
    return null;
  }
  return currentSession;
}

export async function signInWithGoogle(explicitClientId?: string): Promise<GoogleAuthSession> {
  const clientId = (explicitClientId ?? getConfiguredClientId()).trim();
  if (!clientId) {
    throw new Error(
      'Google OAuth Client ID is not configured yet. Add VITE_GOOGLE_CLIENT_ID or paste your Web Client ID in Google Sync settings.',
    );
  }

  await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services OAuth2 API unavailable.');

  const tokenResp = await new Promise<GisTokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Google sign-in cancelled.'));
        } else {
          resolve(resp);
        }
      },
    });
    client.requestAccessToken({ prompt: '' });
  });

  const accessToken = tokenResp.access_token!;
  const expiresAt = Date.now() + (tokenResp.expires_in ?? 3600) * 1000;

  let profile: GoogleUserProfile | null = null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const info = await res.json();
      profile = { email: info.email, name: info.name, picture: info.picture };
    }
  } catch {
    // profile is optional
  }

  currentSession = { accessToken, expiresAt, profile };
  return currentSession;
}

export function signOutGoogle(): void {
  const token = currentSession?.accessToken;
  currentSession = null;
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token);
  }
}
