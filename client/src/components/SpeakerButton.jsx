/**
 * SpeakerButton - the most important control in the app
 * ============================================================================
 *
 * Present on every screen, next to every piece of instruction. Requirements it
 * enforces:
 *   - 64px minimum touch target (the whole button, not just the icon).
 *   - aria-pressed so a screen reader announces "pressed" while speaking.
 *   - A visible "listening" animation while TTS runs, so a deaf user can see
 *     that the voice is active rather than assuming the app is stuck.
 *   - Graceful degradation: if the device has no TTS, tapping explains why
 *     instead of doing nothing.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { SpeakerIcon, SpeakerOffIcon, HelpIcon } from './icons.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const SIZES = {
  sm: 'h-14 w-14',
  md: 'h-touch w-touch',
  lg: 'h-20 w-20',
};

const ICON_SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

export default function SpeakerButton({
  text,
  id,
  size = 'md',
  label,
  hint,
  lang,
  className = '',
  onUnsupported,
  disabled = false,
}) {
  const { t } = useSettings();
  const { toggle, isSpeaking, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();

  const active = isSpeaking(id);
  const accessibleLabel = label || (active ? t('common.stopSpeaking') : t('common.speak'));

  async function handleClick() {
    if (disabled || !text) return;
    if (!ttsSupported) {
      onUnsupported?.();
      return;
    }
    await toggle(text, { id, lang });
  }

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={active}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        whileTap={reduceMotion ? undefined : { scale: 0.9 }}
        className={[
          'speaker-btn relative',
          SIZES[size],
          active ? 'speaker-btn--speaking' : '',
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {/* A pulsing ring while speaking: the "it is talking" signal. */}
        {active && !reduceMotion && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full border-4 border-primary-700"
          />
        )}
        {active ? (
          <SpeakerOffIcon className={ICON_SIZES[size]} />
        ) : (
          <SpeakerIcon className={ICON_SIZES[size]} />
        )}
      </motion.button>

      {/* A small, quiet caption so the purpose is obvious to everyone. */}
      {hint !== false && (
        <span
          className="mt-1 max-w-[9rem] text-center text-sm font-semibold text-ink-muted"
          aria-hidden="true"
        >
          {active ? t('common.stopSpeaking') : t('common.speak')}
        </span>
      )}

      {!ttsSupported && (
        <span className="sr-only" role="note">
          {t('tts.unsupportedBody')}
        </span>
      )}
    </div>
  );
}

/**
 * A full-width "read this whole section" bar. Used above long explanations
 * where a small speaker icon next to each line would be noise.
 */
export function SpeakSection({ text, id, label, lang, className = '' }) {
  const { t } = useSettings();
  const { toggle, isSpeaking, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();
  const active = isSpeaking(id);

  if (!text) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => ttsSupported && toggle(text, { id, lang })}
        aria-pressed={active}
        aria-label={label || t('common.speak')}
        className={[
          'inline-flex min-h-touch items-center gap-3 rounded-pill border-4 px-5 py-3 text-lg font-bold shadow-card transition',
          active
            ? 'border-primary-700 bg-primary-700 text-white'
            : 'border-primary-200 bg-surface text-primary-800 hover:border-primary-400',
        ].join(' ')}
      >
        {ttsSupported ? (
          <SpeakerIcon className="w-7 h-7 shrink-0" />
        ) : (
          <HelpIcon className="w-7 h-7 shrink-0" />
        )}
        <span>{active ? t('common.stopSpeaking') : label || t('common.speak')}</span>
      </button>
      {active && !reduceMotion && <SpeakingWave />}
    </div>
  );
}

/** Three animated bars. A visual "voice is playing" indicator. */
export function SpeakingWave({ className = '' }) {
  return (
    <span className={`flex items-end gap-1 ${className}`} aria-hidden="true">
      <span className="h-5 w-2 origin-bottom animate-wave-1 rounded-full bg-calm-600" />
      <span className="h-8 w-2 origin-bottom animate-wave-2 rounded-full bg-calm-600" />
      <span className="h-4 w-2 origin-bottom animate-wave-3 rounded-full bg-calm-600" />
    </span>
  );
}
