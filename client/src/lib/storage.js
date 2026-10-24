/**
 * ============================================================================
 * Local storage helper - the app's only storage
 * ============================================================================
 *
 * There is no database server and no third-party copy of anything personal.
 * This device's localStorage holds the durable, always-available copy of:
 *   - display preferences (language, text size, voice speed, contrast)
 *   - trusted payee NAMES
 *   - lesson and practice progress
 *   - a recent-activity history (see context/ActivityContext.jsx)
 *   - the local helper profile (see lib/localAuth.js)
 *
 * We only ever store display preferences, trusted payee NAMES, lesson progress,
 * and activity VERDICTS. Never an OTP, PIN, password, card number, or bank
 * account - and never the message the user pasted (see lib/activity.js).
 *
 * It is the durable copy. The API keeps a second copy in a SQLite database
 * (server/data/voicepay.db) so a family helper sees the same record from their
 * own device, which is why a write here happens first and the network second:
 * see context/SettingsContext.jsx.
 */

const PREFIX = 'voicepay:';

export const KEYS = {
  settings: `${PREFIX}settings`,
  progress: `${PREFIX}progress`,
  user: `${PREFIX}user`,
  accounts: `${PREFIX}accounts`,
  helper: `${PREFIX}helper-target`,
  queue: `${PREFIX}pending-settings`,
  onboarded: `${PREFIX}onboarded`,
  lastVerdict: `${PREFIX}last-verdict`,
  activity: `${PREFIX}activity`,
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    // A corrupted value should never break the app.
    console.warn('[storage] Could not parse stored value, resetting.');
    return fallback;
  }
}

export function read(key, fallback = null) {
  try {
    return safeParse(window.localStorage.getItem(key), fallback);
  } catch {
    // Private browsing modes can throw on access.
    return fallback;
  }
}

export function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] Could not write:', err.message);
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True when the browser thinks it has a connection. */
export function isOnline() {
  if (typeof navigator === 'undefined') return true;
  // `onLine` is only a hint - it reports "connected to a network", not
  // "the internet works". We still always try the request and fall back.
  return navigator.onLine !== false;
}

const PENDING_KEY = `${PREFIX}pending-writes`;

/**
 * Outbox for offline writes (collecting data). Stores full payloads so edits
 * survive app restarts while offline.
 */
export function readPendingWrites() {
  return read(PENDING_KEY, []);
}

export function writePendingWrites(list) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list || []));
    return true;
  } catch (err) {
    console.warn('[storage] Could not write pending:', err.message);
    return false;
  }
}

export function pushPendingWrite(entry) {
  const list = readPendingWrites();
  list.push({ id: entry.id || `pw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, retries: 0, lastAttempt: null, ...entry });
  writePendingWrites(list);
  return list;
}

