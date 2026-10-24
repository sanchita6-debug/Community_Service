/**
 * Small presentational building blocks shared across every screen.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import SpeakerButton, { SpeakingWave } from './SpeakerButton.jsx';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  OfflineIcon,
  PersonIcon,
  StarIcon,
  SunIcon,
  MoonIcon,
} from './icons.jsx';

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A screen title with an optional speaker, so a heading can be read aloud. */
export function PageHeader({ title, subtitle, speakText, icon: Icon, action }) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="mb-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-start gap-4"
      >
        {Icon && (
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-primary-100 text-primary-800"
            aria-hidden="true"
          >
            <Icon className="w-9 h-9" />
          </span>
        )}

        <div className="min-w-[12rem] flex-1">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-lg leading-relaxed text-ink-soft">{subtitle}</p>
          )}
        </div>

        {speakText && <SpeakerButton text={speakText} id={`header-${title}`} size="md" />}

        {action}
      </motion.div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Verdict display                                                             */
/* -------------------------------------------------------------------------- */

const VERDICT_STYLES = {
  green: {
    wrapper: 'border-calm-600 bg-calm-50',
    badge: 'bg-calm-700 text-white',
    icon: CheckCircleIcon,
    ring: 'text-calm-800',
  },
  yellow: {
    wrapper: 'border-warn-600 bg-warn-50',
    badge: 'bg-warn-600 text-white',
    icon: AlertTriangleIcon,
    ring: 'text-warn-800',
  },
  red: {
    wrapper: 'border-danger-700 bg-danger-50',
    badge: 'bg-danger-700 text-white',
    icon: XCircleIcon,
    ring: 'text-danger-800',
  },
};

/**
 * The GREEN / YELLOW / RED answer.
 * `size="hero"` is used as the first thing on the Safety Checker result, at
 * 4xl type, because this one word is the entire point of the screen.
 */
export function VerdictBadge({ verdict = 'yellow', label, size = 'md', withIcon = true, speaking = false }) {
  const style = VERDICT_STYLES[verdict] || VERDICT_STYLES.yellow;
  const Icon = style.icon;

  const sizes = {
    sm: 'px-4 py-2 text-lg',
    md: 'px-6 py-3 text-2xl',
    lg: 'px-8 py-5 text-3xl sm:text-4xl',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`flex flex-wrap items-center justify-center gap-3 rounded-card ${style.badge} ${sizes[size]} shadow-lift`}
        role="status"
        aria-live="assertive"
      >
        {withIcon && <Icon className="w-9 h-9 shrink-0" />}
        <span className="font-extrabold tracking-tight">{label}</span>
        {speaking && <SpeakingWave />}
      </div>
    </div>
  );
}

/** The full-colour result panel that wraps a VerdictBadge. */
export function VerdictPanel({ verdict = 'yellow', children, className = '' }) {
  const style = VERDICT_STYLES[verdict] || VERDICT_STYLES.yellow;
  return (
    <div className={`rounded-card border-4 p-5 sm:p-6 ${style.wrapper} ${className}`}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States: loading / error / empty                                            */
/* -------------------------------------------------------------------------- */

export function LoadingState({ message, rows = 3, className = '' }) {
  const { t } = useSettings();
  return (
    <div className={className} role="status" aria-live="polite">
      <p className="mb-4 text-lg font-bold text-ink-soft">
        {message || t('common.loading')}
      </p>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-20"
            style={{ animationDelay: `${i * 120}ms` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ title, message, onRetry, className = '' }) {
  const { t } = useSettings();
  return (
    <div
      role="alert"
      className={`rounded-card border-4 border-warn-500 bg-warn-50 p-6 text-center ${className}`}
    >
      <AlertTriangleIcon className="mx-auto w-14 h-14 text-warn-800" />
      <h2 className="mt-3 text-2xl font-extrabold text-warn-900">
        {title || t('common.error')}
      </h2>
      {message && <p className="mt-2 text-lg text-ink-soft">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary mt-5"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

/** Shown when the device is offline. Non-blocking, never a modal. */
export function OfflineNotice({ className = '' }) {
  const { t } = useSettings();
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-card border-2 border-warn-400 bg-warn-50 px-4 py-3 ${className}`}
    >
      <OfflineIcon className="w-7 h-7 shrink-0 text-warn-800" />
      <p className="text-base font-bold text-warn-900">{t('app.offlineNotice')}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

/** A label + value row, used in the Explainer and the review step. */
export function DetailRow({ label, value, icon: Icon, tone = 'default', className = '' }) {
  const tones = {
    default: 'bg-primary-50 border-primary-100',
    ok: 'bg-calm-50 border-calm-200',
    warn: 'bg-warn-50 border-warn-200',
    danger: 'bg-danger-50 border-danger-200',
  };
  return (
    <div className={`flex items-center gap-4 rounded-card border-2 p-4 ${tones[tone]} ${className}`}>
      {Icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft" aria-hidden="true">
          <Icon className="w-7 h-7" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="text-xl font-extrabold leading-snug text-ink">{value}</p>
      </div>
    </div>
  );
}

/** A "safe / concern" bullet. Green and yellow only - red is for verdicts. */
export function SignalRow({ ok, children, className = '' }) {
  return (
    <li className={`flex items-start gap-3 text-lg leading-relaxed ${className}`}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black text-white ${
          ok ? 'bg-calm-600' : 'bg-warn-600'
        }`}
      >
        {ok ? '✓' : '!'}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Progress dots for the multi-step Send Money flow. */
export function StepDots({ steps, current, className = '' }) {
  const { t } = useSettings();
  return (
    <div className={className}>
      <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1} aria-label={t('send.stepOf', { current: current + 1, total: steps.length })}>
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <div
              key={step}
              className="flex-1"
              aria-hidden="true"
            >
              <div
                className={[
                  'h-3 rounded-full transition-colors',
                  done ? 'bg-calm-600' : active ? 'bg-primary-700' : 'bg-primary-200',
                ].join(' ')}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-base font-bold text-ink-soft" aria-live="polite">
        {t('send.stepOf', { current: current + 1, total: steps.length })}
      </p>
    </div>
  );
}

/** A labelled avatar-ish circle for a payee name. */
export function PersonBadge({ name, trusted = false, className = '' }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <span
      className={[
        'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-extrabold',
        trusted ? 'bg-calm-100 text-calm-800' : 'bg-primary-100 text-primary-800',
        className,
      ].join(' ')}
      aria-hidden="true"
    >
      {initials}
      {trusted && (
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-calm-600 text-white">
          <StarIcon className="w-3.5 h-3.5" />
        </span>
      )}
    </span>
  );
}

/**
 * An on/off switch that is a real checkbox underneath. Using a styled <div>
 * with onClick would be invisible to a screen reader and untappable by
 * keyboard.
 *
 * It lives here rather than in Settings.jsx because two screens need it: the
 * person using the app, and the relative setting the phone up for them. One
 * implementation means the switch cannot drift between them - if the tap
 * target or the focus ring changes, it changes for both.
 */
export function Toggle({ label, help, checked, onChange, className = '' }) {
  return (
    <label
      className={`flex min-h-touch cursor-pointer items-start gap-4 rounded-card border-2 border-primary-100 bg-surface p-4 ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-8 w-8 shrink-0 accent-primary-700"
      />
      <span className="min-w-0">
        <span className="block text-lg font-extrabold text-ink">{label}</span>
        {help && <span className="mt-1 block text-base text-ink-soft">{help}</span>}
      </span>
    </label>
  );
}

/**
 * The light / dark switch, as two big labelled buttons.
 *
 * Two buttons rather than one sliding switch, for the same reason the rest of
 * this app uses big buttons: the state is written in words AND drawn, so
 * nobody has to remember what a switch means or work out which way is "on".
 * It is also the shape used by the language and the text size controls, so
 * the three look like one family.
 *
 * It lives here, next to Toggle, because three screens need it - the person
 * using the app, the relative setting the phone up for them, and the header
 * shortcut. One implementation means the control cannot drift between them.
 */
export function ThemeChoice({ value, onChange, className = '' }) {
  const { t } = useSettings();

  const options = [
    { value: 'light', label: t('settings.themeLight'), Icon: SunIcon },
    { value: 'dark', label: t('settings.themeDark'), Icon: MoonIcon },
  ];

  return (
    <div
      className={['grid gap-3 sm:grid-cols-2', className].join(' ')}
      role="group"
      aria-label={t('settings.themeTitle')}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={[
              'min-h-touch w-full rounded-card border-4 px-4 text-center text-lg font-extrabold transition',
              active
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-primary-200 bg-surface text-ink hover:border-primary-500',
            ].join(' ')}
          >
            <span className="flex items-center justify-center gap-3">
              <option.Icon className="h-7 w-7 shrink-0" />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The same switch as a single round button, for the app header.
 *
 * The picture shows the screen you will GET, not the one you are on: a moon
 * means "tap this and the app goes dark", a sun means "tap this and the app
 * goes light". Tapping always does the thing the picture shows, which is the
 * one rule a person who cannot read the label can still rely on.
 */
export function ThemeToggleButton({ className = '' }) {
  const { t, theme, setTheme } = useSettings();

  const goingDark = theme !== 'dark';
  const next = goingDark ? 'dark' : 'light';
  const Icon = goingDark ? MoonIcon : SunIcon;
  const label = goingDark ? t('settings.themeSwitchToDark') : t('settings.themeSwitchToLight');

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={[
        'flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary-200',
        'bg-surface text-primary-800 transition active:scale-95',
        className,
      ].join(' ')}
    >
      <Icon className="h-8 w-8" />
    </button>
  );
}

/**
 * A text field with a microphone button built in.
 * This is the component that makes the app genuinely voice-first: every input
 * can be filled by speaking, and typing is always available as a fallback.
 */
export function SpeakableInput({
  value,
  onChange,
  onListenResult,
  label,
  hint,
  placeholder,
  type = 'text',
  inputMode,
  maxLength = 60,
  autoFocus = false,
  error,
  disabled = false,
  helpId,
}) {
  const { t } = useSettings();
  const { listen, listening, sttSupported, sttErrorMessage, clearSttStatus } = useSpeech();

  async function handleMic() {
    if (listening) return;
    clearSttStatus();
    const result = await listen();
    if (result.status === 'ok' && result.text) {
      onChange(result.text.trim());
      onListenResult?.(result.text.trim());
    } else if (result.status !== 'aborted') {
      // Surfaced as a hint under the field rather than a blocking alert.
      // A person who cannot speak should still be able to move on.
      onListenResult?.(null, sttErrorMessage(result.status));
    }
  }

  const fieldId = `field-${label.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-lg font-extrabold text-ink">
        {label}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-describedby={helpId}
          aria-invalid={error ? 'true' : undefined}
          className={`field flex-1 ${error ? 'border-danger-500' : ''}`}
        />

        {sttSupported && (
          <button
            type="button"
            onClick={handleMic}
            disabled={disabled}
            aria-label={listening ? t('common.stopListening') : t('common.listen')}
            className={[
              'flex min-h-touch min-w-touch items-center justify-center gap-3 rounded-card border-4 px-5 text-lg font-bold transition active:scale-95',
              listening
                ? 'border-danger-600 bg-danger-600 text-white'
                : 'border-primary-300 bg-surface text-primary-800 hover:border-primary-500',
            ].join(' ')}
          >
            {listening ? <SpeakingWave /> : <MicGlyph />}
            <span className="sm:hidden">{listening ? t('common.stopListening') : t('common.listen')}</span>
          </button>
        )}
      </div>

      {listening && (
        <p className="mt-2 text-base font-semibold text-primary-800" aria-live="polite">
          {t('common.listening')}
        </p>
      )}

      {(error || hint) && (
        <p
          id={helpId}
          className={`mt-2 text-base font-semibold ${error ? 'text-danger-800' : 'text-ink-soft'}`}
          aria-live="polite"
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  );
}

/** A "person in your trusted list" chip. */
export function PayeeChip({ name, trusted, onRemove, removeLabel }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-pill border-2 px-4 py-2 text-base font-bold',
        trusted ? 'border-calm-300 bg-calm-50 text-calm-900' : 'border-primary-200 bg-surface text-ink',
      ].join(' ')}
    >
      <PersonIcon className="w-5 h-5 shrink-0" />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          /* 64x64 is the app's own minimum tap target and this chip sits on a
             screen a relative uses with the person they are helping, often
             one-handed. At 32px it was the smallest control in the app. */
          className="-my-1 ml-1 flex h-16 w-16 items-center justify-center rounded-full bg-surface text-2xl font-bold text-danger-800 hover:bg-danger-50"
          aria-label={`${removeLabel}: ${name}`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </span>
  );
}
