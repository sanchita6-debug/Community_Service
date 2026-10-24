/**
 * LanguageSelector
 * ============================================================================
 *
 * A native <select>, deliberately. A custom dropdown built from divs would look
 * prettier but is hostile to the people this app is for: screen readers, voice
 * control, and anyone with a tremor who struggles to hit a 24px target. The
 * native picker on Android and iOS is also spoken aloud in the user's own
 * language, which is exactly what we want.
 */
import { GlobeIcon } from './icons.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import { LANGUAGES, getCoverage, createTranslator } from '../i18n/index.js';

export default function LanguageSelector({ variant = 'full', className = '' }) {
  const { t, language, setLanguage } = useSettings();
  const { speak, ttsSupported } = useSpeech();

  function handleChange(event) {
    const next = event.target.value;
    setLanguage(next);
    // Speak a hello in the new language immediately, so the user hears that it
    // worked without having to navigate somewhere else to find out. The
    // greeting is built from the NEW language's bundle - speaking the old
    // language's hello would prove nothing.
    if (ttsSupported) {
      const tNext = createTranslator(next);
      speak(tNext('greetings.hello'), { id: 'lang-preview', lang: next });
    }
  }

  if (variant === 'compact') {
    // A labelled icon button used in the header.
    return (
      <div className={`relative ${className}`}>
        <label className="sr-only" htmlFor="language-compact">
          {t('common.language')}
        </label>
        <GlobeIcon className="pointer-events-none absolute left-3 top-1/2 w-6 h-6 -translate-y-1/2 text-ink-soft" />
        <select
          id="language-compact"
          value={language}
          onChange={handleChange}
          className="min-h-touch w-auto appearance-none rounded-card border-4 border-primary-200 bg-surface py-2 pl-11 pr-8 text-lg font-bold text-ink focus:border-primary-600"
        >
          {Object.values(LANGUAGES).map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor="language-full" className="mb-2 block text-lg font-extrabold text-ink">
        {t('common.language')}
      </label>
      <div className="relative">
        <GlobeIcon className="pointer-events-none absolute left-4 top-1/2 w-7 h-7 -translate-y-1/2 text-primary-800" />
        <select
          id="language-full"
          value={language}
          onChange={handleChange}
          className="field appearance-none pl-14 pr-12"
        >
          {Object.values(LANGUAGES).map((l) => {
            const coverage = getCoverage(l.code);
            return (
              <option key={l.code} value={l.code}>
                {l.nativeLabel} ({l.label})
                {coverage < 100 ? ` — ${coverage}%` : ''}
              </option>
            );
          })}
        </select>
        <span
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
    </div>
  );
}


