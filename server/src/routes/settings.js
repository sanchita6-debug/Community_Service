/**
 * GET    /api/settings/:userId   -> read a user's preferences
 * PUT    /api/settings/:userId   -> update preferences (allow-listed fields only)
 * DELETE /api/settings/:userId   -> erase everything stored for this user
 * ---------------------------------------------------------------------------
 * Backed by a SQLite database (see server/src/store.js and server/src/db.js):
 * reads fall back to the defaults below for a document that has never been
 * written, and the browser keeps its own durable copy in localStorage. The same
 * handler serves the main user and the "family helper" relative, so a helper's
 * edits to language / font size / trusted payees land on the main user's
 * document.
 *
 * Every caller is the same anonymous local user (see auth.js), so the ownership
 * check below can only ever pass for 'demo-user'. It is kept because it is the
 * single place that decides who may write to whose document, and that decision
 * should not have to be reinvented if identity ever comes back.
 */
import express from 'express';
import {
  getUserDoc,
  getSettingsDoc,
  upsertSettings,
  upsertUser,
  deleteAllUserData,
} from '../store.js';
import {
  ALLOWED_SETTINGS_FIELDS,
  sanitiseSettings,
} from '../schema.js';
import { DEFAULT_USER_SETTINGS } from '../../../shared/demoData.js';

const router = express.Router();

/** Builds the shape the client expects, filling defaults for anything unset. */
function withDefaults(settings = {}) {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...settings,
    // demoMode can never be turned off: this app never moves money.
    demoMode: true,
  };
}

/**
 * Decides whether the caller may WRITE this user's settings.
 *
 * Three cases, in order:
 *   1. Not signed in (the normal case) -> only the local demo account, so a
 *      caller cannot reach into a document that is not its own.
 *   2. Signed in, editing their own document -> allowed.
 *   3. Signed in, editing someone else's -> allowed ONLY if that person has
 *      listed this helper. This is the whole security model of Family Helper
 *      Mode: consent is recorded on the target's own document, not assumed.
 */
async function canWriteSettings(req, userId) {
  const auth = req.auth || {};

  if (auth.anonymous) {
    return userId === auth.uid;
  }

  if (userId === auth.uid) return true;

  const target = await getUserDoc(userId);
  const helpers = target.exists && Array.isArray(target.data?.helpers) ? target.data.helpers : [];
  return helpers.includes(auth.uid);
}

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ ok: false, error: 'settings.error.missingUserId' });

  try {
    const [user, settings] = await Promise.all([
      getUserDoc(userId),
      getSettingsDoc(userId),
    ]);
    // settings/{uid} wins for helper-applied preferences, users/{uid} holds
    // identity-level data. Merge both so a partial write never loses fields.
    const merged = { ...(user.exists ? user.data : null), ...(settings.exists ? settings.data : null) };

    return res.json({
      ok: true,
      userId,
      settings: withDefaults(merged),
      updatedAt: merged.updatedAt ?? null,
      // Tells the client whether to keep using local cache.
      source: user.exists || settings.exists ? 'store' : 'defaults',
    });
  } catch (err) {
    console.error('[settings GET]', err);
    return res.status(500).json({ ok: false, error: 'settings.error.internal' });
  }
});

router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { settings } = req.body || {};

  if (!userId) return res.status(400).json({ ok: false, error: 'settings.error.missingUserId' });
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ ok: false, error: 'settings.error.invalidBody' });
  }

  // Reject anything not on the allow-list BEFORE it reaches the store.
  const rejected = Object.keys(settings).filter((k) => !ALLOWED_SETTINGS_FIELDS.includes(k));
  const clean = sanitiseSettings(settings);
  const now = new Date().toISOString();

  try {
    if (!(await canWriteSettings(req, userId))) {
      return res.status(403).json({ ok: false, error: 'settings.error.forbidden' });
    }

    await upsertSettings(userId, {
      ...clean,
      // Record who made the change, for the family helper audit trail.
      updatedBy: req.auth?.email || req.auth?.uid || 'anonymous',
      updatedAt: now,
    });

    return res.json({
      ok: true,
      userId,
      settings: withDefaults(clean),
      updatedAt: now,
      ...(rejected.length ? { ignoredFields: rejected } : {}),
    });
  } catch (err) {
    console.error('[settings PUT]', err);
    return res.status(500).json({ ok: false, error: 'settings.error.internal' });
  }
});

/**
 * PUT /api/settings/:userId/helpers
 * ---------------------------------------------------------------------------
 * Consent. The person whose phone it is decides which relatives may change
 * their settings; the relative cannot add themselves. Removing yourself from
 * the list revokes access on the next request.
 */
router.put('/:userId/helpers', async (req, res) => {
  const { userId } = req.params;
  const { helperUid, remove = false } = req.body || {};

  if (!userId) return res.status(400).json({ ok: false, error: 'settings.error.missingUserId' });

  const auth = req.auth || {};

  // Only the owner of a document may change its helper list. A helper adding
  // another helper (or themselves) is exactly the escalation we must not allow.
  const isOwner = auth.anonymous ? userId === auth.uid : userId === auth.uid;
  if (!isOwner) {
    return res.status(403).json({ ok: false, error: 'settings.error.forbidden' });
  }

  if (!helperUid) {
    return res.status(400).json({ ok: false, error: 'settings.error.invalidBody' });
  }

  try {
    const doc = await getUserDoc(userId);
    const helpers = new Set(doc.exists && Array.isArray(doc.data?.helpers) ? doc.data.helpers : []);
    if (remove) helpers.delete(helperUid);
    else helpers.add(helperUid);

    const next = [...helpers];
    await upsertUser(userId, { helpers: next });

    return res.json({ ok: true, userId, helpers: next });
  } catch (err) {
    console.error('[settings helpers PUT]', err);
    return res.status(500).json({ ok: false, error: 'settings.error.internal' });
  }
});

/**
 * DELETE /api/settings/:userId
 * ---------------------------------------------------------------------------
 * Deletes everything stored for this user: preferences, progress, identity, and
 * the whole activity history. This is the server half of "delete my data" - if
 * the app stores anything at all, the user has to be able to take it back, and
 * a client-side clear alone would leave the database copy behind.
 *
 * Scoped by the same ownership check as a write, so a caller cannot erase a
 * document that is not its own.
 */
router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ ok: false, error: 'settings.error.missingUserId' });

  try {
    if (!(await canWriteSettings(req, userId))) {
      return res.status(403).json({ ok: false, error: 'settings.error.forbidden' });
    }

    await deleteAllUserData(userId);
    return res.json({ ok: true, userId, deleted: true });
  } catch (err) {
    console.error('[settings DELETE]', err);
    return res.status(500).json({ ok: false, error: 'settings.error.internal' });
  }
});

export default router;