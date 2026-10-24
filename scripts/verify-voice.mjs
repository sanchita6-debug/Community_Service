/**
 * Voice selection and speech engine tests.
 *
 * `pickVoice()` decides which of the device's voices reads the screen. It
 * shipped a bug where a Tamil screen was read by a Hindi-only voice, which is
 * not something a lint rule or a smoke test would ever catch - you only find
 * out by listening to it. So it gets its own suite.
 *
 * The suite covers both halves of that choice: picking the right voice from a
 * list, and the engine handing `pickVoice()` a list worth reading - the second
 * half being the fix for English-only speech in Chrome and Edge, whose online
 * Indic voices arrive after the first `voiceschanged` event.
 *
 * Runs under plain node, no test framework: `npm run verify:voice`.
 */
import { pickVoice, hasVoiceFor, LANGUAGES } from '../client/src/i18n/voices.js';

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got=${JSON.stringify(actual)}  want=${JSON.stringify(expected)}`);
  }
}

/** A stand-in for SpeechSynthesisVoice; pickVoice only reads name and lang. */
const v = (name, lang) => ({ name, lang });

/* -------------------------------------------------------------------------
   The bug this suite exists for.
   ---------------------------------------------------------------------- */
check(
  'tamil never picks a hindi-only voice (Microsoft Swara)',
  pickVoice('ta', [v('Microsoft Swara', 'hi-IN'), v('Microsoft Zira', 'en-US')])?.name,
  undefined
);

check(
  'telugu never picks a hindi-only voice (Microsoft Swara)',
  pickVoice('te', [v('Microsoft Swara', 'hi-IN')])?.name,
  undefined
);

check(
  'english never picks a hindi-only voice (Microsoft Swara)',
  pickVoice('en', [v('Microsoft Swara', 'hi-IN'), v('Lekha', 'ta-IN')])?.name,
  undefined
);

/* -------------------------------------------------------------------------
   Normal matching
   ---------------------------------------------------------------------- */
check(
  'exact locale wins',
  pickVoice('ta', [v('Generic Tamil', 'ta'), v('Google Tamil', 'ta-IN')])?.name,
  'Google Tamil'
);

check(
  'a different region of the same language still matches',
  pickVoice('ta', [v('Tamil Sri Lanka', 'ta-LK')])?.name,
  'Tamil Sri Lanka'
);

check(
  'a bare language tag matches',
  pickVoice('hi', [v('Generic Hindi', 'hi')])?.name,
  'Generic Hindi'
);

check(
  'prefers the hinted voice among several of the same language',
  pickVoice('ta', [v('Generic Tamil', 'ta-IN'), v('Lekha', 'ta-IN')])?.name,
  'Lekha'
);

check(
  'falls back to any same-language voice when no hint matches',
  pickVoice('bn', [v('Bengali Voice', 'bn-IN')])?.name,
  'Bengali Voice'
);

/* -------------------------------------------------------------------------
   No voice available - must be null, never a wrong-language voice
   ---------------------------------------------------------------------- */
check('bengali with no bengali voice returns null', pickVoice('bn', [v('Microsoft Zira', 'en-US')]), null);
check('tamil with no tamil voice returns null', pickVoice('ta', [v('Microsoft Swara', 'hi-IN')]), null);
check('empty voice list returns null', pickVoice('ta', []), null);
check('undefined voice list returns null', pickVoice('ta', undefined), null);
check('unknown language code returns null', pickVoice('xx', [v('English', 'en-US')]), null);

/* -------------------------------------------------------------------------
   The real-world device mix
   ---------------------------------------------------------------------- */
const windows = [
  v('Microsoft David Desktop', 'en-US'),
  v('Microsoft Zira Desktop', 'en-US'),
  v('Microsoft Swara Desktop', 'hi-IN'),
  v('Microsoft Hemant Desktop', 'hi-IN'),
];
check('windows: english picks an english voice', pickVoice('en', windows)?.lang, 'en-US');
check('windows: hindi picks Swara or Hemant', /^hi-IN$/.test(pickVoice('hi', windows)?.lang || ''), true);
check('windows: tamil has no voice and says so', hasVoiceFor('ta', windows), false);
check('windows: telugu has no voice and says so', hasVoiceFor('te', windows), false);

const android = [
  v('Google US English', 'en-US'),
  v('Google हिन्दी', 'hi-IN'),
  v('Google தமிழ்', 'ta-IN'),
  v('Google తెలుగు', 'te-IN'),
  v('Google বাংলা', 'bn-IN'),
];
for (const code of ['en', 'hi', 'ta', 'te', 'bn']) {
  check(`android: ${code} has a voice`, hasVoiceFor(code, android), true);
  check(
    `android: ${code} picks its own language`,
    pickVoice(code, android)?.lang.split('-')[0],
    code
  );
}

/* -------------------------------------------------------------------------
   Every supported language must have a sane BCP-47 tag, because both TTS and
   STT now resolve through LANGUAGES[code].bcp47.
   ---------------------------------------------------------------------- */
for (const [code, meta] of Object.entries(LANGUAGES)) {
  check(`${code} has a bcp47 tag`, /^([a-z]{2})-([A-Z]{2})$/.test(meta.bcp47), true);
  check(`${code} bcp47 base matches its code`, meta.bcp47.split('-')[0], code);
}

/* -------------------------------------------------------------------------
   The engine: voices that arrive LATE still have to be used.
   ----------------------------------------------------------------------
   pickVoice() is pure, so it can only be as correct as the list it is handed.
   This half of the suite covers the other half of the bug: Chrome and Edge
   announce their voices in more than one batch, and on a stock Windows laptop
   the only Indic voices are online ones that show up in the SECOND batch.
   The engine used to freeze the first batch for the life of the page, so
   English always spoke and Hindi, Tamil, Telugu and Bengali were silent.

   speech.js is imported (not voices.js) so the real speak() path is exercised.
   ---------------------------------------------------------------------- */

/** Stands in for window.speechSynthesis. */
class FakeSynth {
  constructor(voices = []) {
    this._voices = voices;
    this.listeners = new Set();
    /** Every utterance the engine was asked to say, in order. */
    this.queue = [];
    this.speaking = false;
    this.paused = false;
    this.cancelCount = 0;
  }

  addEventListener(type, fn) {
    if (type === 'voiceschanged') this.listeners.add(fn);
  }

  removeEventListener(type, fn) {
    this.listeners.delete(fn);
  }

  getVoices() {
    return this._voices;
  }

  /** The browser announcing another batch of voices. */
  announce(voices) {
    this._voices = voices;
    this.listeners.forEach((fn) => fn());
  }

  cancel() {
    this.cancelCount += 1;
    this.speaking = false;
  }

  speak(utterance) {
    this.queue.push(utterance);
    this.speaking = true;
    setTimeout(() => {
      this.speaking = false;
      utterance.onend?.();
    }, 0);
  }
}

globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
  }
};

const { tts } = await import('../client/src/lib/speech.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wires the singleton to a fresh fake engine, as the constructor would. */
function useSynth(voices) {
  const synth = new FakeSynth(voices);
  tts.supported = true;
  tts.synth = synth;
  tts.voices = [];
  tts._voiceWaiters.clear();
  tts.stop(); // reset state and the 120ms post-cancel cooldown
  tts._watchVoices();
  return synth;
}

// The English-only first batch a Windows laptop hands over at page load.
const FIRST_BATCH = [
  v('Microsoft David Desktop', 'en-US'),
  v('Microsoft Zira Desktop', 'en-US'),
];
// What arrives a beat later once the browser is online.
const SECOND_BATCH = [
  ...FIRST_BATCH,
  v('Microsoft Swara Online (Natural)', 'hi-IN'),
  v('Google தமிழ்', 'ta-IN'),
  v('Google తెలుగు', 'te-IN'),
  v('Google বাংলা', 'bn-IN'),
];

{
  const synth = useSynth(FIRST_BATCH);
  const pending = tts.speak('नमस्ते दोस्त', { lang: 'hi', id: 'second-batch' });
  await sleep(200); // past the cooldown, inside the voice wait
  check('a missing language waits instead of guessing', synth.queue.length, 0);
  synth.announce(SECOND_BATCH);
  check('hindi from the second batch speaks', await pending, 'done');
  check('hindi uses the online voice', synth.queue.at(-1)?.voice?.name, 'Microsoft Swara Online (Natural)');
  check('utterance lang follows the voice', synth.queue.at(-1)?.lang, 'hi-IN');
}

for (const [code, text] of [
  ['ta', 'வணக்கம் நண்பரே'],
  ['te', 'నమస్కారం మిత్రమా'],
  ['bn', 'নমস্কার বন্ধু'],
]) {
  const synth = useSynth(FIRST_BATCH);
  const pending = tts.speak(text, { lang: code, id: `late-${code}` });
  await sleep(200);
  synth.announce(SECOND_BATCH);
  check(`${code} from the second batch speaks`, await pending, 'done');
  check(
    `${code} uses its own language voice`,
    synth.queue.at(-1)?.voice?.lang.split('-')[0],
    code
  );
}

{
  // English is in the first batch, so it must not pay the wait.
  const synth = useSynth(FIRST_BATCH);
  const started = Date.now();
  const result = await tts.speak('Hello, your account is safe.', { lang: 'en', id: 'english' });
  check('english still speaks', result, 'done');
  check('english does not wait for a late batch', Date.now() - started < 1000, true);
}

{
  // A device that will never have the language: honest silence, not gibberish.
  const synth = useSynth(FIRST_BATCH);
  const result = await tts.speak('வணக்கம் நண்பரே', { lang: 'ta', id: 'never' });
  check('a language with no voice at all reports no-voice', result, 'no-voice');
  check('nothing is spoken with the wrong voice', synth.queue.length, 0);
}

{
  // stop() while a speak() is still waiting for its voice must win.
  const synth = useSynth(FIRST_BATCH);
  const pending = tts.speak('नमस्ते दोस्त', { lang: 'hi', id: 'stopped' });
  await sleep(200);
  tts.stop();
  synth.announce(SECOND_BATCH);
  check('stop during the voice wait wins', await pending, 'stopped');
  check('no late utterance after stop', synth.queue.length, 0);
}

tts.stop();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
