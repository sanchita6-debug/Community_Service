/**
 * ============================================================================
 * Guided Send Money
 * ============================================================================
 *
 * A five-step coach. THE SINGLE MOST IMPORTANT THING ABOUT THIS FILE is what it
 * does NOT do: it never asks for an OTP, a PIN, a card number, or a password.
 * It has no field for any of them, and it must never gain one. The safety
 * banner from the Layout is on screen for the whole flow.
 *
 * Nothing here touches a bank, a payment app, or the network. The "payment" is
 * a local state machine and the success screen says so in plain words.
 *
 * STEP DESIGN NOTES
 * -----------------
 * - Each step speaks itself on arrival (auto-speak), and has a speaker button
 *   to repeat. A user who cannot read and does not know they can tap for
 *   audio should still be able to complete the whole flow.
 * - The payee step uses a native numeric keypad-friendly text input plus a
 *   microphone. Both paths always exist; neither is a fallback of last resort.
 * - The amount step accepts spoken numbers in English ("two hundred fifty"),
 *   Hindi, Tamil, Telugu, or Bengali, via the shared parser.
 * - Name confirmation is a separate explicit step. Getting the payee name
 *   wrong is the single most common real-world way elderly users lose money.
 * - The review step surfaces the "not in your trusted list" warning, because
 *   that is the moment a relative could have prevented a fraud.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { formatIndianNumber, parseSpokenNumber } from '@shared/transactionParser.js';
import { normaliseSpokenNumber } from '../lib/speech.js';
import BigButton from '../components/BigButton.jsx';
import SpeakerButton from '../components/SpeakerButton.jsx';
import { Card, StepDots, SpeakableInput, DetailRow, PersonBadge, PayeeChip } from '../components/ui.jsx';
import {
  PersonIcon,
  RupeeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  StarIcon,
  LockIcon,
  SendIcon,
} from '../components/icons.jsx';

const STEPS = ['payee', 'confirm', 'amount', 'review', 'done'];

/** Practice-mode ceiling. A deliberate guard rail, not a business rule. */
const MAX_AMOUNT = 100000;

export default function SendMoney() {
  const { t, trustedPayees } = useSettings();
  const { record } = useActivity();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [payee, setPayee] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [amount, setAmount] = useState(null);
  const [amountError, setAmountError] = useState(null);
  const [heardHint, setHeardHint] = useState('');

  const step = STEPS[stepIndex];
  // Progress labels, in the active language. `send.steps` is an array in the
  // i18n files, so it is read as a list rather than through `t()`.
  const stepTitles = useMemo(() => t('send.steps') || [], [t]);

  // Fresh run every time the screen mounts - this is a practice tool, so
  // arriving half-way through someone's old flow would be confusing.
  useEffect(() => {
    setStepIndex(0);
    setPayee('');
    setAmountInput('');
    setAmount(null);
    setAmountError(null);
    setHeardHint('');
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  /**
   * Finishing the review step is the moment the "payment" happens, so it is the
   * moment worth saving: the payee name the user typed, and an amount BAND
   * rather than the exact figure. Both are what the History screen shows.
   *
   * This is a practice flow and no money moves - the record exists so a family
   * helper can see what was rehearsed and with whom.
   */
  const finishReview = useCallback(() => {
    record(
      'send',
      { payeeName: payee, amount },
      { verdict: trustedMatch ? 'sent-trusted' : 'sent-untrusted' }
    );
    goNext();
  }, [record, payee, amount, trustedMatch, goNext]);

  /** A loose name match against the saved list. Used to warn, never to block. */
  const trustedMatch = useMemo(() => {
    const q = payee.trim().toLowerCase();
    if (!q) return null;
    return (
      trustedPayees.find((p) => p.name.toLowerCase() === q) ||
      trustedPayees.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())) ||
      null
    );
  }, [payee, trustedPayees]);

  const payeeValid = payee.trim().length >= 2;

  /* ---------------------------------------------------------------------- */
  /* Step 1 - who are you paying?                                            */
  /* ---------------------------------------------------------------------- */
  const payeeStep = (
    <StepShell
      stepKey="payee"
      title={t('send.payeeLabel')}
      icon={PersonIcon}
      spokenText={`${t('send.payeeLabel')} ${t('send.payeeHelp')}`}
    >
      <SpeakableInput
        value={payee}
        onChange={(v) => {
          setPayee(v);
          setHeardHint('');
        }}
        onListenResult={(text, error) => {
          if (text) {
            setHeardHint(`${t('send.heard')}: ${text}`);
          } else if (error) {
            setHeardHint(error);
          }
        }}
        label={t('send.payeeLabel')}
        hint={heardHint || t('send.payeeHint')}
        placeholder={t('send.payeePlaceholder')}
        maxLength={40}
        autoFocus
        helpId="payee-help"
      />

      {/* One-tap selection of someone they pay often. Removes typing entirely
          for the repeat case, which is most of the real traffic. */}
      {trustedPayees.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-lg font-extrabold text-ink">{t('send.trustedList')}</p>
          <ul className="flex flex-wrap gap-3">
            {trustedPayees.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPayee(p.name)}
                  className="min-h-touch"
                  aria-pressed={payee.trim().toLowerCase() === p.name.toLowerCase()}
                >
                  <PayeeChip name={p.name} trusted />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <BigButton
          size="block"
          icon={ArrowRightIcon}
          iconPosition="right"
          disabled={!payeeValid}
          onClick={goNext}
        >
          {t('common.next')}
        </BigButton>
        {!payeeValid && (
          <p className="mt-3 text-center text-base font-semibold text-ink-muted" aria-live="polite">
            {t('send.invalidPayee')}
          </p>
        )}
      </div>
    </StepShell>
  );

  /* ---------------------------------------------------------------------- */
  /* Step 2 - confirm the name (the fraud-prevention moment)                */
  /* ---------------------------------------------------------------------- */
  const confirmStep = (
    <StepShell
      stepKey="confirm"
      title={t('send.confirmPayeeTitle')}
      icon={CheckCircleIcon}
      spokenText={`${t('send.confirmPayeeTitle')} ${payee}. ${t('send.confirmPayeeHelp')}`}
    >
      <div className="flex flex-col items-center gap-4 rounded-card border-4 border-primary-200 bg-primary-50 p-6 text-center">
        <PersonBadge name={payee} trusted={Boolean(trustedMatch)} />
        <p className="text-3xl font-extrabold text-ink sm:text-4xl">{payee}</p>

        {trustedMatch ? (
          <p className="inline-flex items-center gap-2 rounded-pill bg-calm-100 px-5 py-2 text-lg font-extrabold text-calm-900">
            <StarIcon className="w-6 h-6" />
            {t('send.trustedLabel')}
          </p>
        ) : (
          <p className="inline-flex items-start gap-2 rounded-pill bg-warn-100 px-5 py-3 text-base font-bold text-warn-900">
            <AlertTriangleIcon className="w-6 h-6 shrink-0" />
            {t('send.notTrustedLabel')}
          </p>
        )}
      </div>

      <p className="mt-5 text-lg leading-relaxed text-ink-soft">{t('send.confirmPayeeHelp')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <BigButton variant="secondary" size="block" icon={ArrowLeftIcon} onClick={goBack}>
          {t('send.confirmPayeeNo')}
        </BigButton>
        <BigButton variant="ok" size="block" onClick={goNext}>
          {t('send.confirmPayeeYes')}
        </BigButton>
      </div>
    </StepShell>
  );

  /* ---------------------------------------------------------------------- */
  /* Step 3 - the amount, by voice or by typing                              */
  /* ---------------------------------------------------------------------- */
  function handleAmountText(value) {
    setAmountInput(value);
    setAmountError(null);
    setHeardHint('');

    // Try to interpret immediately so the confirmation row appears as they
    // speak. Failure is fine - they can keep typing or press the button.
    const parsed = parseSpokenNumber(normaliseSpokenNumber(value));
    if (parsed !== null && parsed > 0) setAmount(parsed);
    else setAmount(null);
  }

  const amountStep = (
    <StepShell
      stepKey="amount"
      title={t('send.amountLabel')}
      icon={RupeeIcon}
      spokenText={`${t('send.amountLabel')} ${t('send.amountHint')}`}
    >
      <SpeakableInput
        value={amountInput}
        onChange={handleAmountText}
        onListenResult={(text, error) => {
          if (!text) {
            if (error) setHeardHint(error);
            return;
          }
          const parsed = parseSpokenNumber(normaliseSpokenNumber(text));
          if (parsed === null || parsed <= 0) {
            setAmountError(t('send.invalidAmount'));
            setAmountInput('');
            return;
          }
          setAmountInput(formatIndianNumber(parsed));
          setAmount(parsed);
          setHeardHint(`${t('send.heard')}: ${text}`);
        }}
        label={t('send.amountLabel')}
        hint={heardHint || t('send.amountHint')}
        placeholder={t('send.amountPlaceholder')}
        type="text"
        inputMode="numeric"
        maxLength={20}
        autoFocus
        error={amountError}
        helpId="amount-help"
      />

      {/* Echo the parsed amount back. This is the important trust step: the
          user must HEAR the number before sending, because speech recognition
          mishears "seven" as "seventy" more often than you would think. */}
      {amount !== null && amount > 0 && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 rounded-card border-4 border-calm-300 bg-calm-50 p-5 text-center"
        >
          <p className="text-base font-bold uppercase tracking-wide text-calm-800">
            {t('send.reviewAmount')}
          </p>
          <p className="tnum mt-1 text-5xl font-extrabold text-calm-900">₹{formatIndianNumber(amount)}</p>
          <div className="mt-3 flex justify-center">
            <SpeakerButton
              text={`${t('send.reviewAmount')} ${formatIndianNumber(amount)} rupees`}
              id="amount-echo"
              size="md"
            />
          </div>
        </motion.div>
      )}

      <div className="mt-8">
        <BigButton
          size="block"
          icon={ArrowRightIcon}
          iconPosition="right"
          disabled={!amount || amount <= 0 || amount > MAX_AMOUNT}
          onClick={() => {
            if (amount > MAX_AMOUNT) {
              setAmountError(t('send.amountMax'));
              return;
            }
            goNext();
          }}
        >
          {t('common.next')}
        </BigButton>
      </div>
    </StepShell>
  );

  /* ---------------------------------------------------------------------- */
  /* Step 4 - review                                                         */
  /* ---------------------------------------------------------------------- */
  const reviewStep = (
    <StepShell
      stepKey="review"
      title={t('send.reviewTitle')}
      icon={CheckCircleIcon}
      spokenText={[
        t('send.reviewTitle'),
        `${t('send.reviewPayee')}: ${payee}.`,
        `${t('send.reviewAmount')}: ${formatIndianNumber(amount ?? 0)} rupees.`,
        trustedMatch ? t('send.trustedLabel') : t('send.reviewNameWarning'),
      ].join(' ')}
    >
      <div className="space-y-4">
        <DetailRow label={t('send.reviewPayee')} value={payee} icon={PersonIcon} />
        <DetailRow
          label={t('send.reviewAmount')}
          value={`₹${formatIndianNumber(amount ?? 0)}`}
          icon={RupeeIcon}
          tone="ok"
        />
        <DetailRow
          label={trustedMatch ? t('send.trustedLabel') : t('send.notTrustedLabel')}
          value={payee}
          icon={trustedMatch ? StarIcon : AlertTriangleIcon}
          tone={trustedMatch ? 'ok' : 'warn'}
        />
      </div>

      {/* The one genuinely useful warning in the whole flow. */}
      {!trustedMatch && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 flex items-start gap-4 rounded-card border-4 border-warn-500 bg-warn-50 p-5"
          role="alert"
        >
          <AlertTriangleIcon className="w-10 h-10 shrink-0 text-warn-800" />
          <p className="text-lg font-bold leading-relaxed text-warn-900">
            {t('send.reviewNameWarning')}
          </p>
        </motion.div>
      )}

      {/* A quiet, repeated reminder of the one thing that matters. */}
      <div className="mt-5 flex items-start gap-3 rounded-card border-2 border-primary-200 bg-primary-50 p-4">
        <LockIcon className="w-8 h-8 shrink-0 text-primary-800" />
        <p className="text-base font-semibold text-primary-900">{t('safetyBanner.text')}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <BigButton variant="secondary" size="block" icon={ArrowLeftIcon} onClick={goBack}>
          {t('nav.back')}
        </BigButton>
        <BigButton variant="ok" size="block" onClick={finishReview}>
          {t('common.done')}
        </BigButton>
      </div>
    </StepShell>
  );

  /* ---------------------------------------------------------------------- */
  /* Step 5 - done (simulated)                                               */
  /* ---------------------------------------------------------------------- */
  const doneStep = (
    <StepShell
      stepKey="done"
      title={t('send.doneTitle')}
      icon={CheckCircleIcon}
      spokenText={[
        t('send.doneTitle'),
        t('send.doneBanner'),
        `${t('send.reviewPayee')}: ${payee}.`,
        `${t('send.reviewAmount')}: ${formatIndianNumber(amount ?? 0)} rupees.`,
        t('send.doneBody'),
      ].join(' ')}
    >
      {/* This banner is non-negotiable. A simulated payment must never look
          like a real one. */}
      <motion.div
        initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="rounded-card border-4 border-dashed border-primary-700 bg-primary-100 p-5 text-center"
      >
        <p className="text-2xl font-black uppercase tracking-wide text-primary-950">
          {t('send.doneBanner')}
        </p>
      </motion.div>

      <div className="mt-6 flex flex-col items-center gap-4 text-center">
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full bg-calm-100 text-calm-800"
          aria-hidden="true"
        >
          <CheckCircleIcon className="w-14 h-14" />
        </span>
        <h2 className="text-3xl font-extrabold text-ink">{t('send.doneTitle')}</h2>
        <p className="max-w-md text-lg leading-relaxed text-ink-soft">{t('send.doneBody')}</p>
      </div>

      <Card className="mt-6">
        <h3 className="mb-3 text-lg font-extrabold text-ink">{t('send.doneStepsTitle')}</h3>
        <ul className="space-y-3">
          <SummaryLine label={t('send.reviewPayee')} value={payee} icon={PersonIcon} />
          <SummaryLine
            label={t('send.reviewAmount')}
            value={`₹${formatIndianNumber(amount ?? 0)}`}
            icon={RupeeIcon}
          />
          <SummaryLine label={t('common.step')} value={`${stepIndex} ${t('common.of')} ${STEPS.length}`} icon={CheckCircleIcon} />
        </ul>
      </Card>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row">
        <BigButton
          variant="secondary"
          size="block"
          onClick={() => {
            setStepIndex(0);
            setPayee('');
            setAmountInput('');
            setAmount(null);
          }}
        >
          {t('send.practiseAgain')}
        </BigButton>
        <BigButton size="block" onClick={() => navigate('/')}>
          {t('send.goHome')}
        </BigButton>
      </div>
    </StepShell>
  );

  const RENDER = [payeeStep, confirmStep, amountStep, reviewStep, doneStep];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-calm-100 text-calm-800"
          aria-hidden="true"
        >
          <SendIcon className="w-10 h-10" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold leading-tight text-ink">{t('send.title')}</h1>
        </div>
      </div>

      {step !== 'done' && (
        <StepDots steps={stepTitles} current={stepIndex} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {RENDER[stepIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step shell                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The frame around one step: a big icon, a title, a speaker, and auto-speech.
 * Every step goes through this so no step can accidentally ship without audio.
 */
function StepShell({ stepKey, title, spokenText, icon: Icon, children }) {
  const { t } = useSettings();
  const { isSpeaking } = useSpeech();

  // Auto-speak this step when it becomes the active step.
  useSpeakOnMount(spokenText, { id: `step-${stepKey}` });

  return (
    <Card className="animate-fade-up">
      <div className="mb-6 flex items-start gap-4">
        {Icon && (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-primary-100 text-primary-800"
            aria-hidden="true"
          >
            <Icon className="w-11 h-11" />
          </motion.span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{title}</h2>
        </div>
        <SpeakerButton
          text={spokenText}
          id={`step-${stepKey}`}
          size="md"
          hint={false}
        />
      </div>

      {isSpeaking(`step-${stepKey}`) && (
        <p className="sr-only" role="status" aria-live="polite">
          {t('common.speak')}
        </p>
      )}

      {children}
    </Card>
  );
}

function SummaryLine({ label, value, icon: Icon }) {
  return (
    <li className="flex items-center gap-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800"
        aria-hidden="true"
      >
        <Icon className="w-6 h-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        <span className="block text-lg font-extrabold text-ink">{value}</span>
      </span>
    </li>
  );
}
