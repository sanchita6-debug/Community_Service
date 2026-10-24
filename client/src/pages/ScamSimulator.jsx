/**
 * ============================================================================
 * Practice game - "Is this safe or fraud?"
 * ============================================================================
 *
 * One message, two enormous buttons, immediate honest feedback.
 *
 * Design decisions worth stating:
 *   - The two answers are ALWAYS "Safe" and "Fraud". A third "Not sure" option
 *     would let someone pass the whole set without learning anything.
 *   - Feedback appears before the next button, and explains WHY, so a wrong
 *     answer teaches rather than just scoring.
 *   - Green and red only AFTER answering. Before answering, both buttons are
 *     identical, because colour-coding them would give the game away.
 *   - Progress is remembered, so a person can stop halfway and come back.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useProgress } from '../context/ProgressContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { detectTextLang } from '../i18n/index.js';
import BigButton, { NextButton } from '../components/BigButton.jsx';
import SpeakerButton from '../components/SpeakerButton.jsx';
import { Card, PageHeader, VerdictBadge } from '../components/ui.jsx';
import {
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ArrowRightIcon,
  SparkIcon,
} from '../components/icons.jsx';

export default function ScamSimulator() {
  const { t, language } = useSettings();
  const { speak, isSpeaking, ttsSupported } = useSpeech();
  const {
    practiceMessages,
    answerPractice,
    practiceAnswered,
    practiceCorrect,
    resetProgress,
  } = useProgress();
  const { record } = useActivity();
  const reduceMotion = useReducedMotion();

  // An order the user has not judged yet; once they are all done we start over
  // from the beginning rather than showing an empty screen.
  const remaining = useMemo(
    () => practiceMessages.filter((m) => !(m.id in (practiceAnswered || {}))),
    [practiceMessages, practiceAnswered]
  );

  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null); // { correct, correctChoice, explanationKey }
  const [picked, setPicked] = useState(null); // 'safe' | 'fraud'

  const queue = remaining.length > 0 ? remaining : practiceMessages;
  const current = queue[index % queue.length];

  useEffect(() => {
    if (index > 0 && index % queue.length === 0) setIndex(0);
  }, [index, queue.length]);

  // Read the message aloud when it appears. The practice SMS are written in
  // English, so an English voice reads them even when the UI is in Tamil - a
  // Tamil voice mangling Latin script helps nobody.
  const messageText = current?.text || '';
  const messageLang = detectTextLang(messageText, language);
  useSpeakOnMount(messageText, { id: `sim-${current?.id}-${index}`, lang: messageLang });

  function choose(choice) {
    if (result) return;
    setPicked(choice);
    const outcome = answerPractice(current.id, choice);
    setResult(outcome);

    // Save the outcome for the History screen. Only whether the user got it
    // right and which practice message it was - never the message text.
    record(
      'practice',
      { messageId: current.id, choice, correct: outcome.correct },
      { verdict: outcome.correct ? 'correct' : 'incorrect' }
    );

    if (ttsSupported) {
      speak(
        `${outcome.correct ? t('learn.correct') : t('learn.wrong')} ${t(outcome.explanationKey)}`,
        { id: 'sim-feedback' }
      );
    }
  }

  function next() {
    setResult(null);
    setPicked(null);
    setIndex((i) => (i + 1) % queue.length);
  }

  function replay() {
    resetProgress();
    setResult(null);
    setPicked(null);
    setIndex(0);
  }

  if (!current) {
    return (
      <Card className="text-center">
        <p className="text-lg font-bold text-ink-soft">{t('common.empty')}</p>
      </Card>
    );
  }

  const finishedAll = remaining.length === 0 && !result;
  const allAnsweredCount = Object.keys(practiceAnswered || {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('learn.practiceTitle')}
        subtitle={t('learn.practiceSub')}
        icon={PlayIcon}
        speakText={`${t('learn.practiceTitle')}. ${t('learn.practiceSub')}`}
      />

      {/* Score, always visible, never a judgement. */}
      <Card className="flex items-center justify-between gap-4 border-4 border-primary-200 bg-primary-50">
        <div className="flex items-center gap-3">
          <StarIcon className="w-9 h-9 text-warn-800" />
          <p className="tnum text-xl font-extrabold text-primary-900">
            {t('learn.scoreLabel', { correct: practiceCorrect, total: allAnsweredCount })}
          </p>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.id}-${index}`}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-5"
        >
          {/* ---- The message ---------------------------------------------- */}
          <Card className="border-4 border-ink/10">
            <p
              className="font-mono text-lg leading-relaxed text-ink sm:text-xl"
              lang="en"
            >
              {current.text}
            </p>
            {ttsSupported && (
              <div className="mt-4 flex justify-end">
                <SpeakerButton
                  text={current.text}
                  id={`sim-${current.id}-${index}`}
                  lang={messageLang}
                  size="md"
                  hint={false}
                />
              </div>
            )}
          </Card>

          {/* ---- The two answers ------------------------------------------ */}
          {!result ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <BigButton
                size="block"
                variant="ok"
                icon={CheckCircleIcon}
                onClick={() => choose('safe')}
                className="text-2xl"
              >
                {t('learn.answerSafe')}
              </BigButton>
              <BigButton
                size="block"
                variant="danger"
                icon={XCircleIcon}
                onClick={() => choose('fraud')}
                className="text-2xl"
              >
                {t('learn.answerFraud')}
              </BigButton>
            </div>
          ) : (
            <Feedback result={result} picked={picked} isSpeaking={isSpeaking('sim-feedback')} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ---- Next / restart ------------------------------------------------ */}
      {result && (
        <div className="space-y-4">
          <NextButton onClick={next} className="w-full" icon={ArrowRightIcon} iconPosition="right">
            {finishedAll ? t('learn.restart') : t('learn.nextMessage')}
          </NextButton>

          {finishedAll && (
            <Card className="border-4 border-calm-300 bg-calm-50 text-center">
              <CheckCircleIcon className="mx-auto w-14 h-14 text-calm-800" />
              <p className="mt-3 text-xl font-extrabold text-calm-900">{t('learn.allDone')}</p>
              <div className="mt-5 flex justify-center">
                <BigButton variant="secondary" onClick={replay} icon={SparkIcon}>
                  {t('learn.restart')}
                </BigButton>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Immediate, non-judgemental feedback. The explanation is always shown - a
 * wrong answer is the moment the person most needs to hear why.
 */
function Feedback({ result, picked, isSpeaking }) {
  const { t } = useSettings();
  const { ttsSupported } = useSpeech();
  const explanation = result.explanationKey ? t(result.explanationKey) : '';
  const verdict = result.correct ? 'green' : 'red';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card
        className={
          result.correct
            ? 'border-4 border-calm-500 bg-calm-50'
            : 'border-4 border-danger-500 bg-danger-50'
        }
      >
        <div className="space-y-4 text-center">
          <VerdictBadge
            verdict={verdict}
            label={result.correct ? t('learn.correct') : t('learn.wrong')}
            size="md"
            speaking={isSpeaking}
          />

          {/* What they said vs what was right. Never just a tick or a cross. */}
          <dl className="space-y-2 text-left">
            <div className="flex items-baseline gap-2">
              <dt className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t('learn.yourAnswer')}
              </dt>
              <dd className="text-lg font-extrabold text-ink">
                {picked === 'fraud' ? t('learn.answerFraud') : t('learn.answerSafe')}
              </dd>
            </div>
            {!result.correct && (
              <div className="flex items-baseline gap-2">
                <dt className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                  {t('learn.correctAnswer')}
                </dt>
                <dd className="text-lg font-extrabold text-ink">
                  {result.correctChoice === 'fraud' ? t('learn.answerFraud') : t('learn.answerSafe')}
                </dd>
              </div>
            )}
          </dl>

          {explanation && (
            <p className="rounded-card border-2 border-ink/10 bg-surface p-4 text-left text-lg leading-relaxed text-ink">
              {explanation}
            </p>
          )}

          {ttsSupported && (
            <div className="flex justify-center">
              <SpeakerButton
                text={`${result.correct ? t('learn.correct') : t('learn.wrong')} ${explanation}`}
                id="sim-feedback"
                size="md"
                hint={false}
              />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
