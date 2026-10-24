/**
 * GET  /api/progress/:userId                  -> lesson + practice progress
 * PUT  /api/progress/:userId                  -> mark a lesson complete
 * POST /api/progress/:userId/practice         -> record a "safe / fraud" answer
 * ---------------------------------------------------------------------------
 * Powers Learn / Practice mode. Only stores WHICH practice messages the user
 * has answered and whether they were right. No message content, no money.
 */
import express from 'express';
import { getProgressDoc, upsertProgress } from '../store.js';
import { defaultProgress, mergePracticeResult } from '../schema.js';
import { LESSONS, PRACTICE_MESSAGES } from '../../../shared/demoData.js';

const router = express.Router();

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const doc = await getProgressDoc(userId);
    const progress = doc.exists ? doc.data : defaultProgress();
    return res.json({
      ok: true,
      userId,
      progress,
      lessons: LESSONS.map((l) => ({
        id: l.id,
        order: l.order,
        titleKey: l.titleKey,
        title: l.title,
        minutes: l.minutes,
        stepCount: l.steps.length,
      })),
      practice: {
        totalMessages: PRACTICE_MESSAGES.length,
        // Never leak the answer key to the client before the user has answered.
        remaining: PRACTICE_MESSAGES.length - (progress.practice?.total ?? 0),
      },
    });
  } catch (err) {
    console.error('[progress GET]', err);
    return res.status(500).json({ ok: false, error: 'progress.error.internal' });
  }
});

router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { completedLessonId } = req.body || {};

  if (!completedLessonId) {
    return res.status(400).json({ ok: false, error: 'progress.error.missingLesson' });
  }
  if (!LESSONS.some((l) => l.id === completedLessonId)) {
    return res.status(400).json({ ok: false, error: 'progress.error.unknownLesson' });
  }

  try {
    const doc = await getProgressDoc(userId);
    const progress = doc.exists ? doc.data : defaultProgress();
    const completed = new Set(progress.completedLessons || []);
    completed.add(completedLessonId);

    const next = {
      ...progress,
      completedLessons: [...completed],
      lastSeenAt: new Date().toISOString(),
    };
    await upsertProgress(userId, next);
    return res.json({ ok: true, userId, progress: next });
  } catch (err) {
    console.error('[progress PUT]', err);
    return res.status(500).json({ ok: false, error: 'progress.error.internal' });
  }
});

router.post('/:userId/practice', async (req, res) => {
  const { userId } = req.params;
  const { messageId, choice } = req.body || {};

  const message = PRACTICE_MESSAGES.find((m) => m.id === messageId);
  if (!message) {
    return res.status(404).json({ ok: false, error: 'progress.error.unknownMessage' });
  }
  if (choice !== 'safe' && choice !== 'fraud') {
    return res.status(400).json({ ok: false, error: 'progress.error.invalidChoice' });
  }

  try {
    const doc = await getProgressDoc(userId);
    const existing = doc.exists ? doc.data : defaultProgress();
    const next = mergePracticeResult(existing, {
      messageId,
      choice,
      correctChoice: message.isFraud ? 'fraud' : 'safe',
      // Ground truth for EVERY practice message, so the stored score can be
      // recomputed from the answers alone.
      correctChoiceById: Object.fromEntries(
        PRACTICE_MESSAGES.map((m) => [m.id, m.isFraud ? 'fraud' : 'safe'])
      ),
    });
    await upsertProgress(userId, next);

    const wasCorrect = choice === (message.isFraud ? 'fraud' : 'safe');
    return res.json({
      ok: true,
      userId,
      progress: next,
      // Immediate feedback for the practice game.
      correct: wasCorrect,
      correctChoice: message.isFraud ? 'fraud' : 'safe',
      explanationKey: message.correctKey,
    });
  } catch (err) {
    console.error('[progress practice]', err);
    return res.status(500).json({ ok: false, error: 'progress.error.internal' });
  }
});

export default router;
