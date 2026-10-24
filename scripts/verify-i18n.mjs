/**
 * Every key the running app can emit must resolve in the base language, or a
 * person who most needs clear words is shown a raw key like "facts.wentOut".
 *
 * NOTE: literal `t('...')` calls are scanned below, but a key that is only ever
 * produced at runtime - `mapAuthError` in lib/localAuth.js returns
 * `family.errors.*` strings that no component ever passes to t() directly - is
 * invisible to this scan. Those are maintained by hand and are why en.json is
 * also reviewed on every auth change.
 *
 * Keys are collected by actually RUNNING the parser, rule engine and demo data
 * rather than by listing them here, so this cannot drift out of date and pass.
 *
 * Run: node scripts/verify-i18n.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { explainTransaction } from '../shared/transactionParser.js';
import { listRulesForDisplay } from '../shared/scamRules.js';
import { SAMPLE_SMS, PRACTICE_MESSAGES, LESSONS } from '../shared/demoData.js';

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'src', 'i18n');

const load = (lang) => JSON.parse(readFileSync(join(i18nDir, `${lang}.json`), 'utf8'));

/** Every .jsx under a directory, skipping nothing - i18n has no node_modules. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.jsx')) out.push(p);
  }
  return out;
}

function has(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict) !== undefined;
}

const keys = new Set();
const add = (k) => typeof k === 'string' && k.includes('.') && keys.add(k);

/* ---- Parser: summary + fact keys, exercised across every branch ----------- */

// Chosen to reach each branch of explainTransaction: debit, credit, both
// unknown, amount-only, and the date variants.
const CORPUS = [
  ...SAMPLE_SMS.map((s) => s.text),
  ...PRACTICE_MESSAGES.map((m) => m.text),
  'Rs.500 has been debited from your account.',
  'Rs.7500 has been credited to your account.',
  'Rs.300 transaction, reference 123456789012.',
  'Rs.5,000 will be received in your account tomorrow.',
  'Your UPI transaction of Rs.2,000 to Suresh Kumar was FAILED.',
  'Rs.900 debited towards UPI payment to Amit Verma (VPA amit@okhdfc). UPI Ref No. 523412345678',
  'Rs.400 debited yesterday via NEFT from Dr. Anita Rao. Ref No. 556677889900',
  'Rs.1,20,000 credited by SBI on 12-09-2025 towards salary from Sunrise Textiles.',
  'OTP 482913 is valid for 10 minutes. Do not share it with anyone. - HDFC Bank',
  '',
];

for (const text of CORPUS) {
  const r = explainTransaction(text);
  add(r.summaryKey);
  for (const fact of r.facts || []) add(fact.key);
  for (const m of r.missing || []) add(m);
}
// Status wordings surfaced in the facts list.
for (const st of ['success', 'failed', 'pending', 'unknown']) add(`facts.status.${st}`);
// Date wordings.
for (const w of ['today', 'yesterday', 'justNow', 'onDate']) add(`when.${w}`);

/* ---- Rule engine: every rule, its three strings, and safe-signal labels ----- */

for (const rule of listRulesForDisplay()) {
  add(rule.titleKey);
  add(rule.explanationKey);
  add(rule.safeActionKey);
  for (const sig of rule.signals || []) add(sig.labelKey);
}

/* ---- Demo content: lessons, quiz options, practice, samples, payees ------- */

for (const l of LESSONS) {
  add(l.titleKey);
  for (const s of l.steps || []) add(s.key);
  if (l.quiz) {
    add(l.quiz.questionKey);
    for (const o of l.quiz.options || []) add(o.key);
  }
}
for (const m of PRACTICE_MESSAGES) add(m.correctKey);
for (const s of SAMPLE_SMS) add(s.labelKey);

/* ---- Components: every literal t('...') in the JSX ------------------------ */

// The code above only covers keys emitted by shared/. Literal t() calls in the
// components are the other half of what the UI can ask for, and a typo in one
// of them shows the user a raw key instead of words.
const clientSrc = join(i18nDir, '..');
const jsxFiles = walk(clientSrc);
for (const file of jsxFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) add(m[1]);
}

/* ---- Dynamic keys: only ever reach t() through a variable ------------------ */

// LanguageSelector greets in the NEW language via createTranslator(next), so
// the scanner's `t('...')` regex never sees the key. `languageNames.${code}`
// is built the same way in Settings and Family Helper. Maintained by hand, as
// the file header warns.
add('greetings.hello');
for (const code of ['en', 'hi', 'ta', 'te', 'bn']) add(`languageNames.${code}`);

// The check results answer in the language of the checked message, so their
// small piece of app chrome (the region's aria label and the speaker button
// labels) is bound to the UI language through a second translator named
// `uiT(...)`, which this regex does not match either. Hand-listed for the
// same reason: a typo would show the user a raw key instead of words.
add('safety.resultTitle');
add('safety.speakVerdict');
add('explain.speakResult');

const list = [...keys].sort();
const LANGS = readdirSync(i18nDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

let failed = false;

console.log(`\n${list.length} runtime keys derived from live code, checked against: ${LANGS.join(', ')}`);

for (const lang of LANGS) {
  const dict = load(lang);
  const missing = list.filter((k) => !has(dict, k));
  const done = list.length - missing.length;

  if (missing.length === 0) {
    console.log(`  PASS  ${lang.padEnd(4)} ${done}/${list.length}`);
  } else if (lang === 'en') {
    failed = true;
    console.log(`  FAIL  ${lang.padEnd(4)} ${done}/${list.length} - missing:`);
    for (const k of missing) console.log(`          ${k}`);
  } else {
    // Partial bundles are intentional: the translator falls back to English.
    console.log(`  info  ${lang.padEnd(4)} ${done}/${list.length} - rest fall back to English`);
  }
}

console.log(
  failed
    ? '\nThe base language is incomplete - fix before shipping.\n'
    : '\nBase language is complete; other languages fall back to English as designed.\n'
);

/* ---------------------------------------------------------------------------
   Guard: no screen may read the rule engine's English sentences directly.

   The engine ships both `explanationKey` and an English `explanation` on every
   rule, and only the key goes through `t()`. Every screen used the English one,
   so a Tamil or Telugu user got a translated verdict followed by an English
   explanation of it - both on screen and, worse, spoken aloud. Nothing else in
   this file would have caught it, because the English strings are perfectly
   valid English.

   Checked by scanning the JSX, since the leak is a missing `t()` call and is
   invisible to key-coverage counting.
   ---------------------------------------------------------------------- */
const LEAKS = [
  { re: /\{\s*(?:rule|[a-z]+\.matchedRules\[[^\]]*\])\.(?:explanation|safeAction|title)\s*\}/, why: 'rule English string' },
  { re: /\{\s*s\.label\s*\}/, why: 'signal English label' },
  // Not brace-anchored: these appear spread into an array as
  // `...(result.reasons || [])`, which has a paren after the dot, not a brace.
  { re: /\b(?:result|safety)\.reasons\b/, why: 'safety.reasons is English' },
  { re: /\bresult\.recommendedActions\b/, why: 'result.recommendedActions is English' },
];

const leaks = [];
for (const file of jsxFiles) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    // Comments explain the rules; only executable lines can leak.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    for (const { re, why } of LEAKS) {
      if (re.test(line)) leaks.push(`  ${file}:${i + 1} ${why}\n      ${trimmed}`);
    }
  });
}

if (leaks.length === 0) {
  console.log('  PASS  no screen reads rule text without t()');
} else {
  failed = true;
  console.log(`  FAIL  ${leaks.length} place(s) bypass translation:`);
  for (const l of leaks) console.log(l);
}

process.exit(failed ? 1 : 0);
