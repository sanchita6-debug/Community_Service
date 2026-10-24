/**
 * ============================================================================
 * Lesson player
 * ============================================================================
 *
 * One idea per card, one card per screen, spoken automatically, with a quiz at
 * the end. The flow is strictly forward: Next is always the biggest, brightest
 * control, and there is no way to get stuck in a state with no way out.
 *
 * The quiz gives immediate, non-judgemental feedback. A wrong answer shows the
 * right one AND why - it never just says "wrong".
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useProgress } from '../context/ProgressContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import BigButton, { NextButton } from '../components/BigButton.jsx';
import SpeakerButton from '../components/SpeakerButton.jsx';
import { Card, StepDots, VerdictBadge } from '../components/ui.jsx';
import {
  BookIcon,
  CheckCircleIcon,
  SparkIcon,
  ArrowLeftIcon,
  FACT_ICONS,
} from '../components/icons.jsx';

export default function LessonPlayer() {
  const { lessonId } = useParams();
  const { t } = useSettings();
  const { speak, ttsSupported } = useSpeech();
  const { lessons, markLessonComplete, isLessonComplete } = useProgress();
  const { record } = useActivity();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const lesson = useMemo(() => lessons.find((l) => l.id === lessonId), [lessons, lessonId]);

  // page = 0..steps.length-1 for the teaching cards, then a final "quiz" page.
  const [page, setPage] = useState(0);
  const [answer, setAnswer] = useState(null); // null | 'right' | 'wrong'
  const [chosen, setChosen] = useState(null);

  // Reset if the user navigates between lessons without unmounting.
  useEffect(() => {
    setPage(0);
    setAnswer(null);
    setChosen(null);
  }, [lessonId]);

  const isQuiz = lesson ? page >= lesson.steps.length : false;
  const total = lesson ? lesson.steps.length + 1 : 0;
  const title = lesson ? t(lesson.titleKey) : '';
  const stepText =
    lesson && lesson.steps.length > 0
      ? t(lesson.steps[Math.min(page, lesson.steps.length - 1)].key)
      : '';
  const quizQuestion = lesson ? t(lesson.quiz.questionKey) : '';

  // Speak whichever card is showing. This hook must sit ABOVE the early return
  // below, or React will call a different number of hooks when a bad lesson id
  // is typed into the URL.
  useSpeakOnMount(
    lesson ? (isQuiz ? `${title}. ${quizQuestion}` : `${title}. ${stepText}`) : '',
    { id: `lesson-${lesson?.id || 'none'}-${page}` }
  );

  if (!lesson) {
    return (
      <Card className="text-center">
        <p className="text-lg font-bold text-ink-soft">{t('common.empty')}</p>
        <div className="mt-5 flex justify-center">
          <BigButton to="/learn" variant="secondary">
            {t('learn.backToLearn')}
          </BigButton>
        </div>
      </Card>
    );
  }

  function choose(index) {
    if (answer) return; // locked after the first tap
    const option = lesson.quiz.options[index];
    setChosen(index);
    setAnswer(option.isCorrect ? 'right' : 'wrong');
    if (ttsSupported) {
      speak(
        option.isCorrect
          ? `${t('learn.correct')} ${t(option.key)}`
          : `${t('learn.wrong')} ${t(lesson.quiz.options.findIndex((o) => o.isCorrect) >= 0 ? lesson.quiz.options[lesson.quiz.options.findIndex((o) => o.isCorrect)].key : '')}`,
        { id: 'lesson-quiz-feedback' }
      );
    }
  }

  function next() {
    if (isQuiz && answer === 'right') {
      // Mark complete only on a correct answer. Replaying a lesson to get it
      // right is fine and encouraged.
      markLessonComplete(lesson.id);
      // Save it for the History screen. The lesson id and title are enough -
      // this is a learning record, not a transcript.
      record('lesson', { lessonId: lesson.id, title: lesson.title }, { verdict: 'completed' });
      navigate('/learn');
      return;
    }
    setPage((p) => Math.min(p + 1, total - 1));
    setAnswer(null);
    setChosen(null);
  }

  return (
    <div className="space-y-6">
      <StepDots steps={[...lesson.steps.map(() => title), quizQuestion]} current={page} />

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {isQuiz ? (
            <QuizCard
              lesson={lesson}
              answer={answer}
              chosen={chosen}
              onChoose={choose}
            />
          ) : (
            <StepCard lesson={lesson} page={page} title={title} text={stepText} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ---- Navigation ---------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {page > 0 && (
          <BigButton
            variant="secondary"
            size="block"
            icon={ArrowLeftIcon}
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
              setAnswer(null);
              setChosen(null);
            }}
          >
            {t('common.back')}
          </BigButton>
        )}

        <div className="flex-1">
          {isQuiz && !answer ? (
            // No Next until they have answered. Guessing through is not
            // learning.
            <BigButton size="block" disabled>
              {t('common.next')}
            </BigButton>
          ) : isQuiz && answer === 'wrong' ? (
            <NextButton onClick={next} className="w-full">
              {t('common.next')}
            </NextButton>
          ) : isQuiz ? (
            <BigButton size="block" variant="ok" icon={CheckCircleIcon} onClick={next}>
              {t('common.done')}
            </BigButton>
          ) : (
            <NextButton onClick={next} className="w-full">
              {t('common.next')}
            </NextButton>
          )}
        </div>
      </div>

      {isLessonComplete(lesson.id) && (
        <p className="text-center text-base font-bold text-calm-800">
          ✓ {t('learn.doneBadge')}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** One teaching card: a big icon, one sentence, a speaker. */
function StepCard({ lesson, page, title, text }) {
  const { ttsSupported } = useSpeech();
  const step = lesson.steps[page];
  const Icon = FACT_ICONS[step.icon] || BookIcon;

  return (
    <Card className="min-h-[18rem]">
      <div className="flex flex-col items-center gap-6 text-center">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="flex h-32 w-32 items-center justify-center rounded-card bg-primary-100 text-primary-800"
          aria-hidden="true"
        >
          <Icon className="w-20 h-20" />
        </motion.span>

        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-ink">{title}</h1>
          <p className="mt-4 text-2xl leading-relaxed text-ink sm:text-3xl">{text}</p>
        </div>

        {ttsSupported && (
          <SpeakerButton text={`${title}. ${text}`} id={`lesson-${lesson.id}-${page}`} size="lg" hint={false} />
        )}
      </div>
    </Card>
  );
}

/** The quiz: pick an answer, get kind feedback either way. */
function QuizCard({ lesson, answer, chosen, onChoose }) {
  const { t } = useSettings();
  const { ttsSupported } = useSpeech();
  const question = t(lesson.quiz.questionKey);
  const correctIndex = lesson.quiz.options.findIndex((o) => o.isCorrect);

  return (
    <Card>
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-card bg-warn-100 text-warn-800"
          aria-hidden="true"
        >
          <SparkIcon className="w-11 h-11" />
        </span>
        <h2 className="text-2xl font-extrabold leading-snug text-ink">{question}</h2>
        {ttsSupported && (
          <SpeakerButton text={question} id="lesson-quiz-question" size="md" hint={false} />
        )}
      </div>

      <ul className="mt-6 space-y-3">
        {lesson.quiz.options.map((option, index) => {
          const isCorrect = index === correctIndex;
          const isChosen = index === chosen;

          // Before answering, no colour coding at all - it would give the
          // answer away to anyone who can see colour.
          let style = 'border-primary-300 bg-surface text-ink hover:border-primary-600';
          if (answer) {
            if (isCorrect) style = 'border-calm-600 bg-calm-50 text-calm-900';
            else if (isChosen) style = 'border-danger-500 bg-danger-50 text-danger-900';
            // The unchosen option stays de-emphasised by its BORDER and a
            // lighter ink, not by fading the whole button: `opacity-70` put
            // the text at 2.7:1 against white, which is unreadable for the
            // people this app is built for.
            else style = 'border-primary-100 bg-surface text-ink-soft';
          }

          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => onChoose(index)}
                disabled={Boolean(answer)}
                className={`min-h-tap w-full rounded-card border-4 p-5 text-left text-lg font-bold transition ${style}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white',
                      answer ? (isCorrect ? 'bg-calm-600' : isChosen ? 'bg-danger-600' : 'bg-ink-muted') : 'bg-primary-600',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {answer ? (isCorrect ? '✓' : isChosen ? '✕' : '') : String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 flex-1">{t(option.key)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Feedback. Deliberately gentle - shame teaches nothing. */}
      {answer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <VerdictBadge
            verdict={answer === 'right' ? 'green' : 'yellow'}
            label={answer === 'right' ? t('learn.correct') : t('learn.wrong')}
            size="md"
          />
          {answer === 'wrong' && (
            <p className="mt-4 rounded-card border-2 border-calm-300 bg-calm-50 p-4 text-lg font-semibold text-calm-900">
              <strong className="font-extrabold">{t('learn.correctAnswer')}:</strong>{' '}
              {t(lesson.quiz.options[correctIndex].key)}
            </p>
          )}
        </motion.div>
      )}
    </Card>
  );
}
