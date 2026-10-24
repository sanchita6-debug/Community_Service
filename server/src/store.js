/**
 * ============================================================================
 * Store (server-side) - SQLite-backed
 * ============================================================================
 * The API's copy of settings, progress, helper consent, and feature activity.
 *
 * It used to be three Maps in this process's memory, which meant every "save"
 * was lost the moment the server restarted. It is now a real SQLite database
 * (see server/src/db.js), so a save survives a restart and a family helper
 * reading the record later sees what actually happened.
 *
 * WHY THESE FUNCTIONS ARE `async` EVEN THOUGH SQLITE IS SYNCHRONOUS
 *   `better-sqlite3` is synchronous, so none of this work is actually
 *   asynchronous. The functions stay `async` on purpose: they were `async`
 *   when the store was remote (a hosted database), every caller already
 *   `await`s them, and the test suite drives them through the HTTP routes. If
 *   the store ever moves behind a network again, only this file changes.
 *
 * WHAT IT NEVER HOLDS
 *   No OTP, PIN, password, card number, or bank account. server/src/schema.js
 *   owns the field allow-list and is the single authority on what a document
 *   may contain, so there is no path into this store that could write one.
 *   The activity log is deliberately narrower still: it records verdicts and
 *   derived facts, never the text a user pasted.
 */
import {
  readDoc,
  writeDoc,
  insertActivity,
  listActivity,
  countActivity,
  deleteActivity,
  clearActivity,
  stats,
  deleteUser,
  closeDatabase,
  databasePath,
  databaseKind,
} from './db.js';
import { sanitiseSettings, sanitiseActivity } from './schema.js';

/** ISO timestamp helper - every document carries one. */
const now = () => new Date().toISOString();

/**
 * Trusted payee shape is owned by schema.js. Delegating keeps one copy of it,
 * so the value this store holds cannot drift from the value the API serves.
 */
function mapTrustedPayees(tp) {
  if (!Array.isArray(tp)) return tp;
  return sanitiseSettings({ trustedPayees: tp }).trustedPayees;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The identity-level document: who may write to this person's settings.
 * @returns {Promise<{ data: object|null, exists: boolean }>}
 */
export async function getUserDoc(docId) {
  const doc = readDoc('users', docId);
  if (!doc) return { data: null, exists: false };
  return { data: { ...doc, helpers: Array.isArray(doc.helpers) ? doc.helpers : [] }, exists: true };
}

/**
 * The display-preferences document.
 * @returns {Promise<{ data: object|null, exists: boolean }>}
 */
export async function getSettingsDoc(docId) {
  const doc = readDoc('settings', docId);
  if (!doc) return { data: null, exists: false };
  return {
    data: { ...doc, trustedPayees: Array.isArray(doc.trustedPayees) ? doc.trustedPayees : [] },
    exists: true,
  };
}

/**
 * The learning-progress document.
 * @returns {Promise<{ data: object|null, exists: boolean }>}
 */
export async function getProgressDoc(docId) {
  const doc = readDoc('progress', docId);
  if (!doc) return { data: null, exists: false };
  return {
    data: {
      completedLessons: Array.isArray(doc.completedLessons) ? doc.completedLessons : [],
      practice: doc.practice || { total: 0, correct: 0, byMessage: {} },
      lastSeenAt: doc.lastSeenAt || null,
    },
    exists: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Merges fields into the identity document. Unspecified fields are left as
 * they were, so a partial write never loses the helper consent list.
 */
export async function upsertUser(docId, fields = {}) {
  if (!docId) return false;
  const existing = readDoc('users', docId) || { helpers: [], createdAt: now() };
  const patch = { ...existing };

  if (fields.helpers !== undefined) patch.helpers = Array.isArray(fields.helpers) ? fields.helpers : [];
  if (fields.displayName !== undefined) patch.displayName = fields.displayName;
  if (fields.language !== undefined) patch.language = fields.language;
  if (fields.createdAt) patch.createdAt = fields.createdAt;
  patch.updatedAt = now();

  writeDoc('users', docId, patch, patch.updatedAt);
  return true;
}

/**
 * Merges fields into the display-preferences document. Unspecified fields keep
 * their previous value, so writing only `language` does not wipe the text size.
 */
export async function upsertSettings(docId, fields = {}) {
  if (!docId) return false;
  const existing = readDoc('settings', docId) || {};
  const patch = { ...existing };

  if (fields.language !== undefined) patch.language = fields.language;
  if (fields.fontSize !== undefined) patch.fontSize = fields.fontSize;
  if (fields.speechRate !== undefined) patch.speechRate = fields.speechRate;
  if (fields.ttsEnabled !== undefined) patch.ttsEnabled = fields.ttsEnabled;
  if (fields.highContrast !== undefined) patch.highContrast = fields.highContrast;
  // Which screen the app is shown in: 'light' or 'dark'.
  if (fields.theme !== undefined) patch.theme = fields.theme;
  if (fields.trustedPayees !== undefined) patch.trustedPayees = mapTrustedPayees(fields.trustedPayees);
  if (fields.updatedBy !== undefined) patch.updatedBy = fields.updatedBy;
  if (fields.updatedAt !== undefined) patch.updatedAt = fields.updatedAt;
  else patch.updatedAt = now();

  writeDoc('settings', docId, patch, patch.updatedAt);
  return true;
}

/**
 * Merges fields into the learning-progress document.
 */
export async function upsertProgress(docId, fields = {}) {
  if (!docId) return false;
  const existing = readDoc('progress', docId) || {};
  const patch = { ...existing };

  if (fields.completedLessons !== undefined) {
    patch.completedLessons = Array.isArray(fields.completedLessons) ? fields.completedLessons : [];
  }
  if (fields.practice !== undefined) patch.practice = fields.practice;
  patch.lastSeenAt = fields.lastSeenAt || now();

  writeDoc('progress', docId, patch, patch.lastSeenAt);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Activity - what the features did                                            */
/* -------------------------------------------------------------------------- */

/**
 * Records one thing a feature did.
 *
 * `meta` is the caller's, but it passes through `sanitiseActivity` first, which
 * is an allow-list of derived facts per kind. That is the guard that keeps the
 * message a user pasted out of this table - see ACTIVITY_NOTE in schema.js.
 *
 * @returns {Promise<object|null>} the stored row, or null if it was rejected.
 */
export async function recordActivity(docId, entry) {
  if (!docId) return null;

  const clean = sanitiseActivity(entry);
  if (!clean) return null;

  const id = entry.id || `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = entry.createdAt || now();

  insertActivity({
    id,
    userId: docId,
    kind: clean.kind,
    verdict: clean.verdict,
    score: clean.score,
    meta: clean.meta,
    actor: clean.actor,
    createdAt,
  });

  return { id, userId: docId, ...clean, createdAt };
}

/** A user's activity, newest first. */
export async function getActivity(docId, options = {}) {
  if (!docId) return { items: [], total: 0 };
  return {
    items: listActivity(docId, options),
    total: countActivity(docId, options.kind ?? null),
  };
}

/** Removes one activity row. */
export async function removeActivity(docId, id) {
  if (!docId || !id) return false;
  return deleteActivity(docId, id);
}

/** Removes a user's history, or one kind of it. */
export async function clearUserActivity(docId, kind = null) {
  if (!docId) return 0;
  return clearActivity(docId, kind);
}

/* -------------------------------------------------------------------------- */
/* Whole-account operations                                                    */
/* -------------------------------------------------------------------------- */

/** Per-table counts, for the health endpoint and the "your data" screen. */
export async function storeStats() {
  return stats();
}

/** Deletes everything stored for one user. Backs "delete my data". */
export async function deleteAllUserData(docId) {
  if (!docId) return false;
  return deleteUser(docId);
}

/* -------------------------------------------------------------------------- */
/* Re-exports                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The database's location and kind, and its close handle, are surfaced through
 * this module so callers import from one place: routes and the server never
 * reach into db.js directly, and the store stays the single description of
 * where the data lives.
 */
export { databasePath, databaseKind, closeDatabase };
