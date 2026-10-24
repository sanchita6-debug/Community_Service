/**
 * ============================================================================
 * Speech engine - text to speech (TTS) and speech to text (STT)
 * ============================================================================
 *
 * DESIGN NOTES
 * ------------
 * VoicePay's whole value is that the user never has to read a wall of text.
 * So the speech layer is a first-class service, not a browser detail:
 *
 *  - ONE global queue. If the user taps speaker on a new section, the previous
 *    speech is cancelled first. Two voices talking over each other is
 *    unusable for a partially deaf or elderly user.
 *  - Chrome quirk: speechSynthesis goes silent if you `cancel()` and then
 *    `speak()` within a very short window. We work around it with a small
 *    cooldown, and also a "resume pump" that keeps long utterances alive.
 *  - Every failure is a STATE, not a thrown error, so the UI can show a kind
 *    message and offer the text on screen instead.
 *
 * Both APIs are optional. When either is missing the app still works fully -
 * it just asks people to read and type.
 */
// Imported from voices.js rather than the i18n barrel: picking a voice needs no
// translation bundle, and this way the voice logic stays loadable under plain
// node for `npm run verify:voice`.
import { pickVoice, isTtsSupported, LANGUAGES } from '../i18n/voices.js';

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/* -------------------------------------------------------------------------- */
/* Text to speech                                                              */
/* -------------------------------------------------------------------------- */

class TtsService {
  constructor() {
    this.supported = isTtsSupported();
    this.synth = this.supported ? window.speechSynthesis : null;
    this.voices = [];
    this.currentUtterance = null;
    /** Unique id of whatever is speaking right now (null when idle). */
    this.speakingId = null;
    this.listeners = new Set();
    /** Callbacks of callers waiting for a voice that can read their language. */
    this._voiceWaiters = new Set();
    /**
     * Bumped by every speak() and every stop(). A speak() that spent time
     * waiting for voices checks its own number afterwards: if it moved, the
     * user pressed stop (or another speaker) while it waited, and it must not
     * start talking late.
     */
    this._epoch = 0;
    this._cooldownUntil = 0;
    this._pumpTimer = null;
    if (this.supported) this._watchVoices();
  }

  /**
   * Keeps `this.voices` fresh for the whole life of the page.
   *
   * Chrome and Edge fire `voiceschanged` MORE THAN ONCE, and the languages this
   * app needs are usually missing from the first batch. A stock Windows laptop
   * only has English SAPI voices; the Hindi, Tamil, Telugu and Bengali ones are
   * online voices ("Google हिन्दी", "Microsoft Swara Online (Natural)") that
   * arrive in a LATER event. The old code listened with `{ once: true }` and
   * froze the first snapshot for good, so English always spoke while every
   * other language answered 'no-voice' - which in the UI is silence. Listening
   * for every event is what makes those languages work at all.
   */
  _watchVoices() {
    const refresh = () => this._refreshVoices();
    if (typeof this.synth.addEventListener === 'function') {
      this.synth.addEventListener('voiceschanged', refresh);
    } else {
      // Older Safari only exposes the property.
      this.synth.onvoiceschanged = refresh;
    }
    this._refreshVoices();
  }

  /**
   * Reads the current voice list and wakes anyone waiting on it.
   * An empty read means "not loaded yet", so an earlier list is kept.
   */
  _refreshVoices() {
    const list = this.synth.getVoices() || [];
    if (list.length === 0) return;
    this.voices = list;
    this._voiceWaiters.forEach((waiter) => waiter());
  }

  /**
   * The best voice for `lang`, or null.
   *
   * The wait is bounded rather than skipped, because the voice that can read
   * this language typically turns up a beat after the first batch. It resolves
   * EARLY the moment a matching voice appears, so the common case never waits;
   * the full timeout is only paid when the device genuinely has no voice for
   * the language.
   *
   * @param {string} lang 'en' | 'hi' | 'ta' | 'te' | 'bn'
   * @param {number} [timeout=2500] ms to wait for a matching voice
   * @returns {Promise<SpeechSynthesisVoice|null>}
   */
  _voiceFor(lang, timeout = 2500) {
    if (!this.supported) return Promise.resolve(null);

    // The engine's list can grow between two speaks without anything we did;
    // never answer from a snapshot staler than its own view.
    const known = this.synth.getVoices() || [];
    if (known.length > 0) this.voices = known;

    const pick = () => pickVoice(lang, this.voices);
    const found = pick();
    if (found || timeout <= 0) return Promise.resolve(found);

    return new Promise((resolve) => {
      let timer = null;
      let waiter = null;
      const done = () => {
        clearTimeout(timer);
        if (waiter) this._voiceWaiters.delete(waiter);
        resolve(pick());
      };
      waiter = () => {
        if (pick()) done();
      };
      timer = setTimeout(done, timeout);
      this._voiceWaiters.add(waiter);
    });
  }

  /** Subscribe to speaking-state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(state) {
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.warn('[tts] listener failed:', err);
      }
    });
  }

  /**
   * Speaks text in the given language.
   *
   * @param {string} text
   * @param {object} [options]
   * @param {string} [options.lang]      'en' | 'hi' | 'ta' | 'te' | 'bn'
   * @param {number} [options.rate]      0.5 - 1.5, slower for elderly users
   * @param {string} [options.id]        an id so only this source can stop it
   * @param {boolean} [options.interrupt] stop whatever is currently speaking
   * @returns {Promise<'started'|'stopped'|'unsupported'|'empty'|'no-voice'>}
   */
  async speak(text, options = {}) {
    const { lang = 'en', rate = 0.9, id = null, interrupt = true } = options;

    if (!this.supported) {
      this._emit({ speaking: false, id: null, unsupported: true });
      return 'unsupported';
    }

    const clean = String(text || '')
      // Emoji and symbols confuse most TTS engines; read them as nothing.
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
      // U+FE0F (variation selector) and U+200D (zero-width joiner) are combining
      // marks, not standalone symbols. They are removed on their own rather
      // than inside the class above, because a combining mark inside a
      // character class makes the whole range ambiguous.
      .replace(/\u{FE0F}/gu, '')
      .replace(/\u{200D}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return 'empty';

    if (interrupt) this.stop();
    const mine = ++this._epoch;

    // Chrome needs a moment after cancel() before a new speak() is honoured.
    const wait = Math.max(0, this._cooldownUntil - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    // Waiting can take a couple of seconds while the browser finishes loading
    // its voices. If the user pressed stop - or another speaker took over -
    // during that window, talking now would be talking over them.
    const voice = await this._voiceFor(lang);
    if (mine !== this._epoch) return 'stopped';

    const utterance = new SpeechSynthesisUtterance(clean);

    if (voice) {
      utterance.voice = voice;
      // Take the tag from the voice we actually chose, not from the code we
      // asked for. If the device answered a 'ta-IN' request with a bare 'ta'
      // voice, saying 'ta-IN' alongside it leaves the engine second-guessing.
      utterance.lang = voice.lang;
    } else {
      // No voice for this language. Speaking anyway would hand the text to
      // whatever default voice the OS picked - usually English - and Tamil
      // script read by an English voice is unintelligible. Reporting the gap
      // lets the caller tell the user why, instead of pretending it worked.
      this._emit({ speaking: false, id: null, noVoice: lang });
      return 'no-voice';
    }
    utterance.rate = Math.min(1.5, Math.max(0.5, rate));
    utterance.pitch = 1;
    utterance.volume = 1;

    this.currentUtterance = utterance;
    this.speakingId = id;
    this._emit({ speaking: true, id, text: clean });

    return new Promise((resolve) => {
      const finish = (result) => {
        // Only clear state if this utterance is still the active one; a
        // cancelled-then-replaced utterance fires late and must not win.
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
          this.speakingId = null;
          this._emit({ speaking: false, id: null });
          this._stopPump();
        }
        resolve(result);
      };

      utterance.onend = () => finish('done');
      utterance.onerror = (ev) => {
        // 'interrupted' / 'canceled' are the expected errors when we call stop().
        if (ev?.error === 'interrupted' || ev?.error === 'canceled') return finish('stopped');
        console.warn('[tts] utterance error:', ev?.error);
        finish('error');
      };

      this._startPump();
      this.synth.speak(utterance);
    });
  }

  /**
   * Chrome pauses synthesis if the tab is backgrounded or after ~15s on some
   * builds. This periodic resume is the widely used workaround.
   */
  _startPump() {
    this._stopPump();
    this._pumpTimer = setInterval(() => {
      if (!this.supported) return;
      if (this.synth.speaking && !this.synth.paused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 9000);
  }

  _stopPump() {
    if (this._pumpTimer) {
      clearInterval(this._pumpTimer);
      this._pumpTimer = null;
    }
  }

  /** Stops speech immediately and blocks a rapid re-speak for ~120ms. */
  stop() {
    if (!this.supported) return;
    try {
      this.synth.cancel();
    } catch {
      /* ignore */
    }
    this._stopPump();
    this.currentUtterance = null;
    this.speakingId = null;
    // Invalidate any speak() still waiting for its voice, so it cannot start
    // talking after the user asked for quiet.
    this._epoch += 1;
    this._cooldownUntil = Date.now() + 120;
    this._emit({ speaking: false, id: null });
  }

  isSpeaking() {
    return Boolean(this.supported && this.synth.speaking);
  }

  isSpeakingId(id) {
    if (this.speakingId === null) return false;
    // speakSequence() labels each chunk "<id>:<n>", so a component that asked
    // for a sequence must still see itself as speaking on every chunk. Without
    // this the pulsing ring, the "Stop" label and the stop button all go dead
    // the moment a screen reads anything as more than one utterance.
    return this.speakingId === id || this.speakingId.startsWith(`${id}:`);
  }

  /**
   * Reads a list of chunks in order, so a multi-part summary is spoken as one
   * natural sequence rather than several separate clicks.
   *
   * Each chunk is either a plain string (spoken in `options.lang`) or an
   * object `{ text, lang }`. The object form exists for mixed-language
   * sequences: an English bank SMS quoted inside a Tamil explanation is read
   * by an English voice, then the Tamil verdict follows in a Tamil voice.
   */
  async speakSequence(chunks, options = {}) {
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (chunk === null || chunk === undefined) continue;
      const isObject = typeof chunk === 'object';
      const text = isObject ? chunk.text : chunk;
      const result = await this.speak(text, {
        ...options,
        lang: isObject && chunk.lang ? chunk.lang : options.lang,
        id: options.id ? `${options.id}:${i}` : null,
      });
      // 'stopped' means the user pressed stop or moved on - respect that.
      if (result === 'stopped') return 'stopped';
      // 'no-voice' will repeat identically for every chunk, so bail now
      // rather than walking the list for nothing.
      if (result === 'no-voice') return 'no-voice';
    }
    return 'done';
  }
}

/* -------------------------------------------------------------------------- */
/* Speech to text                                                              */
/* -------------------------------------------------------------------------- */

class SttService {
  constructor() {
    this.supported = Boolean(SpeechRecognitionCtor);
    this.recognition = null;
    this.listening = false;
    this.listeners = new Set();
    this._activeSession = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(state) {
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.warn('[stt] listener failed:', err);
      }
    });
  }

  /**
   * Listens once and resolves with the transcript.
   *
   * Resolves with `{ status, text }` instead of rejecting, so callers can show
   * a helpful message for every outcome without try/catch noise:
   *   status: 'ok' | 'no-speech' | 'not-allowed' | 'no-match' | 'aborted'
   *           | 'unsupported' | 'network' | 'insecure' | 'no-mic'
   */
  listenOnce({ lang = 'en', timeout = 12000 } = {}) {
    if (!this.supported) return Promise.resolve({ status: 'unsupported', text: '' });

    // The microphone only works on a secure origin (https or localhost).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return Promise.resolve({ status: 'insecure', text: '' });
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.permissions &&
      typeof navigator.permissions.query === 'function'
    ) {
      // Best effort pre-check; the real answer arrives via onerror.
    }

    return new Promise((resolve) => {
      const session = ++this._activeSession;
      let settled = false;
      let finalTranscript = '';
      let interim = '';

      const recognition = new SpeechRecognitionCtor();
      this.recognition = recognition;
      // Chrome matches recognition locales against a fixed list and a bare
      // 'ta' or 'te' is not in it, so the mic silently fell back to English and
      // returned Latin text for Indic speech. The full tag is in the list.
      recognition.lang = LANGUAGES[lang]?.bcp47 || lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Some Android builds hang forever; a hard timer is the only guarantee.
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            recognition.abort();
          } catch {
            /* ignore */
          }
          this.listening = false;
          this._emit({ listening: false });
          resolve({ status: finalTranscript ? 'ok' : 'no-speech', text: finalTranscript });
        }
      }, timeout);

      const settle = (status, text = finalTranscript) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.listening = false;
        if (this.recognition === recognition) this.recognition = null;
        this._emit({ listening: false });
        resolve({ status, text });
      };

      recognition.onstart = () => {
        if (session !== this._activeSession) return;
        this.listening = true;
        this._emit({ listening: true });
      };

      recognition.onresult = (event) => {
        if (session !== this._activeSession) return;
        interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interim += result[0].transcript;
        }
        // Show partial words live so the user knows the mic is working.
        this._emit({ listening: true, interim: (finalTranscript + interim).trim() });
      };

      recognition.onerror = (event) => {
        const code = event?.error;
        if (code === 'not-allowed' || code === 'service-not-allowed') return settle('not-allowed');
        if (code === 'no-speech') return settle('no-speech');
        if (code === 'audio-capture') return settle('no-mic');
        if (code === 'network') return settle('network');
        if (code === 'aborted') return settle('aborted');
        return settle('no-match');
      };

      recognition.onend = () => {
        if (settled) return;
        settle(finalTranscript ? 'ok' : 'no-speech');
      };

      try {
        recognition.start();
      } catch {
        // start() throws if called twice in quick succession.
        settle('aborted');
      }
    });
  }

  stop() {
    this._activeSession += 1; // invalidate any in-flight session
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        /* ignore */
      }
      this.recognition = null;
    }
    this.listening = false;
    this._emit({ listening: false });
  }

  isListening() {
    return this.listening;
  }
}

/* -------------------------------------------------------------------------- */
/* Singletons                                                                  */
/* -------------------------------------------------------------------------- */

export const tts = new TtsService();
export const stt = new SttService();

/**
 * Recognises a number spoken in a South Asian language and normalises it.
 * The parser is English-word based, so for Indic languages we map the most
 * common spoken digits to English words first. Users can always fall back to
 * typing, which the UI always offers.
 */
const DIGIT_WORDS = {
  // Devanagari
  'एक': 'one', 'दो': 'two', 'तीन': 'three', 'चार': 'four', 'पांच': 'five', 'पाँच': 'five',
  'छह': 'six', 'सात': 'seven', 'आठ': 'eight', 'नौ': 'nine', 'दस': 'ten', 'सौ': 'hundred',
  'हजार': 'thousand', 'हज़ार': 'thousand',
  // Tamil
  'ஒன்று': 'one', 'இரண்டு': 'two', 'மூன்று': 'three', 'நான்கு': 'four', 'ஐந்து': 'five',
  'ஆறு': 'six', 'ஏழு': 'seven', 'எட்டு': 'eight', 'ஒன்பது': 'nine', 'பத்து': 'ten',
  'பூ': 'hundred', 'இருந்து': 'hundred', 'ஆயிரம்': 'thousand', 'லட்சம்': 'lakh',
  // Telugu
  'ఒకటి': 'one', 'రెండు': 'two', 'మూడు': 'three', 'నాలుగు': 'four', 'ఐదు': 'five',
  'ఆరు': 'six', 'ఏడు': 'seven', 'ఎనిమిది': 'eight', 'తొమ్మిది': 'nine', 'పది': 'ten',
  'వంద': 'hundred', 'వేయ': 'thousand', 'లక్ష': 'lakh',
  // Bengali
  'এক': 'one', 'দুই': 'two', 'তিন': 'three', 'চার': 'four', 'পাঁচ': 'five', 'ছয়': 'six',
  'সাত': 'seven', 'আট': 'eight', 'নয়': 'nine', 'দশ': 'ten', 'শত': 'hundred',
  'হাজার': 'thousand', 'লক্ষ': 'lakh',
};

/** Strips diacritics/punctuation and maps Indic number words to English. */
export function normaliseSpokenNumber(input) {
  if (input === null || input === undefined) return '';
  let text = String(input).trim();
  if (!text) return '';

  // Romanised Indic digits (Devanagari ०-९, Bengali ০-৯).
  const indicDigits = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  text = text.replace(/[०-९০-৯]/g, (d) => indicDigits[d] ?? d);

  // Drop currency noise: "रुपये", "रुपए", " rupees", "ப rupees", "টাকা".
  text = text.replace(/[₹]/g, ' ').replace(/\b(rupees?|rs\.?|rupaye|rupaiya|rupees|ரூபாய்|ரூ|பணம்|டாகா|টাকা|రూపాయ|রুপি|రुपये|rupaye)\b/gi, ' ');

  for (const [word, english] of Object.entries(DIGIT_WORDS)) {
    text = text.replace(new RegExp(`(^|\\s)${word}(\\s|$)`, 'gu'), `$1${english}$2`);
  }

  return text.replace(/\s+/g, ' ').trim();
}
