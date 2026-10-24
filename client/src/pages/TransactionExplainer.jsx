/**
 * ============================================================================
 * Transaction Explainer
 * ============================================================================
 *
 * Paste a real UPI/bank SMS, get it back in plain words:
 *   "₹500 was sent to Ramesh on 12 September."
 *
 * Then the two things that actually protect the user:
 *   1. A safety check on the same text (fake "transaction" messages are a
 *      common scam carrier).
 *   2. A concrete instruction to compare it against their own banking app,
 *      because no amount of parsing can prove a message is genuine.
 *
 * The facts are rendered as a list of short sentences, each with its own
 * speaker, so the user can go through them one at a time. Reading five
 * separate rows is far easier than listening to one long paragraph.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { explainTransactionText } from '../lib/api.js';
import { createTranslator, detectTextLang, LANGUAGES } from '../i18n/index.js';
import { SAMPLE_SMS } from '@shared/demoData.js';
import BigButton from '../components/BigButton.jsx';
import SpeakerButton, { SpeakSection } from '../components/SpeakerButton.jsx';
import {
  Card,
  PageHeader,
  VerdictPanel,
  VerdictBadge,
  ErrorState,
  LoadingState,
  SignalRow,
} from '../components/ui.jsx';
import {
  ReceiptIcon,
  SearchIcon,
  HelpIcon,
  CheckCircleIcon,
  DocumentIcon,
  FACT_ICONS,
} from '../components/icons.jsx';

export default function TransactionExplainer() {
  const { t } = useSettings();
  const { record } = useActivity();
  const reduceMotion = useReducedMotion();

  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const resultRef = useRef(null);

  const run = useCallback(
    async (input) => {
      const value = (input ?? text).trim();
      if (value.length < 5) {
        setError(t('explain.error.tooShort'));
        setStatus('error');
        return;
      }
      setStatus('working');
      setError(null);
      try {
        const data = await explainTransactionText(value);
        if (data.ok) {
          setResult(data);
          setStatus('done');
          // Keep the parsed FACTS (amount band, direction, counterparty) and
          // the verdict - never the pasted message, which is where the account
          // number lives. See lib/activity.js.
          record('explain', data, { verdict: data.safety?.verdict ?? 'explained' });
        } else {
          setError(data.error || t('explain.error.internal'));
          setStatus('error');
        }
      } catch (err) {
        setError(err.message || t('explain.error.internal'));
        setStatus('error');
      }
    },
    [text, t, record]
  );

  useEffect(() => {
    if (status === 'done' && resultRef.current) {
      resultRef.current.focus();
      resultRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [status, reduceMotion]);

  function handleClear() {
    setText('');
    setResult(null);
    setStatus('idle');
    setError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('explain.title')}
        subtitle={t('explain.subtitle')}
        icon={ReceiptIcon}
        speakText={`${t('explain.title')}. ${t('explain.subtitle')}`}
      />

      <Card>
        <label htmlFor="explain-text" className="mb-2 block text-lg font-extrabold text-ink">
          {t('explain.inputLabel')}
        </label>
        <textarea
          id="explain-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          placeholder={t('explain.inputPlaceholder')}
          rows={7}
          className="field resize-y font-mono text-base"
        />

        <div className="mt-5 flex flex-col gap-4 sm:flex-row">
          <BigButton
            size="block"
            icon={SearchIcon}
            onClick={() => run()}
            loading={status === 'working'}
            disabled={!text.trim()}
          >
            {t('explain.explainButton')}
          </BigButton>
          {text && (
            <BigButton variant="ghost" size="block" onClick={handleClear}>
              {t('explain.clear')}
            </BigButton>
          )}
        </div>
      </Card>

      <Samples onPick={(sample) => { setText(sample); run(sample); }} />

      {status === 'working' && <LoadingState message={t('common.loading')} rows={2} />}
      {status === 'error' && error && (
        <ErrorState title={t('common.error')} message={error} onRetry={() => run()} />
      )}
      {status === 'done' && result && <Explanation result={result} resultRef={resultRef} />}

      {status === 'idle' && !result && (
        <Card className="text-center">
          <HelpIcon className="mx-auto w-14 h-14 text-ink-muted" />
          <p className="mt-3 text-lg font-bold text-ink-soft">{t('verdict.empty')}</p>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The explanation                                                             */
/* -------------------------------------------------------------------------- */

function Explanation({ result, resultRef }) {
  // `uiT` is the app's own language, used for controls and status lines such
  // as the region name, the speaker button and the offline note.
  const { t: uiT, language } = useSettings();
  const { speak, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();

  // THE EXPLANATION FOLLOWS THE MESSAGE, NOT THE APP.
  // The message that was pasted may be in any of the five languages, so the
  // summary, the facts and the safety verdict are all written - and spoken -
  // in the message's own language. A Tamil bank SMS should come back in Tamil
  // even when the app itself is set to Hindi. Missing translations fall back
  // to English inside createTranslator, never to a raw key.
  const resultLang = detectTextLang(result.rawText || '', language);
  const t = useMemo(() => createTranslator(resultLang), [resultLang]);

  // The parser sends `vars.when` in English ("today", "on 12 September")
  // because it is shared verbatim with the server. Rebuild that piece from
  // `whenKey` against the message's language, and format the date in the same
  // locale so the month name matches the sentence around it. Everything else
  // in `vars` (amount, who) is script-neutral or a name, so it is reused as-is.
  const when = result.when || {};
  const dateLabel = when.date
    ? new Date(when.date).toLocaleDateString(LANGUAGES[resultLang]?.bcp47 || 'en-IN', {
        day: 'numeric',
        month: 'long',
      })
    : '';
  const whenText =
    when.whenKey && result.vars?.when
      ? t(when.whenKey, { date: dateLabel })
      : result.vars?.when || '';
  const vars = { ...result.vars, when: whenText };

  // The one-sentence summary, built from a template so it reads correctly in
  // all five languages. `vars.when` is empty when no date was found, and the
  // template's stray space is collapsed by the i18n interpolator.
  const summary = t(result.summaryKey, vars);
  const speakId = 'explain-summary';

  // Read the summary aloud the moment it appears, in the message's language.
  //
  // Depends on `result`, not `result.summaryKey`. The parser only has six
  // possible summary keys, so checking "₹500 to Ramesh" and then "₹200 to
  // Suresh" produces the SAME key - `summary.debit` both times - and keying on
  // it left the second transaction silent. The amounts and names live in
  // `vars`, so the key never changes when the answer does.
  useEffect(() => {
    if (ttsSupported) speak(summary, { id: speakId, lang: resultLang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const facts = result.facts || [];
  const safety = result.safety;
  const missing = result.missing || [];

  return (
    <motion.div
      ref={resultRef}
      tabIndex={-1}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="scroll-mt-4 space-y-5 focus:outline-none"
      role="region"
      aria-label={uiT('explain.resultTitle')}
    >
      {/* ---- The headline ------------------------------------------------ */}
      <Card className="border-4 border-primary-300 bg-primary-50">
        <h2 className="mb-3 flex items-center gap-3 text-lg font-extrabold text-primary-900">
          <ReceiptIcon className="w-7 h-7" />
          {t('explain.resultTitle')}
        </h2>

        <p className="text-2xl font-extrabold leading-snug text-ink sm:text-3xl">
          {summary}
        </p>

        {ttsSupported && (
          <div className="mt-4">
            <SpeakSection
              text={summary}
              id={speakId}
              label={uiT('explain.speakResult')}
              lang={resultLang}
            />
          </div>
        )}

        {result.local && (
          <p className="mt-3 text-sm font-semibold text-ink-muted">
            {uiT('app.offlineNotice')}
          </p>
        )}
      </Card>

      {/* ---- Facts, one row at a time -------------------------------------- */}
      {facts.length > 0 && (
        <Card>
          <h2 className="card-title mb-4">{t('safety.howTitle')}</h2>
          <ul className="space-y-3">
            {facts.map((fact) => {
              const Icon = FACT_ICONS[fact.icon] || DocumentIcon;
              // The "when" fact carries the parser's English date words; swap
              // in the localized version built above.
              const factVars =
                fact.id === 'when' ? { ...fact.vars, when: whenText } : fact.vars;
              const sentence = t(fact.key, factVars);
              return (
                <li
                  key={fact.id}
                  className="flex items-center gap-3 rounded-card border-2 border-primary-100 bg-surface p-3"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800"
                    aria-hidden="true"
                  >
                    <Icon className="w-7 h-7" />
                  </span>
                  <p className="min-w-0 flex-1 text-lg font-semibold leading-snug text-ink">
                    {sentence}
                  </p>
                  {ttsSupported && (
                    <SpeakerButton
                      text={sentence}
                      id={`fact-${fact.id}`}
                      size="sm"
                      hint={false}
                      lang={resultLang}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ---- Safety on the same message ------------------------------------ */}
      {safety && <SafetyWithinExplanation safety={safety} lang={resultLang} />}

      {/* ---- What we could not find ---------------------------------------- */}
      {missing.length > 0 && (
        <Card>
          <h2 className="card-title mb-2">{t('explain.missingTitle')}</h2>
          <p className="mb-3 text-base text-ink-soft">{t('explain.missingHint')}</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <li
                key={m}
                className="rounded-pill bg-primary-100 px-4 py-2 text-sm font-bold text-primary-900"
              >
                {t(`explain.missingLabels.${m}`) || m}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---- The only way to actually verify -------------------------------- */}
      <Card className="border-4 border-calm-300 bg-calm-50">
        <h2 className="mb-2 flex items-center gap-3 text-lg font-extrabold text-calm-900">
          <CheckCircleIcon className="w-7 h-7" />
          {t('explain.compareTitle')}
        </h2>
        <p className="text-lg leading-relaxed text-ink">{t('explain.compareBody')}</p>
        {ttsSupported && (
          <div className="mt-4">
            <SpeakSection
              text={t('explain.compareTitle') + '. ' + t('explain.compareBody')}
              id="explain-compare"
              lang={resultLang}
            />
          </div>
        )}
      </Card>

      {/* ---- The raw text, for reference ------------------------------------ */}
      <Card>
        <details>
          <summary className="min-h-touch cursor-pointer text-base font-extrabold text-primary-800">
            {t('safety.howTitle')}
          </summary>
          <div className="scroll-area mt-3">
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink-soft">
              {result.rawText}
            </p>
          </div>
        </details>
      </Card>
    </motion.div>
  );
}

/** A compact version of the Safety Checker's result, embedded here. */
function SafetyWithinExplanation({ safety, lang }) {
  // `uiT` is the app's language for the control labels; `t` below answers in
  // the language of the message these rules matched against.
  const { t: uiT } = useSettings();
  const { ttsSupported } = useSpeech();
  const t = useMemo(() => createTranslator(lang), [lang]);

  // Built from the rules' translation KEYS. `safety.reasons` carries the
  // English sentences straight out of the rule engine, so reading that instead
  // gave a Tamil user a translated verdict followed by an English explanation
  // of it. A key with no translation falls back to English through `t()`, which
  // is the failure mode we want: understandable, never blank.
  const spoken = [
    t(`verdict.${safety.verdict}`),
    ...(safety.matchedRules || []).map((r) => t(r.explanationKey)),
  ].join(' ');

  return (
    <VerdictPanel verdict={safety.verdict}>
      <h2 className="mb-3 text-lg font-extrabold text-ink">{t('safety.verdictLabel')}</h2>

      <VerdictBadge verdict={safety.verdict} label={t(`verdict.${safety.verdict}Short`)} size="md" />
      <p className="mt-3 text-center text-lg font-bold leading-snug text-ink">
        {t(`verdict.${safety.verdict}`)}
      </p>

      {(safety.matchedRules || []).length > 0 && (
        <ul className="mt-4 space-y-3">
          {safety.matchedRules.slice(0, 3).map((rule) => (
            <li key={rule.id} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={[
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white',
                  rule.severity === 'danger' ? 'bg-danger-700' : 'bg-warn-600',
                ].join(' ')}
              >
                !
              </span>
              <span className="text-base font-semibold leading-relaxed text-ink">
                {t(rule.explanationKey)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(safety.safeSignals || []).length > 0 && (
        <div className="mt-5 border-t-2 border-ink/10 pt-4">
          <h3 className="mb-2 text-base font-extrabold text-ink">{t('safety.signalsTitle')}</h3>
          <ul className="space-y-2">
            {safety.safeSignals.map((s) => (
              <SignalRow key={s.id} ok>
                <span className="text-base">{t(s.labelKey)}</span>
              </SignalRow>
            ))}
          </ul>
        </div>
      )}

      {ttsSupported && (
        <div className="mt-5 flex justify-center">
          <SpeakSection
            text={spoken}
            id="explain-safety"
            label={uiT('safety.speakVerdict')}
            lang={lang}
          />
        </div>
      )}
    </VerdictPanel>
  );
}

/* -------------------------------------------------------------------------- */

function Samples({ onPick }) {
  const { t } = useSettings();
  return (
    <Card>
      <h2 className="card-title mb-1">{t('explain.sampleTitle')}</h2>
      <p className="mb-4 text-sm font-semibold text-ink-muted">{t('explain.sampleHint')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
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
