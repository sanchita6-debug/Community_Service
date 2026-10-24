/**
 * ============================================================================
 * Scam Checker ("Is this safe?")
 * ============================================================================
 *
 * Three ways in - type, paste, photograph - and one way out: a GREEN, YELLOW,
 * or RED answer, read aloud, with the reason and the next action in plain
 * words.
 *
 * COLOUR DISCIPLINE
 * Red is used for exactly one thing in this whole app: a likely fraud message.
 * "Be careful" is amber, "looks safe" is green. If red ever meant anything
 * else, the people this app is for would stop trusting it.
 *
 * TRANSPARENCY
 * The result screen shows the exact words that triggered the verdict and links
 * to the full rule book. A safety tool that will not explain itself is just
 * another thing to be suspicious of.
 *
 * PRIVACY
 * Text is sent to our own server to be checked, and falls back to a check
 * running entirely in the browser if that fails. Photos are read on-device
 * with Tesseract.js and are never uploaded - there is no upload path to send
 * them to.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { checkMessageSafety, fetchScamRules } from '../lib/api.js';
import { recogniseText, downscaleImage, disposeOcr } from '../lib/ocr.js';
import { createTranslator, detectTextLang } from '../i18n/index.js';
import { SAMPLE_SMS } from '@shared/demoData.js';
import BigButton from '../components/BigButton.jsx';
import { SpeakSection } from '../components/SpeakerButton.jsx';
import {
  Card,
  PageHeader,
  VerdictBadge,
  VerdictPanel,
  ErrorState,
  SignalRow,
  LoadingState,
} from '../components/ui.jsx';
import {
  ShieldIcon,
  CameraIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  LockIcon,
  HelpIcon,
  SearchIcon,
} from '../components/icons.jsx';

export default function SafetyChecker() {
  const { t, language } = useSettings();
  const { record } = useActivity();
  const reduceMotion = useReducedMotion();

  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [ocrStatus, setOcrStatus] = useState('idle'); // idle | working | done | error
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrNote, setOcrNote] = useState('');
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);

  // Release the OCR worker when leaving the screen - it is ~50MB of WASM.
  useEffect(() => () => { disposeOcr(); }, []);

  const runCheck = useCallback(
    async (input) => {
      const value = (input ?? text).trim();
      if (!value) {
        setError(t('safety.error.empty'));
        setStatus('error');
        return;
      }
      setStatus('checking');
      setError(null);
      try {
        const data = await checkMessageSafety(value);
        if (data.ok) {
          setResult(data);
          setStatus('done');
          // Save what the check DECIDED, not the message it was run on. The
          // pasted text stops here - see lib/activity.js for why.
          record('safety', data, { verdict: data.verdict, score: data.score });
        } else {
          setError(data.error || t('safety.error.empty'));
          setStatus('error');
        }
      } catch (err) {
        setError(err.message || t('safety.error.internal'));
        setStatus('error');
      }
    },
    [text, t, record]
  );

  // Once a result is on screen, move focus to it. Without this, a screen-reader
  // user has no idea anything happened after pressing the button.
  useEffect(() => {
    if (status === 'done' && resultRef.current) {
      resultRef.current.focus();
      resultRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [status, reduceMotion]);

  async function handleFile(file) {
    if (!file) return;
    setOcrStatus('working');
    setOcrProgress(0);
    setOcrNote(t('safety.ocrWorking'));
    try {
      // Shrink first: a 12MP screenshot will either be slow or crash the tab
      // on a low-end Android, which is the common device here.
      const { blob } = await downscaleImage(file, 1600);
      const outcome = await recogniseText(blob, {
        lang: language,
        onProgress: (p) => setOcrProgress(Math.round(p * 100)),
      });

      if (outcome.ok && outcome.text) {
        setText(outcome.text);
        setOcrStatus('done');
        setOcrNote('');
        // Check it straight away - nobody wants to press a second button.
        runCheck(outcome.text);
      } else {
        setOcrStatus('error');
        setOcrNote(
          outcome.status === 'empty' ? t('safety.ocrNoText') : t('safety.ocrFailed')
        );
      }
    } catch (err) {
      setOcrStatus('error');
      setOcrNote(t('safety.ocrFailed'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleClear() {
    setText('');
    setResult(null);
    setStatus('idle');
    setError(null);
    setOcrStatus('idle');
    setOcrNote('');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('safety.title')}
        subtitle={t('safety.subtitle')}
        icon={ShieldIcon}
        speakText={`${t('safety.title')}. ${t('safety.subtitle')}`}
      />

      {/* Never ask for these three, anywhere. */}
      <Card className="border-4 border-danger-300 bg-danger-50">
        <h2 className="mb-3 flex items-center gap-3 text-lg font-extrabold text-danger-900">
          <LockIcon className="w-7 h-7" />
          {t('safety.neverAskTitle')}
        </h2>
        <ul className="space-y-2">
          {[t('safety.neverAskOtp'), t('safety.neverAskPin'), t('safety.neverAskCard')].map((item) => (
            <li key={item} className="flex items-start gap-3 text-base font-bold text-danger-900">
              <span aria-hidden="true" className="mt-1 text-danger-800">✕</span>
              {item}
            </li>
          ))}
        </ul>
      </Card>

      {/* ---- Input --------------------------------------------------------- */}
      <Card>
        <label htmlFor="safety-text" className="mb-2 block text-lg font-extrabold text-ink">
          {t('safety.inputLabel')}
        </label>

        <textarea
          id="safety-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          placeholder={t('safety.inputPlaceholder')}
          rows={6}
          className="field resize-y font-normal"
        />

        {/* Photo input. Always offered, but the typed box is never disabled by
            it, so a broken camera is a small inconvenience rather than a
            dead end. */}
        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
            id="safety-photo"
          />
          <BigButton
            variant="secondary"
            size="block"
            icon={CameraIcon}
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrStatus === 'working'}
            loading={ocrStatus === 'working'}
          >
            {ocrStatus === 'working' ? `${t('safety.ocrWorking')} ${ocrProgress}%` : t('safety.photoButton')}
          </BigButton>
          <p className="mt-2 text-sm font-semibold text-ink-muted">{t('safety.photoHint')}</p>
          {ocrNote && (
            <p className="mt-2 text-base font-bold text-warn-800" role="status" aria-live="polite">
              {ocrNote}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row">
          <BigButton
            size="block"
            icon={SearchIcon}
            onClick={() => runCheck()}
            loading={status === 'checking'}
            disabled={!text.trim()}
          >
            {t('safety.checkButton')}
          </BigButton>
          {text && (
            <BigButton variant="ghost" size="block" onClick={handleClear}>
              {t('safety.clear')}
            </BigButton>
          )}
        </div>
      </Card>

      {/* ---- Samples ------------------------------------------------------- */}
      <SampleMessages onPick={(sample) => { setText(sample); runCheck(sample); }} />

      {/* ---- Result -------------------------------------------------------- */}
      {status === 'checking' && <LoadingState message={t('common.loading')} rows={2} />}

      {status === 'error' && error && (
        <ErrorState title={t('common.error')} message={error} onRetry={() => runCheck()} />
      )}

      {status === 'done' && result && (
        <SafetyResult result={result} resultRef={resultRef} />
      )}

      {/* Never a blank screen: if nothing has been checked yet, say what to do. */}
      {status === 'idle' && !result && (
        <Card className="text-center">
          <HelpIcon className="mx-auto w-14 h-14 text-ink-muted" />
          <p className="mt-3 text-lg font-bold text-ink-soft">{t('verdict.empty')}</p>
        </Card>
      )}

      <RulesExplainer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The verdict                                                                 */
/* -------------------------------------------------------------------------- */

function SafetyResult({ result, resultRef }) {
  // `uiT` is the app's own language. It keeps the controls and status lines
  // (the region name, the speaker button, the offline note) readable however
  // the message itself is written.
  const { t: uiT, language } = useSettings();
  const { speakSequence, isSpeaking, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();

  const checkedText = (result.checkedText || '').trim();

  // THE ANSWER FOLLOWS THE MESSAGE, NOT THE APP.
  // A checked message can be in any of the five languages. The verdict, the
  // reasons and the next action are shown - and spoken - in the language the
  // message itself is written in, so the answer always matches the thing the
  // person is holding. Pasting a Tamil bank SMS on a Hindi phone must not
  // answer in Hindi. Missing translations still fall back to English inside
  // createTranslator, so this can never render a raw key or a blank line.
  const resultLang = detectTextLang(checkedText, language);
  const t = useMemo(() => createTranslator(resultLang), [resultLang]);

  const verdict = result.verdict;
  const shortLabel = t(`verdict.${verdict}Short`);
  const longLabel = t(`verdict.${verdict}`);

  // Reasons and actions come from the rule objects as translation KEYS, never
  // as the English sentences in `result.reasons` / `result.recommendedActions`.
  // The engine ships both, and picking the English one meant a Tamil or Telugu
  // user heard the verdict translated and then every reason to explain it in
  // English. A missing key falls back to English through `t()`, which is the
  // right failure mode - understandable, never blank.
  const matched = result.matchedRules || [];
  const reasonText = matched.map((r) => t(r.explanationKey));
  const actionText = matched.map((r) => t(r.safeActionKey)).slice(0, 2);

  const answer = [
    longLabel,
    ...reasonText,
    ...actionText,
    ...(verdict === 'red' ? [t('safetyBanner.text')] : []),
  ].join(' ');

  const speakId = 'safety-result';

  // Read in three separate utterances, not one long blob:
  //   1. the intro, so someone can hear whether the OCR captured the right
  //      thing BEFORE trusting the answer
  //   2. the message the app actually read, in the message's own voice
  //   3. the verdict, then each reason, then what to do
  // Every chunk is in the message's language, so the words and the voice
  // always agree. speakSequence runs them one at a time, so the message stops
  // at its end instead of running straight on into "this is likely fraud".
  // The red banner is included for red verdicts - it is the one instruction we
  // never want someone to reach the bottom of the screen without hearing.
  //
  // The verdict is read out automatically - this is the whole point of the
  // screen, and a red result must never depend on the user noticing colour.
  // Depends on `result`, not `verdict`: two different scam messages can both
  // come back red, and keying on the verdict left the second one silent.
  useEffect(() => {
    if (ttsSupported) {
      speakSequence(
        [
          checkedText ? { text: t('safety.checkedIntro'), lang: resultLang } : null,
          checkedText ? { text: checkedText, lang: resultLang } : null,
          { text: answer, lang: resultLang },
        ],
        { id: speakId }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const signals = result.safeSignals || [];

  return (
    <motion.div
      ref={resultRef}
      tabIndex={-1}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="scroll-mt-4 space-y-5 focus:outline-none"
      role="region"
      aria-label={uiT('safety.resultTitle')}
    >
      <VerdictPanel verdict={verdict}>
        <div className="space-y-5">
          <VerdictBadge
            verdict={verdict}
            label={shortLabel}
            size="lg"
            speaking={isSpeaking(speakId)}
          />

          {/* The full sentence, in large type. Someone who cannot rely on
              colour still gets the whole meaning. */}
          <p className="text-center text-2xl font-extrabold leading-snug text-ink">
            {longLabel}
          </p>

          {ttsSupported && (
            <div className="flex justify-center">
              {/* Replays only the answer. The message was already read once,
                  automatically - a user pressing this wants the verdict, not
                  to hear their own message again. */}
              <SpeakSection
                text={answer}
                id={speakId}
                label={uiT('safety.speakVerdict')}
                lang={resultLang}
              />
            </div>
          )}

          {result.local && (
            <p className="text-center text-sm font-semibold text-ink-muted">
              {uiT('app.offlineNotice')}
            </p>
          )}
        </div>
      </VerdictPanel>

      {/* ---- Why ---------------------------------------------------------- */}
      {matched.length > 0 && (
        <Card className={verdict === 'red' ? 'border-4 border-danger-300' : ''}>
          <h2 className="card-title mb-4">{t('safety.reasonsTitle')}</h2>
          <ul className="space-y-5">
            {matched.map((rule, index) => {
              const Icon = rule.severity === 'danger' ? XCircleIcon : AlertTriangleIcon;
              return (
                <li key={rule.id} className="flex items-start gap-4">
                  <span
                    className={[
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white',
                      rule.severity === 'danger' ? 'bg-danger-700' : 'bg-warn-600',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <Icon className="w-7 h-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-extrabold text-ink">
                      {index + 1}. {t(rule.titleKey)}
                    </h3>
                    <p className="mt-1 text-base leading-relaxed text-ink-soft">
                      {t(rule.explanationKey)}
                    </p>
                    {rule.matchedPhrases?.length > 0 && (
                      <p className="mt-2 text-sm text-ink-muted">
                        <span className="font-bold">{t('safety.phrasesFound')}:</span>{' '}
                        <span className="font-mono">{rule.matchedPhrases.slice(0, 3).join(', ')}</span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ---- What to do ---------------------------------------------------- */}
      {matched.length > 0 && (
        <Card className={verdict === 'red' ? 'border-4 border-danger-400 bg-danger-50' : 'border-4 border-warn-400 bg-warn-50'}>
          <h2 className="card-title mb-4">{t('safety.actionsTitle')}</h2>
          <ul className="space-y-3">
            {matched.map((rule, i) => (
              <li key={rule.id} className="flex items-start gap-3 text-lg font-semibold leading-relaxed text-ink">
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-base font-black"
                >
                  {i + 1}
                </span>
                {t(rule.safeActionKey)}
              </li>
            ))}
          </ul>

          {/* A red verdict gets one extra, non-negotiable instruction. */}
          {verdict === 'red' && (
            <p className="mt-5 rounded-card border-2 border-danger-300 bg-surface p-4 text-lg font-extrabold text-danger-900">
              {t('safetyBanner.text')}
            </p>
          )}
        </Card>
      )}

      {/* ---- Good signs ---------------------------------------------------- */}
      {signals.length > 0 && (
        <Card>
          <h2 className="card-title mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-7 h-7 text-calm-800" />
            {t('safety.signalsTitle')}
          </h2>
          <ul className="space-y-3">
            {signals.map((s) => (
              <SignalRow key={s.id} ok>
                {t(s.labelKey)}
              </SignalRow>
            ))}
          </ul>
        </Card>
      )}

      {verdict === 'green' && signals.length === 0 && (
        <Card>
          <p className="text-base font-semibold text-ink-soft">{t('safety.noSignals')}</p>
        </Card>
      )}

      {/* ---- What we checked ----------------------------------------------- */}
      <Card>
        <h2 className="card-title mb-3">{t('safety.howTitle') || t('explain.howTitle')}</h2>
        <div className="scroll-area">
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink-soft">
            {result.checkedText}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Samples                                                                     */
/* -------------------------------------------------------------------------- */

function SampleMessages({ onPick }) {
  const { t } = useSettings();
  return (
    <Card>
      <h2 className="card-title mb-1">{t('explain.sampleTitle')}</h2>
      <p className="mb-4 text-sm font-semibold text-ink-muted">{t('explain.sampleHint')}</p>
      <ul className="space-y-3">
        {SAMPLE_SMS.map((sample) => (
          <li key={sample.id}>
            <button
              type="button"
              onClick={() => onPick(sample.text)}
              className="min-h-touch w-full rounded-card border-2 border-primary-200 bg-surface p-4 text-left transition hover:border-primary-500"
            >
              <span className="block text-base font-extrabold text-primary-900">
                {t(sample.labelKey)}
              </span>
              <span className="mt-1 block line-clamp-2 text-sm text-ink-soft">{sample.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* The rule book                                                               */
/* -------------------------------------------------------------------------- */

function RulesExplainer() {
  const { t } = useSettings();
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchScamRules();
        if (!cancelled) setRules(data.rules);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <h2 className="card-title mb-1">{t('safety.rulesTitle')}</h2>
      <p className="mb-4 text-base text-ink-soft">{t('safety.rulesSubtitle')}</p>

      {loading && <LoadingState message={t('common.loading')} rows={2} />}

      <ul className="space-y-3">
        {(rules || []).map((rule) => (
          <li key={rule.id}>
            <button
              type="button"
              onClick={() => setOpenId(openId === rule.id ? null : rule.id)}
              aria-expanded={openId === rule.id}
              className="flex min-h-touch w-full items-center gap-4 rounded-card border-2 border-primary-200 bg-surface p-4 text-left transition hover:border-primary-400"
            >
              <span
                className={[
                  'h-4 w-4 shrink-0 rounded-full',
                  rule.severity === 'danger' ? 'bg-danger-600' : 'bg-warn-500',
                ].join(' ')}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-base font-bold text-ink">{t(rule.titleKey)}</span>
              <span className="shrink-0 text-sm font-semibold text-ink-muted" aria-hidden="true">
                {openId === rule.id ? '▲' : '▼'}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {openId === rule.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-card border-l-4 border-primary-300 bg-primary-50 p-4">
                    <p className="text-base leading-relaxed text-ink-soft">{t(rule.explanationKey)}</p>
                    <p className="mt-3 text-base font-bold text-calm-800">
                      {t('safety.actionsTitle')}: {t(rule.safeActionKey)}
                    </p>
                    <p className="mt-2 text-sm text-ink-muted">
                      {t('safety.weightLabel')}: {rule.weight} · {rule.phraseCount} {t('safety.phrasesFound').toLowerCase()}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </Card>
  );
}
