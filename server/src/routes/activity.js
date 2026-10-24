/**
 * GET    /api/activity/:userId            -> a user's recent activity
 * POST   /api/activity/:userId            -> record one thing a feature did
 * DELETE /api/activity/:userId/:id        -> remove one entry
 * DELETE /api/activity/:userId            -> clear the user's history
 * GET    /api/activity/:userId/summary    -> counts per kind
 * ---------------------------------------------------------------------------
 * This is the "save what the features did" endpoint. The Safety Checker, the
 * Transaction Explainer, Send Money, and Learn all POST here after they finish,
 * and the History screen GETs from here.
 *
 * WHAT IS DELIBERATELY NOT ACCEPTED
 *   There is no field for the message the user pasted, and there must never be
 *   one. A pasted bank SMS can contain an account number and an amount, which
 *   this app promises never to store. What is stored is the verdict and derived
 *   facts - see ACTIVITY_NOTE in schema.js, and `sanitiseActivity` which is the
 *   allow-list that enforces it. A caller that sends `text` gets it silently
 *   dropped, not stored.
 *
 * SCOPING
 *   Every query is scoped by `:userId`, which is the same id the browser uses
 *   for its localStorage documents. Like routes/settings.js, this is the one
 *   place that decides whose history is whose, so it stays even though every
 *   caller currently shares a single anonymous uid.
 */
import express from 'express';
import {
  recordActivity,
  getActivity,
  removeActivity,
  clearUserActivity,
} from '../store.js';
import { isActivityKind } from '../schema.js';

const router = express.Router();

/** Biggest page the API will return, so one request cannot pull the lot. */
const MAX_LIMIT = 200;

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const rawKind = req.query.kind;
  const kind = typeof rawKind === 'string' && rawKind ? rawKind : null;

  if (kind && !isActivityKind(kind)) {
    return res.status(400).json({ ok: false, error: 'activity.error.unknownKind' });
  }

  const limit = Math.min(Number(req.query.limit) || 50, MAX_LIMIT);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const { items, total } = await getActivity(userId, { kind, limit, offset });
    return res.json({ ok: true, userId, kind, limit, offset, total, items });
  } catch (err) {
    console.error('[activity GET]', err);
    return res.status(500).json({ ok: false, error: 'activity.error.internal' });
  }
});

router.get('/:userId/summary', async (req, res) => {
  const { userId } = req.params;
  try {
    // One tiny read per known kind. The list is short and fixed, which is
    // simpler than exposing a GROUP BY through the store for a UI badge.
    const counts = {};
    let total = 0;
    for (const kind of ['safety', 'explain', 'send', 'lesson', 'practice']) {
      const page = await getActivity(userId, { kind, limit: 1 });
      counts[kind] = page.total;
      total += page.total;
    }
    return res.json({ ok: true, userId, total, counts });
  } catch (err) {
    console.error('[activity summary]', err);
    return res.status(500).json({ ok: false, error: 'activity.error.internal' });
  }
});

router.post('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const stored = await recordActivity(userId, req.body || {});
    if (!stored) {
      return res.status(400).json({ ok: false, error: 'activity.error.invalidEntry' });
    }
    return res.status(201).json({ ok: true, userId, item: stored });
  } catch (err) {
    console.error('[activity POST]', err);
    return res.status(500).json({ ok: false, error: 'activity.error.internal' });
  }
});

router.delete('/:userId/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const removed = await removeActivity(userId, id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'activity.error.notFound' });
    }
    return res.json({ ok: true, userId, id });
  } catch (err) {
    console.error('[activity DELETE one]', err);
    return res.status(500).json({ ok: false, error: 'activity.error.internal' });
  }
});

router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;
  const rawKind = req.query.kind;
  const kind = typeof rawKind === 'string' && rawKind ? rawKind : null;

  if (kind && !isActivityKind(kind)) {
    return res.status(400).json({ ok: false, error: 'activity.error.unknownKind' });
  }

  try {
    const removed = await clearUserActivity(userId, kind);
    return res.json({ ok: true, userId, kind, removed });
  } catch (err) {
    console.error('[activity DELETE all]', err);
    return res.status(500).json({ ok: false, error: 'activity.error.internal' });
  }
});

export default router;
