/**
 * ============================================================================
 * Progress context - lessons and practice scores
 * ============================================================================
 *
 * Local-first, exactly like settings. Progress is written to localStorage
 * immediately and pushed to the server when reachable, so finishing a lesson
 * while offline still shows a tick mark next time.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProgress, completeLesson, submitPracticeAnswer } from '../lib/api.js';
import { KEYS, read, write, isOnline } from '../lib/storage.js';
import { LESSONS, PRACTICE_MESSAGES } from '@shared/demoData.js';

const ProgressContext = createContext(null);

const EMPTY = {
  completedLessons: [],
  practice: { total: 0, correct: 0, byMessage: {} },
  lastSeenAt: null,
};

export function ProgressProvider({ userId, children }) {
  const [progress, setProgress] = useState(() => ({ ...EMPTY, ...(read(KEYS.progress) || {}) }));
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);

  const persist = useCallback((next) => {
    write(KEYS.progress, next);
    setProgress(next);
  }, []);

  /* --- Load from the server once ---------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOnline()) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchProgress(userId);
        if (cancelled || !data?.progress) return;
        // Merge: local wins for anything the user just did offline.
        const merged = {
          ...data.progress,
          completedLessons: Array.from(
            new Set([...(data.progress.completedLessons || []), ...(progress.completedLessons || [])])
          ),
        };
        persist(merged);
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

  /* --- Actions ------------------------------------------------------------ */
  const markLessonComplete = useCallback(
    async (lessonId) => {
      setProgress((current) => {
        const next = {
          ...current,
          completedLessons: Array.from(new Set([...(current.completedLessons || []), lessonId])),
          lastSeenAt: new Date().toISOString(),
        };
        write(KEYS.progress, next);
        // Fire and forget; the local tick is already there.
        completeLesson(userId, lessonId).catch(() => {});
        return next;
      });
    },
    [userId]
  );

  /**
   * Records a "safe" or "fraud" answer in the practice game.
   * Returns { correct, correctChoice, explanationKey } immediately - the user
   * must not wait for a network round trip to see feedback.
   */
  const answerPractice = useCallback(
    async (messageId, choice) => {
      const message = PRACTICE_MESSAGES.find((m) => m.id === messageId);
      const correctChoice = message?.isFraud ? 'fraud' : 'safe';

      setProgress((current) => {
        const byMessage = { ...(current.practice?.byMessage || {}), [messageId]: choice };
        const total = Object.keys(byMessage).length;
        // Score each stored answer against ITS OWN ground truth. Comparing all
        // of them to this one message's answer would make the score collapse
        // the moment the user saw a mix of safe and fraud messages.
        const correct = Object.entries(byMessage).reduce((count, [id, c]) => {
          const expected = PRACTICE_MESSAGES.find((m) => m.id === id)?.isFraud ? 'fraud' : 'safe';
          return c === expected ? count + 1 : count;
        }, 0);
        const next = {
          ...current,
          practice: { total, correct, byMessage },
          lastSeenAt: new Date().toISOString(),
        };
        write(KEYS.progress, next);
        submitPracticeAnswer(userId, messageId, choice).catch(() => {});
        return next;
      });

      return {
        correct: choice === correctChoice,
        correctChoice,
        explanationKey: message?.correctKey,
      };
    },
    [userId]
  );

  const resetProgress = useCallback(() => {
    persist({ ...EMPTY, lastSeenAt: new Date().toISOString() });
  }, [persist]);

  /* --- Derived ------------------------------------------------------------ */
  // Memoised separately: deriving a new array/object on every render would
  // make the context value (and everything consuming it) churn needlessly.
  const completedLessons = useMemo(
    () => progress.completedLessons || [],
    [progress.completedLessons]
  );
  const practice = useMemo(
    () => progress.practice || { total: 0, correct: 0, byMessage: {} },
    [progress.practice]
  );

  const value = useMemo(
    () => ({
      progress,
      loading,
      syncError,
      lessons: LESSONS,
      practiceMessages: PRACTICE_MESSAGES,
      completedLessons,
      isLessonComplete: (id) => completedLessons.includes(id),
      lessonCount: LESSONS.length,
      completedCount: completedLessons.length,
      practiceTotal: practice.total,
      practiceCorrect: practice.correct,
      practiceAnswered: practice.byMessage || {},
      allLessonsDone: completedLessons.length >= LESSONS.length,
      allPracticeDone: Object.keys(practice.byMessage || {}).length >= PRACTICE_MESSAGES.length,
      markLessonComplete,
      answerPractice,
      resetProgress,
    }),
    [progress, loading, syncError, completedLessons, practice, markLessonComplete, answerPractice, resetProgress]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>');
  return ctx;
}
