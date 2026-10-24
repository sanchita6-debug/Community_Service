/**
 * ============================================================================
 * Database (SQLite)
 * ============================================================================
 *
 * Every user's data of every feature lives here, in one file. This replaces the
 * in-memory store: the API's copy used to be wiped on every restart, which
 * meant a "save" only ever survived until the next deploy.
 *
 * WHY SQLITE, AND WHY THIS DRIVER
 *   The app has no database server, no connection string, and no third party -
 *   it is a single Node process someone runs on their own machine. SQLite is
 *   the one database that fits that shape: a file, no daemon, transactional.
 *   `better-sqlite3` is synchronous, which is why every function in store.js
 *   can be a plain function rather than a Promise - see the note there.
 *
 * THE PROMISE THIS FILE KEEPS
 *   No OTP, PIN, password, card number, or bank account is ever written. The
 *   allow-list in schema.js is the single authority on what a document may
 *   contain, and the `activity` table stores a verdict and its metadata -
 *   never the message the user pasted. That is a deliberate product decision,
 *   not an oversight: see ACTIVITY_* in schema.js.
 *
 * SCHEMA
 *   One table per document kind, plus an append-only activity log. Documents
 *   are stored as JSON in a `data` column rather than exploded into columns,
 *   because the client and the API already agree on a document shape
 *   (schema.js) and splitting it into columns would create a second, competing
 *   definition of that shape. The columns that exist beside it (updated_at,
 *   user_id) are the ones we actually query on.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the database file lives. `:memory:` is honoured so the test suite can
 * run against a real database without leaving a file behind.
 */
const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'data', 'voicepay.db');

/** True when the caller asked for an ephemeral database. */
const isMemory = DB_PATH === ':memory:';

/**
 * Open (or create) the database. Called once at import; every other module
 * imports the helpers below rather than the handle, so the connection is a
 * single shared instance.
 */
function open() {
  if (!isMemory) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  const db = new Database(DB_PATH);

  // WAL keeps a reader from blocking the periodic sync writes, and survives a
  // hard kill better than the default rollback journal. `foreign_keys` is off
  // by default in SQLite and we have no foreign keys, but it is set anyway so
  // a future table cannot quietly create orphan rows.
  if (!isMemory) db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id          TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress (
      id          TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    -- Append-only. One row per thing a feature did, so a person (or a family
    -- helper) can see what has been checked on this account.
    --
    -- NOTE the absent column: there is no text / body / content column here,
    -- and there must never be one. What a user pastes can contain an account
    -- number; what we keep is what the engine decided about it.
    CREATE TABLE IF NOT EXISTS activity (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      kind        TEXT NOT NULL,
      verdict     TEXT,
      score       INTEGER,
      meta        TEXT NOT NULL DEFAULT '{}',
      actor       TEXT,
      created_at  TEXT NOT NULL
    );

    -- Every read is "this user, newest first".
    CREATE INDEX IF NOT EXISTS idx_activity_user_created
      ON activity (user_id, created_at DESC);

    -- And every read of one kind ("just my safety checks") filters on both.
    CREATE INDEX IF NOT EXISTS idx_activity_user_kind
      ON activity (user_id, kind, created_at DESC);
  `);

  return db;
}

export const db = open();

/** The path actually in use, for the startup log and the health endpoint. */
export const databasePath = isMemory ? ':memory:' : DB_PATH;
export const databaseKind = isMemory ? 'memory' : 'sqlite';

/* -------------------------------------------------------------------------- */
/* Document helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Reads one document. Returns `null` when it has never been written, which is
 * the caller's signal to fall back to defaults.
 */
export function readDoc(table, id) {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    // A corrupted row should read as "no document", not crash a request.
    console.warn(`[db] Corrupted ${table} row for ${id}; treating as missing.`);
    return null;
  }
}

/**
 * Inserts or replaces a whole document. `updated_at` is passed in rather than
 * defaulted so the caller's own timestamp (which the client may have set) wins.
 */
export function writeDoc(table, id, data, updatedAt) {
  const now = updatedAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(id, JSON.stringify(data), now);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Activity log                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Appends one activity row.
 *
 * The caller decides what goes in `meta`, but it must only ever be derived
 * facts - an amount, a payee name, a lesson id - never the source text.
 */
export function insertActivity(entry) {
  db.prepare(
    `INSERT INTO activity (id, user_id, kind, verdict, score, meta, actor, created_at)
     VALUES (@id, @user_id, @kind, @verdict, @score, @meta, @actor, @created_at)`
  ).run({
    id: entry.id,
    user_id: entry.userId,
    kind: entry.kind,
    verdict: entry.verdict ?? null,
    score: entry.score ?? null,
    meta: JSON.stringify(entry.meta || {}),
    actor: entry.actor ?? null,
    created_at: entry.createdAt || new Date().toISOString(),
  });
  return true;
}

/** Lists a user's activity, newest first, optionally filtered to one kind. */
export function listActivity(userId, { kind = null, limit = 50, offset = 0 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const skip = Math.max(Number(offset) || 0, 0);

  const rows = kind
    ? db
        .prepare(
          `SELECT * FROM activity WHERE user_id = ? AND kind = ?
           ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`
        )
        .all(userId, kind, capped, skip)
    : db
        .prepare(
          `SELECT * FROM activity WHERE user_id = ?
           ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`
        )
        .all(userId, capped, skip);

  return rows.map(rowToActivity);
}

/** Total rows, so the client can show "showing 20 of 140" honestly. */
export function countActivity(userId, kind = null) {
  const row = kind
    ? db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE user_id = ? AND kind = ?`).get(userId, kind)
    : db.prepare(`SELECT COUNT(*) AS n FROM activity WHERE user_id = ?`).get(userId);
  return row?.n ?? 0;
}

/** Removes one activity row, scoped to its owner. */
export function deleteActivity(userId, id) {
  const info = db.prepare(`DELETE FROM activity WHERE user_id = ? AND id = ?`).run(userId, id);
  return info.changes > 0;
}

/** Removes a user's whole activity history. */
export function clearActivity(userId, kind = null) {
  const info = kind
    ? db.prepare(`DELETE FROM activity WHERE user_id = ? AND kind = ?`).run(userId, kind)
    : db.prepare(`DELETE FROM activity WHERE user_id = ?`).run(userId);
  return info.changes;
}

function rowToActivity(row) {
  let meta = {};
  try {
    meta = JSON.parse(row.meta || '{}');
  } catch {
    meta = {};
  }
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    verdict: row.verdict,
    score: row.score,
    meta,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Whole-account operations                                                    */
/* -------------------------------------------------------------------------- */

/** How much data is stored per table - the "what is saved" summary. */
export function stats() {
  const one = (sql) => db.prepare(sql).get()?.n ?? 0;
  return {
    users: one('SELECT COUNT(*) AS n FROM users'),
    settings: one('SELECT COUNT(*) AS n FROM settings'),
    progress: one('SELECT COUNT(*) AS n FROM progress'),
    activity: one('SELECT COUNT(*) AS n FROM activity'),
    activityByKind: db
      .prepare('SELECT kind, COUNT(*) AS n FROM activity GROUP BY kind')
      .all()
      .reduce((acc, r) => ({ ...acc, [r.kind]: r.n }), {}),
  };
}

/**
 * Deletes everything for one user. Used by "delete my data", which the app has
 * to be able to offer if it is going to store anything at all.
 */
export function deleteUser(userId) {
  const tx = db.transaction((id) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM settings WHERE id = ?').run(id);
    db.prepare('DELETE FROM progress WHERE id = ?').run(id);
    db.prepare('DELETE FROM activity WHERE user_id = ?').run(id);
  });
  tx(userId);
  return true;
}

/** Closes the handle. Called on process shutdown so WAL is checkpointed. */
export function closeDatabase() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
}
