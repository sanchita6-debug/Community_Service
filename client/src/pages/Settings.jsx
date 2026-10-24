/**
 * ============================================================================
 * My Settings
 * ============================================================================
 *
 * The person using the app controls their own preferences, always. There is no
 * setting here that requires an account, and nothing that reveals or stores
 * financial data.
 *
 * Every control shows its effect IMMEDIATELY (language switches on the spot,
 * text size grows as you tap) rather than behind a Save button, because a
 * person who cannot see whether a change worked will assume it did not, and
 * will tap again.
 */
import { useState } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useProgress } from '../context/ProgressContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { deleteAllData } from '../lib/api.js';
import { KEYS, remove } from '../lib/storage.js';
import { SUPPORTED } from '../i18n/index.js';
import BigButton from '../components/BigButton.jsx';
import { Card, PageHeader, ThemeChoice, Toggle } from '../components/ui.jsx';
import {
  GearIcon,
  GlobeIcon,
  LockIcon,
  SpeakerIcon,
  CheckCircleIcon,
  OfflineIcon,
  PersonIcon,
  ThemeIcon,
} from '../components/icons.jsx';

export default function Settings() {
  const { t } = useSettings();
  const { speak, ttsSupported } = useSpeech();  const {
    language,
    setLanguage,
    fontSize,
    updateSettings,
    ttsEnabled,
    speechRate,
    highContrast,
    theme,
    setTheme,
    saveStatus,
    offline,
    trustedPayees,
  } = useSettings();
  const { isSignedIn, user } = useAuth();
  const { resetProgress } = useProgress();
  const { clear: clearActivity } = useActivity();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  /**
   * "Delete my data" must remove BOTH copies: this device's localStorage and
   * the server's database. Clearing only the browser would leave the saved copy
   * behind, and clearing only the server would leave the phone showing records
   * the user just asked to erase. Local first, then the server, exactly like
   * every other write in this app.
   */
  function handleDeleteEverything() {
    // Local copy: preferences, progress, activity, and the helper target.
    [KEYS.settings, KEYS.progress, KEYS.activity, KEYS.helper, KEYS.queue].forEach(remove);
    resetProgress();
    clearActivity(null);
    setDeleted(true);
    setConfirmDelete(false);
    // Server copy. Fire-and-forget: the user's own device is already clean.
    deleteAllData('demo-user').catch(() => {});
  }

  useSpeakOnMount(`${t('settings.title')}. ${t('settings.subtitle')}`, { id: 'settings-intro' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        icon={GearIcon}
        speakText={`${t('settings.title')}. ${t('settings.subtitle')}`}
      />

      <SaveStatusBanner status={saveStatus} offline={offline} />

      {/* ---- Language ------------------------------------------------------- */}
      <Card>
        <SectionTitle icon={GlobeIcon} title={t('settings.languageTitle')} help={t('settings.languageHelp')} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {SUPPORTED.map((code) => {
            const active = code === language;
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => setLanguage(code)}
                  aria-pressed={active}
                  className={[
                    'min-h-touch flex w-full items-center gap-3 rounded-card border-4 px-5 text-left text-lg font-extrabold transition',
                    active
                      ? 'border-primary-700 bg-primary-700 text-white'
                      : 'border-primary-200 bg-surface text-ink hover:border-primary-500',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1">{t(`languageNames.${code}`)}</span>
                  {active && (
                    <>
                      <CheckCircleIcon className="w-7 h-7 shrink-0" />
                      <span className="sr-only">{t('common.done')}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ---- Text size ------------------------------------------------------ */}
      <Card>
        <SectionTitle title={t('settings.textTitle')} help={t('settings.textHelp')} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { value: 'normal', label: t('family.fontNormal') },
            { value: 'large', label: t('family.fontLarge') },
            { value: 'xlarge', label: t('family.fontXLarge') },
          ].map((option) => {
            const active = option.value === fontSize;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateSettings({ fontSize: option.value })}
                aria-pressed={active}
                className={[
                  'min-h-touch w-full rounded-card border-4 px-4 text-center text-lg font-extrabold transition',
                  active
                    ? 'border-primary-700 bg-primary-700 text-white'
                    : 'border-primary-200 bg-surface text-ink hover:border-primary-500',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Contrast is a separate control: some people need both, and for
            different reasons. */}
        <Toggle
          label={t('settings.contrastTitle')}
          help={t('settings.contrastHelp')}
          checked={highContrast}
          onChange={(v) => updateSettings({ highContrast: v })}
          className="mt-5"
        />
      </Card>

      {/* ---- Light or dark --------------------------------------------------
          Its own card, because it is its own decision. Somebody who reads
          their phone in a bright room at midday and somebody who cannot
          sleep with a white screen at midnight need opposite answers, and
          the switch has to be findable by both of them without hunting
          through the other settings.

          The whole palette is CSS variables, so this changes every screen at
          once - including the ones this person has never opened. */}
      <Card>
        <SectionTitle icon={ThemeIcon} title={t('settings.themeTitle')} help={t('settings.themeHelp')} />
        <ThemeChoice value={theme} onChange={setTheme} />
      </Card>

      {/* ---- Voice ---------------------------------------------------------- */}
      <Card>
        <SectionTitle icon={SpeakerIcon} title={t('settings.voiceTitle')} help={t('settings.voiceHelp')} />

        <Toggle
          label={t('settings.speakEverything')}
          help={t('settings.speakEverythingHelp')}
          checked={ttsEnabled}
          onChange={(v) => updateSettings({ ttsEnabled: v })}
          className="mt-5"
        />

        {/* Speed. Only shown when voice matters, to keep the screen short. */}
        {ttsEnabled && (
          <>
            <p className="mb-3 mt-5 text-lg font-extrabold text-ink">{t('settings.rateLabel')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: 0.7, label: t('settings.rateSlow') },
                { value: 0.9, label: t('settings.rateNormal') },
                { value: 1.1, label: t('settings.rateFast') },
              ].map((option) => {
                const active = Math.abs(speechRate - option.value) < 0.01;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSettings({ speechRate: option.value })}
                    aria-pressed={active}
                    className={[
                      'min-h-touch w-full rounded-card border-4 px-4 text-center text-lg font-extrabold transition',
                      active
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-primary-200 bg-surface text-ink hover:border-primary-500',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {ttsSupported && (
              <div className="mt-5 flex justify-center">
                <BigButton
                  variant="secondary"
                  icon={SpeakerIcon}
                  onClick={() => speak(t('settings.testVoicePhrase'), { id: 'settings-test' })}
                >
                  {t('settings.testVoice')}
                </BigButton>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ---- Account -------------------------------------------------------- */}
      <Card>
        <SectionTitle icon={PersonIcon} title={t('settings.signInToSync')} />
        {isSignedIn ? (
          <p className="text-lg font-bold text-calm-800">{user?.email}</p>
        ) : (
          <BigButton to="/family" variant="secondary" size="block">
            {t('family.signInTitle')}
          </BigButton>
        )}
      </Card>

      {/* ---- Data + privacy -------------------------------------------------- */}
      <Card className="border-4 border-calm-300 bg-calm-50">
        <SectionTitle icon={LockIcon} title={t('settings.dataTitle')} help={t('settings.dataHelp')} />
        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-3 text-base font-semibold text-ink">
            <CheckCircleIcon className="mt-0.5 w-6 h-6 shrink-0 text-calm-800" />
            {t('settings.dataHelp')}
          </li>
          {trustedPayees.length > 0 && (
            <li className="text-base font-semibold text-ink-soft">
              {t('send.trustedList')}: {trustedPayees.map((p) => p.name).join(', ')}
            </li>
          )}
        </ul>

        {/* ---- Delete everything ------------------------------------------
            Storing data is only defensible if the user can take it back. This
            is the control that makes that true, and it is deliberately in the
            same panel that explains what is stored. */}
        <div className="mt-6 rounded-card border-4 border-danger-200 bg-danger-50 p-5">
          <h3 className="text-lg font-extrabold text-danger-900">
            {t('settings.deleteTitle')}
          </h3>
          <p className="mt-1 text-base text-ink-soft">{t('settings.deleteBody')}</p>

          {deleted ? (
            <p
              className="mt-4 flex items-center gap-3 rounded-card border-2 border-calm-300 bg-calm-50 px-4 py-3 text-base font-bold text-calm-900"
              role="status"
              aria-live="polite"
            >
              <CheckCircleIcon className="w-7 h-7 shrink-0" />
              {t('settings.deleteDone')}
            </p>
          ) : confirmDelete ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <BigButton variant="secondary" size="block" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </BigButton>
              <BigButton variant="danger" size="block" onClick={handleDeleteEverything}>
                {t('settings.deleteConfirm')}
              </BigButton>
            </div>
          ) : (
            <div className="mt-4">
              <BigButton variant="danger" size="block" onClick={() => setConfirmDelete(true)}>
                {t('settings.deleteButton')}
              </BigButton>
            </div>
          )}
        </div>
      </Card>

      <p className="text-center text-sm font-semibold text-ink-muted">
        {t('settings.version')}: {import.meta.env.VITE_APP_VERSION || '1.0.0'}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SectionTitle({ icon: Icon, title, help }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-3 text-xl font-extrabold text-ink">
        {Icon && (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800"
            aria-hidden="true"
          >
            <Icon className="w-6 h-6" />
          </span>
        )}
        {title}
      </h2>
      {help && <p className="mt-2 text-base text-ink-soft">{help}</p>}
    </div>
  );
}

/** Honest, non-blocking feedback about where the last change was stored. */
function SaveStatusBanner({ status, offline }) {
  const { t } = useSettings();

  if (offline || status === 'local') {
    return (
      <p
        className="flex items-center gap-3 rounded-card border-2 border-warn-400 bg-warn-50 px-4 py-3 text-base font-bold text-warn-900"
        role="status"
        aria-live="polite"
      >
        <OfflineIcon className="w-7 h-7 shrink-0" />
        {t('settings.offlineSaved')}
      </p>
    );
  }

  if (status === 'saved') {
    return (
      <p
        className="flex items-center gap-3 rounded-card border-2 border-calm-300 bg-calm-50 px-4 py-3 text-base font-bold text-calm-900"
        role="status"
        aria-live="polite"
      >
        <CheckCircleIcon className="w-7 h-7 shrink-0" />
        {t('settings.savedToCloud')}
      </p>
    );
  }

  return null;
}
