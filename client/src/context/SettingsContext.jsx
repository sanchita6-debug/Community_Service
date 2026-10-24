/**
 * ============================================================================
 * Settings context - language, font size, voice speed, trusted payees
 * ============================================================================
 *
 * Responsibilities:
 *   - Hold the current settings in memory (source of truth for the UI).
 *   - Apply font size / contrast to the DOM via CSS variables.
 *   - Persist to localStorage IMMEDIATELY (so it always works), and to the API
 *     in the background (so a helper's edits go through the allow-listed write).
 *
 * WRITE ORDERING (why this matters):
 *   localStorage first, network second. If the network fails we have still
 *   done the right thing for the person in front of us, and we queue the
 *   change to retry later. Never the other way around.
 *
 *   localStorage is also the ONLY durable copy - there is no database behind the
 *   API, and the API's store resets whenever the server restarts.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTranslator, LANGUAGES, BASE_LANGUAGE, SUPPORTED } from '../i18n/index.js';
import { fetchSettings, saveSettings } from '../lib/api.js';
import { KEYS, read, write, isOnline, readPendingWrites, writePendingWrites, pushPendingWrite } from '../lib/storage.js';
import { DEFAULT_USER_SETTINGS } from '@shared/demoData.js';

const SettingsContext = createContext(null);

/** Font-size preference -> the CSS multiplier used by the Tailwind scale. */
const FONT_SCALE = { normal: 1, large: 1.12, xlarge: 1.28 };

/** A user who has not signed in still needs a stable id for local storage. */
const LOCAL_UID = 'demo-user';

/**
 * @param {object|null} authUser  The signed-in helper, mirrored in from the
 *   auth context. It is what turns a change into an audit trail: without it
 *   every trusted payee is recorded as "added by self", which is precisely the
 *   question helper mode exists to answer.
 */
export function SettingsProvider({
  children,
  remoteTarget = null,
  getToken = null,
  authUser = null,
}) {
  // Start from local storage so the very first paint is already correct -
  // no flash of English before a Bengali user sees their language.
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_USER_SETTINGS,
    ...(read(KEYS.settings) || {}),
  }));
  // The id of the settings DOCUMENT this device reads and writes. It never
  // changes on sign-in: every API request is stamped with 'demo-user'
  // (server/src/auth.js), so a helper's own account uid is not a settings
  // document - writing to settings/<that uid> is refused with a 403.
  const [userId] = useState(LOCAL_UID);
  const [user, setUser] = useState(() => read(KEYS.user, null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | local | error
  const [offline, setOffline] = useState(!isOnline());

  // Pending writes, retried when the connection returns.
  const pendingRef = useRef(read(KEYS.queue, []));

  /** The signed-in user's own ID token, or null when signed out. */
  const getOwnToken = useCallback(async () => (getToken ? getToken() : null), [getToken]);

  /* ---------------------------------------------------------------------- */
  /* Derived values                                                          */
  /* ---------------------------------------------------------------------- */
  const lang = LANGUAGES[settings.language] ? settings.language : BASE_LANGUAGE;
  const t = useMemo(() => createTranslator(lang), [lang]);
  const dir = 'ltr'; // All five supported languages are left-to-right.

  /* ---------------------------------------------------------------------- */
  /* DOM side effects: font size, contrast and theme                         */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', String(FONT_SCALE[settings.fontSize] ?? 1));
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('lang', LANGUAGES[lang]?.bcp47 || 'en-IN');
  }, [settings.fontSize, settings.highContrast, settings.theme, lang]);

  /* ---------------------------------------------------------------------- */
  /* Persisting                                                              */
  /* ---------------------------------------------------------------------- */

  /** Writes locally right away. This must never fail the user experience. */
  const persistLocal = useCallback((next) => {
    write(KEYS.settings, next);
  }, []);

  /**
   * Pushes settings to the API. Fire and forget: the UI has already updated, so
   * a failure only changes the "saved" toast text. localStorage already has the
   * change, so nothing the person did is lost when this fails.
   */
  const pushRemote = useCallback(
    async (next, uid) => {
      if (!isOnline()) {
        queuePending(uid);
        setSaveStatus('local');
        return;
      }
      const targetUid = uid || remoteTarget?.uid || userId;
      setSaving(true);
      setSaveStatus('saving');
      try {
        // In helper mode the signed-in helper's token is required: it is what
        // authorises writing to somebody else's document.
        const token = remoteTarget?.token ?? (await getOwnToken());
        await saveSettings(targetUid, next, token);
        setSaveStatus('saved');
      } catch {
        const targetUidFail = uid || remoteTarget?.uid || userId;
        queuePending(targetUidFail, next);
        setSaveStatus('local');
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, remoteTarget?.uid, remoteTarget?.token]
  );

  /** Remembers a uid whose save failed so it can be retried when back online. */
  const queuePending = useCallback((uid, payload) => {
    if (!uid) return;
    const queue = [...new Set([...pendingRef.current, uid])];
    pendingRef.current = queue;
    write(KEYS.queue, queue);
    if (payload) {
      pushPendingWrite({
        uid: remoteTarget?.uid || uid,
        settings: payload,
        ts: Date.now(),
        updatedBy: user?.email || userId,
      });
    }
  }, [remoteTarget?.uid, user?.email, userId]);

  /**
   * The single public update function. Optimistic, local-first.
   * @param {Partial<object>} patch
   */
  const updateSettings = useCallback(
    (patch) => {
      setSettings((current) => {
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
        persistLocal(next);
        pushRemote(next);
        return next;
      });
    },
    [persistLocal, pushRemote]
  );

  /* ---------------------------------------------------------------------- */
  /* Load once on mount                                                      */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      // In helper mode we read the TARGET's settings, not our own: a relative
      // opening Family Helper is configuring somebody else's phone.
      const localUid = remoteTarget?.uid || user?.uid || userId;

      if (!isOnline()) {
        // Offline: local settings ARE the settings.
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const token = remoteTarget?.token ?? (await getOwnToken());
        const data = await fetchSettings(localUid, token);
        if (cancelled || !data?.settings) return;
        // The server is the source of truth when reachable, but we merge so a
        // field that exists only locally (e.g. a language chosen offline) is
        // not silently thrown away.
        setSettings((current) => {
          const next = { ...current, ...data.settings, updatedAt: data.updatedAt || current.updatedAt };
          persistLocal(next);
          return next;
        });
      } catch (err) {
        console.warn('[settings] load failed, using local:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-runs when the helper switches which phone it is configuring.
  }, [remoteTarget?.uid, remoteTarget?.token, user?.uid, userId, getOwnToken, persistLocal]);

  /* ---------------------------------------------------------------------- */
  /* Connectivity                                                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const flushPending = async () => {
      const pending = readPendingWrites();
      if (pending.length === 0) return;
      let updated = [...pending];
      for (let i = 0; i < updated.length; i++) {
        const p = updated[i];
        try {
          const token = remoteTarget?.token ?? (await getOwnToken());
          await saveSettings(p.uid || remoteTarget?.uid || userId, p.settings, token);
          updated = updated.filter((x) => x.id !== p.id);
        } catch (err) {
          updated[i] = { ...p, retries: (p.retries || 0) + 1, lastAttempt: Date.now() };
        }
      }
      writePendingWrites(updated);
      // also clear legacy uid queue
      if (pendingRef.current.length > 0) {
        pendingRef.current = [];
        write(KEYS.queue, []);
      }
    };

    const goOnline = () => {
      setOffline(false);
      flushPending();
      // legacy
      if (pendingRef.current.length > 0) {
        const targets = pendingRef.current;
        pendingRef.current = [];
        write(KEYS.queue, []);
        targets.forEach((uid) => pushRemote(settings, uid));
      }
    };
    const goOffline = () => setOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (isOnline()) {
      flushPending();
    }
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, remoteTarget?.token, remoteTarget?.uid, userId]);

  /* ---------------------------------------------------------------------- */
  /* Convenience actions                                                     */
  /* ---------------------------------------------------------------------- */
  const setLanguage = useCallback(
    (code) => {
      if (!SUPPORTED.includes(code)) return;
      updateSettings({ language: code });
    },
    [updateSettings]
  );

  /**
   * Switches between the light and the dark screen.
   *
   * The whole palette is CSS variables, so this is one attribute on <html>
   * and every screen changes with it. It is a setting like any other: it is
   * saved to this phone immediately and pushed to the API in the background,
   * exactly like the language or the text size.
   */
  const setTheme = useCallback(
    (next) => {
      if (next !== 'light' && next !== 'dark') return;
      updateSettings({ theme: next });
    },
    [updateSettings]
  );

  const addTrustedPayee = useCallback(
    (payee) => {
      const clean = {
        id: `tp-${Date.now().toString(36)}`,
        name: String(payee.name || '').trim().slice(0, 40),
        vpa: String(payee.vpa || '').trim().slice(0, 80),
        addedBy: user?.email || 'self',
        addedAt: new Date().toISOString(),
      };
      if (!clean.name) return null;
      updateSettings({
        trustedPayees: [...(settings.trustedPayees || []), clean].slice(0, 50),
      });
      return clean;
    },
    [settings.trustedPayees, updateSettings, user?.email]
  );

  const removeTrustedPayee = useCallback(
    (id) => {
      updateSettings({
        trustedPayees: (settings.trustedPayees || []).filter((p) => p.id !== id),
      });
    },
    [settings.trustedPayees, updateSettings]
  );

  /**
   * Mirrors the signed-in helper into this context.
   *
   * The session itself belongs to localAuth - KEYS.user is its business. This
   * only READS it, and must never write or remove it: React runs a child's
   * effects before its parent's, so this effect runs before AuthProvider
   * subscribes to the session. Removing KEYS.user here would sign the helper
   * out on every reload.
   *
   * Mirroring is what makes the audit trail real. Without it every trusted
   * payee is stamped "added by self", which is exactly the question that
   * helper mode exists to answer.
   */
  const setUserContext = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  /*
   * Mirror the signed-in helper into this context.
   *
   * Nothing else called setUserContext, so `user` stayed null for the whole
   * life of the app and every payee was stamped "added by self" - the audit
   * trail was decorative. The auth context is the only place that knows who
   * signed in, and it lives above this provider, so the mirror has to happen
   * here rather than inside the auth context.
   */
  useEffect(() => {
    setUserContext(authUser);
  }, [authUser, setUserContext]);

  const value = useMemo(
    () => ({
      settings,
      // Flattened for convenience in components.
      language: lang,
      fontSize: settings.fontSize,
      speechRate: settings.speechRate,
      ttsEnabled: settings.ttsEnabled,
      highContrast: settings.highContrast,
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      trustedPayees: settings.trustedPayees || [],
      // Translation + language helpers.
      t,
      lang,
      dir,
      languages: LANGUAGES,
      // Status flags for the UI.
      loading,
      saving,
      saveStatus,
      offline,
      user,
      userId,
      // Actions.
      setLanguage,
      setTheme,
      setUserContext,
      updateSettings,
      addTrustedPayee,
      removeTrustedPayee,
    }),
    [
      settings, lang, t, dir, loading, saving, saveStatus, offline,
      user, userId, setLanguage, setTheme, setUserContext, updateSettings,
      addTrustedPayee, removeTrustedPayee,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
