/**
 * ============================================================================
 * Speech context - one voice for the whole app
 * ============================================================================
 *
 * Wraps the tts/stt singletons in React state so any component can:
 *   - read the current text aloud:      const { speak } = useSpeech()
 *   - know if THAT text is playing:     isSpeaking('send.step2')
 *   - be spoken automatically on mount: <SpeakOnMount text=... />
 *
 * Why this is a context and not a hook over a module:
 * the speaking state must re-render every speaker button in the app when it
 * changes, and a module-level boolean cannot do that.
 */
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { tts, stt } from '../lib/speech.js';
import { useSettings } from './SettingsContext.jsx';
import { isTtsSupported, isSttSupported } from '../i18n/index.js';

const SpeechContext = createContext(null);

export function SpeechProvider({ children }) {
  const { language, speechRate, ttsEnabled, t } = useSettings();

  const [speakingId, setSpeakingId] = useState(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [sttStatus, setSttStatus] = useState(null); // 'no-speech' | 'not-allowed' | ...
  const [ttsUnsupported, setTtsUnsupported] = useState(!isTtsSupported());
  // sttUnsupported is initialised from the constructor check below, so there is
  // no setter: capability does not change while the page is open.
  const [sttUnsupported] = useState(!isSttSupported());

  // Mirror the service state into React state.
  useEffect(() => tts.subscribe((s) => setSpeakingId(s.speaking ? s.id : null)), []);
  useEffect(
    () =>
      stt.subscribe((s) => {
        setListening(Boolean(s.listening));
        setInterim(s.interim || '');
      }),
    []
  );

  // Stop everything when the language changes: a half-Tamil sentence read in
  // an English voice is worse than silence.
  const previousLang = useRef(language);
  useEffect(() => {
    if (previousLang.current !== language) {
      tts.stop();
      stt.stop();
      previousLang.current = language;
    }
  }, [language]);

  // Silence the screen when navigating away, so a page change mid-sentence does
  // not leave the user listening to the previous screen.
  useEffect(() => () => tts.stop(), []);

  /**
   * Reads text aloud.
   * @param {string} text
   * @param {object} [options]
   * @param {string} [options.id]     identifies this utterance to the button
   * @param {boolean} [options.force] speak even when ttsEnabled is off (used
   *                                 by the explicit speaker buttons)
   * @param {string} [options.lang]   speak in a language other than the UI one.
   *                                 Used for content that is written in a fixed
   *                                 language - a practice SMS, a pasted bank
   *                                 message - so it gets the right voice.
   * @returns {Promise<string>} the result code
   */
  const speak = useCallback(
    async (text, options = {}) => {
      const { id = null, force = false } = options;
      if (!ttsEnabled && !force) return 'disabled';

      const result = await tts.speak(text, {
        lang: options.lang || language,
        rate: speechRate,
        id,
        interrupt: options.interrupt !== false,
      });
      if (result === 'unsupported') setTtsUnsupported(true);
      return result;
    },
    [language, speechRate, ttsEnabled]
  );

  /** Reads several strings in order, as one continuous explanation. */
  const speakSequence = useCallback(
    (chunks, options = {}) =>
      tts.speakSequence(chunks, { lang: language, rate: speechRate, ...options }),
    [language, speechRate]
  );

  const stop = useCallback(() => {
    tts.stop();
    stt.stop();
  }, []);

  const toggle = useCallback(
    (text, options = {}) => {
      // Ask the service, not the React state: during a sequence the active id
      // is "<id>:<n>", and matching it here directly made Stop restart it.
      if (tts.isSpeaking() && tts.isSpeakingId(options.id ?? null)) {
        tts.stop();
        return Promise.resolve('stopped');
      }
      return speak(text, options);
    },
    [speak]
  );

  /**
   * Listens for one utterance.
   * @returns {Promise<{ status: string, text: string }>}
   */
  const listen = useCallback(
    async (options = {}) => {
      setSttStatus(null);
      setInterim('');
      const result = await stt.listenOnce({ lang: language, ...options });

      if (result.status === 'ok') {
        setInterim('');
        return result;
      }
      setSttStatus(result.status);
      return result;
    },
    [language]
  );

  const stopListening = useCallback(() => {
    stt.stop();
    setInterim('');
  }, []);

  /** Turns an STT status into a kind, translated message. */
  const sttErrorMessage = useCallback(
    (status) => {
      switch (status) {
        case 'unsupported':
          return t('stt.unsupportedTitle') + ' ' + t('stt.unsupportedBody');
        case 'no-mic':
          return t('stt.noMicTitle') + ' ' + t('stt.noMicBody');
        case 'not-allowed':
          return t('stt.deniedTitle') + ' ' + t('stt.deniedBody');
        case 'no-speech':
          return t('stt.noSpeechTitle') + ' ' + t('stt.noSpeechBody');
        case 'network':
          return t('stt.networkTitle') + ' ' + t('stt.networkBody');
        case 'insecure':
          return t('stt.notSecureTitle') + ' ' + t('stt.notSecureBody');
        default:
          return t('stt.noSpeechTitle') + ' ' + t('stt.noSpeechBody');
      }
    },
    [t]
  );

  const isSpeaking = useCallback((id = null) => tts.isSpeaking() && tts.isSpeakingId(id), []);
  const isAnySpeaking = useCallback(() => tts.isSpeaking(), []);

  const value = useMemo(
    () => ({
      // Actions
      speak,
      speakSequence,
      toggle,
      stop,
      listen,
      stopListening,
      // State
      speakingId,
      isSpeaking,
      isAnySpeaking,
      listening,
      interim,
      sttStatus,
      sttErrorMessage,
      clearSttStatus: () => setSttStatus(null),
      // Capability flags, so components can offer the typed alternative.
      ttsSupported: !ttsUnsupported,
      sttSupported: !sttUnsupported,
      ttsUnsupported,
      sttUnsupported,
    }),
    [
      speak, speakSequence, toggle, stop, listen, stopListening, speakingId,
      isSpeaking, isAnySpeaking, listening, interim, sttStatus, sttErrorMessage,
      ttsUnsupported, sttUnsupported,
    ]
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error('useSpeech must be used inside <SpeechProvider>');
  return ctx;
}

/**
 * Speaks a string when it changes, and stops when the component unmounts.
 * Used to make every screen self-narrating, which is the core promise of the
 * product: the user should never have to read a screen to know what to do.
 *
 * `lang` overrides the UI language for this utterance - pass the result of
 * detectTextLang() when the text is content (an SMS, a pasted message) rather
 * than something the app translated.
 */
export function useSpeakOnMount(text, { enabled = true, id = null, lang = null, deps = [] } = {}) {
  const { speak, ttsEnabled, stop } = useSpeech();

  useEffect(() => {
    if (!enabled || !ttsEnabled || !text) return undefined;
    speak(text, { id, lang });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled, ttsEnabled, id, lang, ...deps]);
}
