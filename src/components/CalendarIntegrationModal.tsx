'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileUp,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ConnectedCalendarSource } from '@/lib/adapters/calendar-integrations';
import { SCENARIO_PRESETS } from '@/lib/fixtures/scenarios';
import type { GoogleCalendarListItem } from '@/app/api/calendar/google-list/route';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const STORAGE_KEY_CLIENT_ID = 'argon_google_oauth_client_id_v1';
const STORAGE_KEY_TOKEN = 'argon_google_oauth_token_session_v1';

interface CalendarIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSourceId: string;
  connectedSources: ConnectedCalendarSource[];
  mergeWithDemo: boolean;
  onSelectSource: (sourceId: string) => void;
  onAddConnectedSource: (source: ConnectedCalendarSource) => void;
  onRemoveConnectedSource: (sourceId: string) => void;
  onToggleMergeWithDemo: (merge: boolean) => void;
}

export function CalendarIntegrationModal({
  isOpen,
  onClose,
  activeSourceId,
  connectedSources,
  mergeWithDemo,
  onSelectSource,
  onAddConnectedSource,
  onRemoveConnectedSource,
  onToggleMergeWithDemo,
}: CalendarIntegrationModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncingCalendars, setSyncingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Unified Google Auth & Calendar List State
  const [googleClientId, setGoogleClientId] = useState<string>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
  );
  const [accessToken, setAccessToken] = useState<string>('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<
    GoogleCalendarListItem[]
  >([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [showAuthConfigHelper, setShowAuthConfigHelper] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [gisLoaded, setGisLoaded] = useState(false);

  // Collapsible Alternative Import Options (.ics/.zip file, iCal URL, macOS)
  const [showAltImports, setShowAltImports] = useState(false);
  const [icalName, setIcalName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [icsFileName, setIcsFileName] = useState('');
  const [icsFileContent, setIcsFileContent] = useState('');
  const [icsZipBase64, setIcsZipBase64] = useState('');

  // Load Google Identity Services script and check server/localStorage for Client ID or session token
  useEffect(() => {
    if (!isOpen) return;

    // 1. Load Google Identity Services (GIS) script if not already present
    if (typeof window !== 'undefined') {
      if (window.google?.accounts?.oauth2) {
        setGisLoaded(true);
      } else {
        const existingScript = document.querySelector(
          'script[src="https://accounts.google.com/gsi/client"]'
        );
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => setGisLoaded(true);
          document.head.appendChild(script);
        } else {
          existingScript.addEventListener('load', () => setGisLoaded(true));
        }
      }

      const savedClientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
      if (savedClientId) {
        setGoogleClientId(savedClientId);
      }

      const savedToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedToken && availableCalendars.length === 0) {
        setAccessToken(savedToken);
        void fetchCalendarListWithToken(savedToken);
      }
    }

    // 2. Check server /api/status for GOOGLE_CLIENT_ID or GOOGLE_CALENDAR_ACCESS_TOKEN
    fetch('/api/status')
      .then((r) => r.json())
      .then((status) => {
        if (status.googleClientId && !googleClientId) {
          setGoogleClientId(status.googleClientId);
        }
        if (status.googleCalendarConfigured && availableCalendars.length === 0) {
          void fetchCalendarListWithToken('');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  // Step 2: Fetch user's calendar list from Google Calendar API using OAuth token
  const fetchCalendarListWithToken = async (tokenToUse: string) => {
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/google-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenToUse }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to load calendars from Google.');
      }

      const cals = (data.calendars || []) as GoogleCalendarListItem[];
      setAvailableCalendars(cals);
      setAccountEmail(data.accountEmail || 'Google Account');
      if (tokenToUse) {
        setAccessToken(tokenToUse);
        try {
          sessionStorage.setItem(STORAGE_KEY_TOKEN, tokenToUse);
        } catch {
          // ignore
        }
      }

      // Pre-select primary calendar by default
      const primaryIds = cals.filter((c) => c.primary).map((c) => c.id);
      setSelectedCalendarIds(
        primaryIds.length > 0 ? primaryIds : cals.slice(0, 1).map((c) => c.id)
      );
      setShowAuthConfigHelper(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch Google calendars'
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Trigger Google OAuth 2.0 Popup Sign-In
  const handleGoogleSignInClick = () => {
    resetMessages();
    const trimmedClientId = googleClientId.trim();

    if (!trimmedClientId) {
      setShowAuthConfigHelper(true);
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, trimmedClientId);
    } catch {
      // ignore
    }

    if (!window.google?.accounts?.oauth2) {
      setError(
        'Google Identity Services script is still loading. Please try again in a moment or paste an OAuth token below.'
      );
      setShowAuthConfigHelper(true);
      return;
    }

    setLoading(true);
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: trimmedClientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        prompt: 'select_account',
        callback: (response) => {
          if (response.error || !response.access_token) {
            setLoading(false);
            setError(
              response.error_description ||
                response.error ||
                'Google sign-in was cancelled or failed.'
            );
            return;
          }
          void fetchCalendarListWithToken(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initialize Google OAuth popup.'
      );
      setShowAuthConfigHelper(true);
    }
  };

  const handleToggleCalendarSelection = (calId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calId)
        ? prev.filter((id) => id !== calId)
        : [...prev, calId]
    );
  };

  // Step 3: Sync all checked calendars from the picker
  const handleSyncSelectedGoogleCalendars = async () => {
    if (selectedCalendarIds.length === 0) {
      setError('Please select at least one calendar to sync.');
      return;
    }

    resetMessages();
    setSyncingCalendars(true);
    let totalEventsSynced = 0;
    let syncedCount = 0;

    try {
      for (const calId of selectedCalendarIds) {
        const calMeta = availableCalendars.find((c) => c.id === calId);
        const res = await fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'google-api',
            calendarId: calId,
            name: calMeta?.summary || calId,
            color: calMeta?.backgroundColor || '#4285F4',
            accessToken,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(
            data.error || `Failed to sync calendar "${calMeta?.summary || calId}"`
          );
        }
        onAddConnectedSource(data.source);
        totalEventsSynced += data.source.events.length;
        syncedCount += 1;
      }

      setSuccessMsg(
        `Synced ${syncedCount} Google ${
          syncedCount === 1 ? 'calendar' : 'calendars'
        } (${totalEventsSynced} events geocoded and analyzed).`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to sync selected Google calendars'
      );
    } finally {
      setSyncingCalendars(false);
    }
  };

  const handleSignOutGoogle = () => {
    setAccessToken('');
    setAccountEmail(null);
    setAvailableCalendars([]);
    setSelectedCalendarIds([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    } catch {
      // ignore
    }
  };

  // Alternative import handlers (.ics / .zip / iCal URL / macOS / Sample)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    resetMessages();
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanLabel = file.name
      .replace(/\.ical\.zip$/i, '')
      .replace(/\.(ics|zip)$/i, '');
    setIcsFileName(cleanLabel);

    if (file.name.toLowerCase().endsWith('.zip')) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      setIcsZipBase64(btoa(binary));
      setIcsFileContent('');
    } else {
      const text = await file.text();
      setIcsFileContent(text);
      setIcsZipBase64('');
    }
  };

  const handleUploadIcsFile = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!icsFileContent && !icsZipBase64) {
      setError('Please choose an .ics or exported Google Calendar .zip file first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'ical-file',
          name: icsFileName || 'Imported .ics Calendar',
          icsText: icsFileContent || undefined,
          zipBase64: icsZipBase64 || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to parse .ics / .zip file');
      }
      onAddConnectedSource(data.source);
      setSuccessMsg(
        `Imported "${data.source.name}" (${data.source.events.length} events).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import .ics file');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectIcalUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'ical-url',
          name: icalName,
          icalUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch iCal URL');
      }
      onAddConnectedSource(data.source);
      setSuccessMsg(
        `Connected "${data.source.name}" (${data.source.events.length} events synced).`
      );
      setIcalUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect iCal URL');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSamplePersonalCalendar = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'sample-personal',
          name: 'My Personal SF Calendar (Google/iCal)',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to load sample personal calendar');
      }
      onAddConnectedSource(data.source);
      setSuccessMsg(
        `Added "${data.source.name}" (${data.source.events.length} personal events synced).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMacosCalendar = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/macos', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to read macOS Calendar.app');
      }
      onAddConnectedSource(data.source);
      setSuccessMsg(
        `Synced "${data.source.name}" (${data.source.events.length} events found around today).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'macOS Calendar sync failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Calendars & Google Account Sync
              </h2>
              <p className="text-xs text-slate-500">
                Sign in with Google, pick your calendars from the list, and analyze your itinerary
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Feedback Banners */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* UNIFIED WORKFLOW: STEP 1 (GOOGLE AUTH) -> STEP 2 (CALENDAR PICKER) */}
          <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-b from-indigo-50/40 to-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    Unified Workflow
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {availableCalendars.length > 0
                      ? 'Step 2 of 2: Pick Calendars to Sync'
                      : 'Step 1 of 2: Authenticate with Google Calendar'}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {availableCalendars.length > 0
                    ? `Signed in as ${accountEmail}. Select which calendars you want to load into R & Go.`
                    : 'Authenticate once with Google to view and pick from all calendars in your account (including Google Workspace calendars).'}
                </p>
              </div>

              {availableCalendars.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchCalendarListWithToken(accessToken)}
                    disabled={loading}
                    title="Refresh calendar list"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                    />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOutGoogle}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-red-600 hover:border-red-200 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Switch Account</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={loading}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-4 py-2.5 text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    )}
                    <span>Sign in with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAuthConfigHelper((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    title="Configure OAuth Client ID or use a 1-click OAuth token"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Auth Setup</span>
                  </button>
                </div>
              )}
            </div>

            {/* Inline Auth Helper (shown if GOOGLE_CLIENT_ID is not yet set in .env or user clicks Auth Setup) */}
            {availableCalendars.length === 0 && showAuthConfigHelper && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A: Instant OAuth Token (No GCP Client ID setup needed) */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-950">
                        Fastest (No GCP Setup): Google OAuth Playground
                      </span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                        30 sec
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      1. Click the link below (pre-configured with{' '}
                      <code>calendar.readonly</code>), sign in with{' '}
                      <strong>mitchio.weber@callaraskin.com</strong>, and click{' '}
                      <strong>Exchange authorization code for tokens</strong>.
                    </p>
                    <a
                      href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly&url=https%3A%2F%2Fwww.googleapis.com%2F&content_type=application%2Fjson&http_method=GET&useDefaultOauthCred=unchecked"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs"
                    >
                      <span>1. Open Google OAuth Sign-In ↗</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        2. Paste Access Token (`ya29...`) to Load Calendar List:
                      </label>
                      <div className="mt-1 flex gap-1.5">
                        <input
                          type="password"
                          value={manualTokenInput}
                          onChange={(e) => setManualTokenInput(e.target.value)}
                          placeholder="ya29.a0..."
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={!manualTokenInput.trim() || loading}
                          onClick={() =>
                            void fetchCalendarListWithToken(manualTokenInput)
                          }
                          className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                        >
                          Load Calendars →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Option B: Standard Google OAuth Client ID for Popup */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800">
                        Native Google Popup: OAuth Client ID
                      </span>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {gisLoaded ? 'GIS Ready' : 'Loading...'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Have a Google Cloud Web OAuth Client ID (with{' '}
                      <code>http://localhost:3000</code> in Authorized JavaScript
                      origins)? Paste it here or set{' '}
                      <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{' '}
                      <code>.env.local</code>:
                    </p>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        Google OAuth Client ID
                      </label>
                      <div className="mt-1 flex gap-1.5">
                        <input
                          type="text"
                          value={googleClientId}
                          onChange={(e) => setGoogleClientId(e.target.value)}
                          placeholder="123456789-abc.apps.googleusercontent.com"
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={!googleClientId.trim() || loading}
                          onClick={handleGoogleSignInClick}
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                        >
                          Launch Popup
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: AVAILABLE GOOGLE CALENDARS PICKER LIST */}
            {availableCalendars.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Available Calendars in Your Google Account (
                    {availableCalendars.length})
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCalendarIds(
                          availableCalendars.map((c) => c.id)
                        )
                      }
                      className="font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select all
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarIds([])}
                      className="font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {availableCalendars.map((cal) => {
                    const isChecked = selectedCalendarIds.includes(cal.id);
                    return (
                      <label
                        key={cal.id}
                        onClick={() => handleToggleCalendarSelection(cal.id)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-xs transition-colors cursor-pointer ${
                          isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                              isChecked
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>

                          <span
                            className="h-3 w-3 shrink-0 rounded-full shadow-2xs"
                            style={{ backgroundColor: cal.backgroundColor }}
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 truncate">
                                {cal.summary}
                              </span>
                              {cal.primary && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-800">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {cal.id}
                              {cal.timeZone ? ` · ${cal.timeZone}` : ''}
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          {cal.accessRole}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Read-only sync · Pulls all events from -15 days to +15 days
                  </span>

                  <button
                    type="button"
                    disabled={
                      syncingCalendars || selectedCalendarIds.length === 0
                    }
                    onClick={handleSyncSelectedGoogleCalendars}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {syncingCalendars && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>
                      Sync Selected{' '}
                      {selectedCalendarIds.length === 1
                        ? 'Calendar'
                        : `Calendars (${selectedCalendarIds.length})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Active Calendar Switcher (Demo + Connected Personal Calendars) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Active & Connected Calendars (
                {SCENARIO_PRESETS.length + connectedSources.length})
              </h3>
              {connectedSources.length > 0 && (
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeWithDemo}
                    onChange={(e) => onToggleMergeWithDemo(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                  />
                  <span>Overlay personal calendar on top of Demo Day</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {/* Built-in Demo Calendars */}
              {SCENARIO_PRESETS.map((preset) => {
                const isSelected = activeSourceId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => onSelectSource(preset.id)}
                    className={`flex items-start justify-between rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-indigo-600 bg-indigo-50/40 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-indigo-800">
                          Demo Preset
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-extrabold text-slate-900 truncate">
                        {preset.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                        {preset.events.length} events · {preset.subtitle}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600" />
                    )}
                  </div>
                );
              })}

              {/* Connected Personal Calendars */}
              {connectedSources.map((src) => {
                const isSelected = activeSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => onSelectSource(src.id)}
                    className={`flex items-start justify-between rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: src.color }}
                        />
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800">
                          {src.provider === 'google-api'
                            ? 'Google Calendar'
                            : src.provider === 'ical-url'
                            ? 'iCal Feed'
                            : src.provider === 'macos-calendar'
                            ? 'macOS App'
                            : '.ics Calendar'}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-extrabold text-slate-900 truncate">
                        {src.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {src.events.length} events synced ·{' '}
                        {src.availableDates.length} date(s)
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveConnectedSource(src.id);
                        }}
                        title="Remove calendar"
                        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Collapsible Alternative Imports (.ics/.zip file, macOS Calendar, Sample) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAltImports((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-xs font-extrabold text-slate-600 hover:bg-slate-100/70 transition-colors cursor-pointer"
            >
              <span>
                Other Import Options (Upload .ics / Google Export .zip, iCal URL, macOS Calendar, or Demo Sample)
              </span>
              {showAltImports ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showAltImports && (
              <div className="border-t border-slate-200 p-5 space-y-5 bg-white">
                {/* 1. Upload .ics or Google Export .zip */}
                <form onSubmit={handleUploadIcsFile} className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <FileUp className="h-4 w-4 text-emerald-600" />
                    <span>Upload `.ics` or Google Calendar Export `.zip`</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="file"
                      accept=".ics,.zip,text/calendar,application/zip"
                      onChange={handleFileChange}
                      className="flex-1 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <button
                      type="submit"
                      disabled={loading || (!icsFileContent && !icsZipBase64)}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <span>Import File</span>
                    </button>
                  </div>
                </form>

                {/* 2. Secret iCal URL */}
                <form
                  onSubmit={handleConnectIcalUrl}
                  className="border-t border-slate-100 pt-4 space-y-2.5"
                >
                  <div className="text-xs font-extrabold text-slate-800">
                    Secret iCal (`.ics`) or `webcal://` URL
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={icalName}
                      onChange={(e) => setIcalName(e.target.value)}
                      placeholder="Label (optional)"
                      className="sm:w-44 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={icalUrl}
                      onChange={(e) => setIcalUrl(e.target.value)}
                      placeholder="https://calendar.google.com/calendar/ical/.../private-xxx/basic.ics"
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="shrink-0 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
                    >
                      Fetch Feed
                    </button>
                  </div>
                </form>

                {/* 3. Quick Actions: macOS Calendar & Sample Personal Calendar */}
                <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSyncMacosCalendar}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 cursor-pointer"
                  >
                    <Laptop className="h-3.5 w-3.5 text-amber-700" />
                    <span>Sync from macOS Calendar.app</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleLoadSamplePersonalCalendar}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 text-xs font-bold text-indigo-800 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Load Sample Personal SF Calendar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 text-xs">
          <span className="text-slate-500">
            All imported events are geocoded and analyzed by the deterministic conflict engine.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
