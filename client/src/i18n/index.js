/**
 * ============================================================================
 * i18n engine
 * ============================================================================
 *
 * Three jobs, kept deliberately small so it can be reasoned about:
 *
 *  1. LOAD      - pick the active language, keep English as the base layer.
 *  2. LOOKUP    - `t('send.payeeLabel')`, with automatic English fallback so a
 *                 partially translated language (Tamil, Telugu, Bengali) is
 *                 never broken - it just shows English for missing keys.
 *  3. TEMPLATE  - `t('summary.debit', { amount: '₹500', who: 'Ramesh' })`
 *                 which fills `{placeholders}` in the sentence.
 *
 * The rule engine and the SMS parser return KEYS, not sentences. That is why
 * a RED warning can be read aloud in Telugu without a single line of parsing
 * code knowing about Telugu.
 */
import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';
import te from './te.json';
import bn from './bn.json';

// Language metadata and voice selection need none of the translation bundles,
// so they live in ./voices.js and are re-exported here to keep every existing
// import path working.
import { LANGUAGES } from './voices.js';

export {
  LANGUAGES,
  pickVoice,
  hasVoiceFor,
  isTtsSupported,
  isSttSupported,
  detectTextLang,
} from './voices.js';

export const SUPPORTED = Object.keys(LANGUAGES);
export const BASE_LANGUAGE = 'en';

const BUNDLES = { en, hi, ta, te, bn };

/** Walks a dotted path, e.g. 'send.steps' or 'facts.status.success'. */
function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

/** Fills `{name}` placeholders and collapses the extra spaces they leave. */
function interpolate(template, vars) {
  if (typeof template !== 'string') return template;
  if (!vars) return template;
  return template
    .replace(/\{(\w+)\}/g, (match, name) => {
      const value = vars[name];
      return value === undefined || value === null || value === '' ? '' : String(value);
    })
    // "was sent to Ramesh ." -> "was sent to Ramesh."
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Builds the translation function for one language.
 *
 * @param {string} lang
 * @returns {(key: string, vars?: object, fallback?: string) => string}
 */
export function createTranslator(lang) {
  const active = BUNDLES[lang] ? lang : BASE_LANGUAGE;
  const bundle = BUNDLES[active];

  return function t(key, vars, fallback) {
    if (!key) return '';

    // 1. Try the active language.
    let value = getPath(bundle, key);

    // 2. Fall back to English. This is what makes partial languages safe.
    if (value === undefined || value === null || value === '') {
      value = getPath(BUNDLES[BASE_LANGUAGE], key);
    }

    // 3. Still nothing? Use the caller's fallback, then the key itself so a
    //    missing string is visible in the UI instead of rendering as blank.
    if (value === undefined || value === null || value === '') {
      value = fallback ?? key;
    }

    // A key that points at an array (e.g. send.steps) is a programming error
    // for `t()`; return it so the caller can decide.
    if (Array.isArray(value)) return value;

    return interpolate(value, vars);
  };
}

/** Coverage percentage, shown in the language selector as a progress hint. */
export function getCoverage(lang) {
  const base = BUNDLES[BASE_LANGUAGE];
  let total = 0;
  let have = 0;
  const walk = (obj, target, path) => {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value, getPath(target, `${path}${path ? '.' : ''}${key}`), `${path}${path ? '.' : ''}${key}`);
      } else {
        total += 1;
        const mine = target ? getPath(target, `${path}${path ? '.' : ''}${key}`) : undefined;
        if (mine !== undefined && mine !== '') have += 1;
      }
    }
  };
  walk(base, BUNDLES[lang], '');
  return total ? Math.round((have / total) * 100) : 0;
}
