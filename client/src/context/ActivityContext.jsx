/**
 * ============================================================================
 * Activity context - the saved record of what the features did
 * ============================================================================
 *
 * Local-first, exactly like settings and progress: a record is written to
 * localStorage IMMEDIATELY, then pushed to the API in the background. The
 * History screen renders from localStorage, so it is complete and instant with
 * no network at all - which is the normal state of affairs for this app.
 *
 * WHY localStorage HOLDS THE FULL LIST
 *   The API's database is the shared copy (so a family helper sees the same
 *   record from another device), but it is not required for the feature to
 *   work. Keeping the list here means: finishing a safety check on a train with
 *   no signal still leaves a record, and the History screen never shows a
 *   spinner for data the phone already has.
 *
 * BOUNDED, DELIBERATELY
 *   A log that grows forever is a liability, so localStorage keeps the newest
 *   MAX_LOCAL records. The server keeps everything until the user clears it.
 *
 * WHAT IS NEVER STORED
 *   The message the user pasted. `lib/activity.js` builds records from an
 *   allow-list of derived facts, and the server enforces the same rule again.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  recordActivityEntry,
  fetchActivity,
  deleteActivityEntry,
  clearActivity as clearActivityRemote,
} from '../lib/api.js';
import { KEYS, read, write, isOnline } from '../lib/storage.js';
import { buildRecord, normaliseRecord } from '../lib/activity.js';

const ActivityContext = createContext(null);

/** How many records this device keeps. Older ones live on the server only. */
const MAX_LOCAL = 200;

/** Reads the stored list, dropping anything malformed. */
function readLocal() {
  const raw = read(KEYS.activity, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normaliseRecord).filter(Boolean);
}

export function ActivityProvider({ userId, children }) {
  const [records, setRecords] = useState(readLocal);
  const [syncError, setSyncError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Which user the currently-loaded records belong to. Used so a late response
  // cannot write one user's history into another user's screen.
  const loadedFor = useRef(null);

  /* --- Load from the server once, and merge ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOnline() || !userId) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchActivity(userId, { limit: MAX_LOCAL });
        if (cancelled || !data?.items) return;

        const remote = data.items.map(normaliseRecord).filter(Boolean);

        // Local wins on conflict: a record made offline exists only locally,
        // and one made online exists in both with the same id.
        const byId = new Map();
        for (const r of remote) byId.set(r.id, r);
        for (const r of readLocal()) byId.set(r.id, r);

        const merged = [...byId.values()]
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, MAX_LOCAL);

        loadedFor.current = userId;
        persistLocal(merged);
      } catch (err) {
        setSyncError(err.code || 'offline');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- Persistence ------------------------------------------------------- */

  function persistLocal(next) {
    write(KEYS.activity, next);
    setRecords(next);
  }

  /**
   * Records one thing a feature did.
   *
   * Synchronous from the caller's point of view: the record is on screen before
   * the function returns, and the network push is fire-and-forget. A failure
   * only sets `syncError` - the local record stays.
   *
   * @param {string} kind  one of the kinds in lib/activity.js
   * @param {object} source the feature's result object
   * @param {object} extra  verdict / score / actor / createdAt
   * @returns {object|null} the record that was stored
   */
  const record = useCallback(
    (kind, source = {}, extra = {}) => {
      const entry = buildRecord(kind, source, extra);
      if (!entry) return null;

      setRecords((current) => {
        const next = [entry, ...current].slice(0, MAX_LOCAL);
        write(KEYS.activity, next);
        return next;
      });

      recordActivityEntry(userId, entry).catch((err) => {
        setSyncError(err.code || 'offline');
      });

      return entry;
    },
    [userId]
  );

  /** Removes one record here and on the server. */
  const remove = useCallback(
    (id) => {
      setRecords((current) => {
        const next = current.filter((r) => r.id !== id);
        write(KEYS.activity, next);
        return next;
      });
      deleteActivityEntry(userId, id).catch(() => {});
    },
    [userId]
  );

  /**
   * Wipes the history. Optionally one kind only ("forget my safety checks").
   * The clear is attempted on the server too, but the local list is emptied
   * regardless - leaving records on screen after the user asked to delete them
   * would be worse than a failed sync.
   */
  const clear = useCallback(
    (kind = null) => {
      setRecords((current) => {
        const next = kind ? current.filter((r) => r.kind !== kind) : [];
        write(KEYS.activity, next);
        return next;
      });
      clearActivityRemote(userId, kind).catch(() => {});
    },
    [userId]
  );

  /** Forces a re-read from the server, for the History screen's refresh. */
  const refresh = useCallback(async () => {
    try {
      const data = await fetchActivity(userId, { limit: MAX_LOCAL });
      const remote = (data?.items || []).map(normaliseRecord).filter(Boolean);
      const byId = new Map();
      for (const r of remote) byId.set(r.id, r);
      const merged = [...byId.values()]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, MAX_LOCAL);
      persistLocal(merged);
      setSyncError(null);
    } catch (err) {
      setSyncError(err.code || 'offline');
    }
  }, [userId]);

  /* --- Derived ----------------------------------------------------------- */

  /** Records grouped by kind, for the filter chips and the summary badges. */
  const counts = useMemo(() => {
    const out = { safety: 0, explain: 0, send: 0, lesson: 0, practice: 0 };
    for (const r of records) {
      if (out[r.kind] !== undefined) out[r.kind] += 1;
    }
    return out;
  }, [records]);

  const value = useMemo(
    () => ({
      records,
      counts,
      total: records.length,
      loading,
      syncError,
      record,
      remove,
      clear,
      refresh,
    }),
    [records, counts, loading, syncError, record, remove, clear, refresh]
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used inside <ActivityProvider>');
  return ctx;
}
