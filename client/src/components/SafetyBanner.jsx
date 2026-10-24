/**
 * SafetyBanner - the persistent "we never ask for your OTP" reminder
 * ============================================================================
 *
 * Required by the product brief to be visible throughout the Send Money flow,
 * so it is rendered in the Layout rather than per page. That guarantees it
 * cannot be forgotten on a new screen.
 *
 * Design decision: the banner is CALM BLUE, not red. Red is reserved for fraud
 * warnings only. If "we never ask for your OTP" were red, the colour would stop
 * meaning "someone is trying to trick you" and the whole visual language
 * would break.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LockIcon, ChevronRightIcon } from './icons.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';

export default function SafetyBanner() {
  const { t } = useSettings();
  const { speak, isSpeaking, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const speakId = 'safety-banner';
  const active = isSpeaking(speakId);
  const text = t('safetyBanner.text');

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 pt-3 lg:max-w-4xl">
        <div
          role="note"
          className="overflow-hidden rounded-card border-4 border-primary-200 bg-primary-50"
        >
          <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white"
              aria-hidden="true"
            >
              <LockIcon className="w-7 h-7" />
            </span>

            <p className="min-w-[10rem] flex-1 text-lg font-extrabold leading-snug text-primary-950">
              {text}
            </p>

            <div className="flex items-center gap-2">
              {ttsSupported && (
                <button
                  type="button"
                  onClick={() => speak(`${text}. ${t('safetyBanner.detail')}`, { id: speakId })}
                  aria-pressed={active}
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary-600 bg-surface text-primary-800 transition active:scale-95"
                  title={t('common.speak')}
                >
                  <span className="sr-only">{active ? t('common.stopSpeaking') : t('common.speak')}</span>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9z" />
                    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls="safety-banner-detail"
                className="flex min-h-12 items-center gap-1 rounded-full border-2 border-primary-300 bg-surface px-4 text-base font-bold text-primary-800 transition"
              >
                {t('safetyBanner.expand')}
                <motion.span
                  animate={{ rotate: expanded ? 90 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </motion.span>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id="safety-banner-detail"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="border-t-2 border-dashed border-primary-200 bg-surface px-4 py-4 sm:px-6">
                  <p className="text-lg leading-relaxed text-ink-soft">
                    {t('safetyBanner.detail')}
                  </p>
                  {/* The three things this app will never ask for, restated
                      where the user is most likely to be entering data. */}
                  <ul className="mt-4 space-y-2">
                    {[
                      t('safety.neverAskOtp'),
                      t('safety.neverAskPin'),
                      t('safety.neverAskCard'),
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-base font-semibold text-ink">
                        <span aria-hidden="true" className="mt-1 text-calm-800">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
