/**
 * ============================================================================
 * Voice selection and feature detection
 * ============================================================================
 *
 * Split out of i18n/index.js because none of this needs a translation bundle.
 * Keeping it free of the JSON imports is what lets `npm run verify:voice` load
 * it under plain node to test it, and it is the honest dependency graph anyway:
 * choosing a voice is a browser concern, not a translation concern.
 *
 * Re-exported from i18n/index.js, so every existing import path still works.
 */

export const LANGUAGES = {
  en: { code: 'en', label: 'English', nativeLabel: 'English', bcp47: 'en-IN' },
  hi: { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', bcp47: 'hi-IN' },
  ta: { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', bcp47: 'ta-IN' },
  te: { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', bcp47: 'te-IN' },
  bn: { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', bcp47: 'bn-IN' },
};

/**
 * Voice names we prefer, in order, for each language.
 *
 * These are only ever used to break ties between voices that ALREADY speak the
 * requested language - never to find a voice in the first place. That
 * distinction matters: this list used to name "Microsoft Swara" under en, ta
 * and te as well as hi. Swara is a Hindi-only Windows voice, and matching on
 * the name alone meant a Tamil or Telugu screen was read aloud by a Hindi
 * voice, which is unintelligible rather than merely accented.
 *
 * Neerja leads the English list because it is the Indian-English voice on
 * Windows, and matching the user's own accent is worth more than a generic one.
 */
const VOICE_HINTS = {
  en: ['Microsoft Neerja', 'Google India English', 'Google US English', 'Microsoft Zira', 'Samantha'],
  hi: ['Google हिन्दी', 'Lekha', 'Microsoft Swara', 'Swara', 'हिन्दी'],
  ta: ['Lekha', 'தமிழ்', 'Tamil'],
  te: ['Lekha', 'తెలుగు', 'Telugu'],
  bn: ['Sutapa', 'Google বাংলা', 'Microsoft Hemant', 'Hemant', 'বাংলা'],
};

/**
 * Picks the best speech-synthesis voice for a language.
 *
 * The rule that matters: a voice is only ever a candidate if its own language
 * tag already matches the language we asked for. Name hints may then choose
 * between two voices of the RIGHT language, but may never drag in a voice from
 * another one.
 *
 * Returns null when the device genuinely has no voice for the language. Callers
 * must treat that as a real answer, not a reason to fall back to English: an
 * English voice reading Tamil script is gibberish, and silence is honest where
 * gibberish is not.
 *
 * @param {string} lang
 * @param {SpeechSynthesisVoice[]} voices
 * @returns {SpeechSynthesisVoice|null}
 */
export function pickVoice(lang, voices) {
  if (!voices || voices.length === 0) return null;

  const target = (LANGUAGES[lang]?.bcp47 || lang).toLowerCase();
  const base = target.split('-')[0];
  const baseOf = (v) => v.lang.toLowerCase().split('-')[0];

  // Within one tier, prefer a voice we recognise by name. This has to run per
  // tier rather than once at the end: two voices can both be exactly ta-IN, in
  // which case the locale test cannot separate them and the name is the only
  // signal left.
  const preferred = (candidates) => {
    for (const hint of VOICE_HINTS[lang] || []) {
      const h = hint.toLowerCase();
      const match = candidates.find((v) => v.name.toLowerCase().includes(h));
      if (match) return match;
    }
    return candidates[0];
  };

  // 1. Exact locale, e.g. ta-IN. The strongest signal: the device was built
  //    for this locale, so its voice is the intended one.
  const exact = voices.filter((v) => v.lang.toLowerCase() === target);
  if (exact.length > 0) return preferred(exact);

  // 2. Any voice for the same language. A 'ta-IN' request is served fine by a
  //    'ta-LK' voice or a bare 'ta', so a different region must not block it.
  const sameLanguage = voices.filter((v) => baseOf(v) === base);
  if (sameLanguage.length > 0) return preferred(sameLanguage);

  // 3. Nothing for this language. Say so rather than borrowing another one.
  return null;
}

/**
 * True when the device has a voice that can actually read this language.
 *
 * Settings uses this to warn the user up front. On Windows, Tamil, Telugu and
 * Bengali each need a language pack installed, and finding that out by hearing
 * Hindi gibberish is a miserable way to learn it.
 */
export function hasVoiceFor(lang, voices) {
  return pickVoice(lang, voices) !== null;
}

/** True when the device has a working text-to-speech engine. */
export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** True when the device has a working speech-recognition engine. */
export function isSttSupported() {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/**
 * Guesses which supported language a piece of TEXT is written in, by script.
 *
 * Needed because some content the app reads aloud is not in the UI language:
 * practice SMS, pasted bank messages and OCR output are almost always Latin
 * script, even for a Tamil UI. Reading Latin text with a Tamil voice is poor;
 * reading it with an English voice is natural. Conversely a Devanagari or
 * Tamil message should keep its own script's voice whatever the UI says.
 *
 * Latin text maps to 'en' because among our five languages only English uses
 * the Latin script. Digits and punctuation alone carry no signal, so they fall
 * back to the caller's language (the UI default).
 *
 * @param {string} text
 * @param {string} [fallback='en'] language to use when the script is unknown
 * @returns {string} one of the SUPPORTED language codes
 */
export function detectTextLang(text, fallback = 'en') {
  const s = String(text || '');
  if (!s.trim()) return fallback;

  // Checked in this order so a mixed-script string resolves to the script a
  // reader would name first (Hindi SMS often embed English bank names, and
  // must still be read as Hindi).
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  if (/[\u0B80-\u0BFF]/.test(s)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(s)) return 'te';
  if (/[\u0980-\u09FF]/.test(s)) return 'bn';
  if (/[A-Za-z]/.test(s)) return 'en';
  return fallback;
}
