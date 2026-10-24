/**
 * ============================================================================
 * Family Helper Mode
 * ============================================================================
 *
 * For the relative, not the person using the app. The framing matters: this is
 * "setting up your mother's phone", so every label is second-person and the
 * privacy limits are stated up front rather than hidden in a footer.
 *
 * WHAT THIS SCREEN ACTUALLY DOES
 *   A relative sits with the person who uses VoicePay and sets the phone up
 *   for them: language, text size, voice speed, and the people they pay often.
 *   The changes are written to THIS phone, in this browser's localStorage.
 *
 *   There is no server sync and no cross-device account, so nothing here
 *   reaches the other person's phone - there is no link between the two phones
 *   for anything to travel along. The workflow is deliberately "sit down and
 *   set it up", because that is the intervention that actually happens in a
 *   household, and because faking a cloud sync would mean inventing an account
 *   system this app refuses to have (see client/src/lib/localAuth.js).
 *
 *   Every word below is checked against that. If a sentence would make a
 *   relative believe their change has reached another device, it is wrong.
 *
 * The helper profile is OPTIONAL in the sense that the rest of VoicePay never
 * asks for it. This screen is the only place it appears, and it only labels
 * who is making the changes - it is kept on this device and protects nothing.
 */
import { useState } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth, LOCAL_TARGET_UID } from '../context/AuthContext.jsx';
import { useSpeakOnMount } from '../context/SpeechContext.jsx';
import { SUPPORTED } from '../i18n/index.js';
import BigButton from '../components/BigButton.jsx';
import { Card, PageHeader, PayeeChip, SpeakableInput, ThemeChoice, Toggle } from '../components/ui.jsx';
import {
  FamilyIcon,
  LockIcon,
  LogoutIcon,
  PlusIcon,
  CheckCircleIcon,
  PersonIcon,
  HelpIcon,
  GlobeIcon,
  SpeakerIcon,
  TypeIcon,
  ThemeIcon,
} from '../components/icons.jsx';

export default function FamilyHelper() {
  const { t } = useSettings();
  const {
    user,
    initialising,
    error,
    busy,
    isSignedIn,
    helperTarget,
    hasHelperTarget,
    signIn,
    signUp,
    signOut,
    setHelperTarget,
    clearError,
  } = useAuth();

  useSpeakOnMount(`${t('family.title')}. ${t('family.subtitle')}`, { id: 'family-intro' });

  if (initialising) {
    return (
      <Card className="text-center">
        <p className="text-lg font-bold text-ink-soft">{t('common.loading')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('family.title')}
        subtitle={t('family.subtitle')}
        icon={FamilyIcon}
        speakText={`${t('family.title')}. ${t('family.subtitle')}`}
      />

      {isSignedIn ? (
        <SignedInCard
          user={user}
          helperTarget={helperTarget}
          hasHelperTarget={hasHelperTarget}
          onSignOut={signOut}
          busy={busy}
        />
      ) : helperTarget?.guest ? (
        /* The helper already chose to skip the account, and that choice is
            deliberate - they do not need a login to finish setting the phone
            up, so the form is replaced by one line rather than asking again.
            A helper who merely signed OUT is not a guest, and gets the form
            back so they can sign in again. */
        <Card>
          <p className="text-base font-semibold text-ink-soft">{t('family.localOnlyNote')}</p>
        </Card>
      ) : (
        <SignInForm
          error={error}
          busy={busy}
          onSignIn={signIn}
          onSignUp={signUp}
          onClearError={clearError}
          onLocalOnly={() =>
            setHelperTarget({ uid: LOCAL_TARGET_UID, email: null, local: true, guest: true })
          }
        />
      )}

      {/* A target exists as soon as somebody signs in (AuthContext guarantees
          it) or chooses to skip the account. Until then there is nothing to
          configure, so the editor stays closed. */}
      {hasHelperTarget && (
        <>
          <TargetEditor />
          <PreferenceEditor />
        </>
      )}

      <SetupHelp />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Who are you helping                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The "whose phone is this?" label.
 *
 * This is NOT a lookup and NOT a login. There is no account for the person
 * being helped and no link between their phone and this one, so typing their
 * email changes nothing except the label shown here. The card says so in
 * plain words, because the alternative - a field that looks like it is doing
 * something it is not - is exactly the kind of thing that makes people stop
 * trusting an assistive app.
 */
function TargetEditor() {
  const { t } = useSettings();
  const { helperTarget, setHelperTarget } = useAuth();
  const [email, setEmail] = useState(helperTarget?.email || '');
  const [error, setError] = useState(null);

  function handleSave(event) {
    event.preventDefault();
    const trimmed = email.trim();
    // Optional on purpose: a helper may not know the address, and a made-up
    // one is worse than none. If one IS given, it has to look like an address.
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('family.errors.invalidEmail'));
      return;
    }
    setError(null);
    setHelperTarget({
      // The uid stays LOCAL_TARGET_UID: it is the only document the API will
      // accept a write for (server/src/auth.js). The address below is a
      // label and is never used as an id.
      uid: LOCAL_TARGET_UID,
      email: trimmed || null,
      local: true,
    });
  }

  return (
    <Card>
      <SectionTitle icon={FamilyIcon} title={t('family.targetTitle')} help={t('family.targetHelp')} />

      <form onSubmit={handleSave} noValidate className="space-y-4">
        <SpeakableInput
          label={t('family.targetLabel')}
          placeholder={t('family.targetPlaceholder')}
          value={email}
          onChange={(v) => {
            setEmail(v);
            setError(null);
          }}
          maxLength={80}
          error={error}
          helpId="family-target-help"
        />
        <p id="family-target-help" className="-mt-1 text-base font-semibold text-ink-soft">
          {t('common.optional')}
        </p>

        <BigButton type="submit" icon={CheckCircleIcon} size="block">
          {t('family.saveTarget')}
        </BigButton>
      </form>

      <p className="mt-5 rounded-card border-2 border-calm-300 bg-calm-50 p-4 text-lg font-bold text-calm-900">
        <span className="block text-sm font-bold uppercase tracking-wide text-calm-800">
          {t('family.targetSaved')}
        </span>
        {/* The name is the point of this line, so it gets its own row and the
            page's normal reading size instead of being run on after a label. */}
        <span className="mt-1 block break-words text-xl font-extrabold text-calm-900">
          {helperTarget?.email || t('family.targetUnset')}
        </span>
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign in / sign up                                                           */
/* -------------------------------------------------------------------------- */

function SignInForm({ error, busy, onSignIn, onSignUp, onClearError, onLocalOnly }) {
  const { t } = useSettings();
  const [mode, setMode] = useState('in'); // 'in' | 'up'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('family.errors.invalidEmail');
    if (password.length < 6) next.password = t('family.errors.shortPassword');
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    onClearError();
    if (!validate()) return;
    if (mode === 'in') await onSignIn(email, password);
    else await onSignUp(email, password, 'Family helper');
  }

  return (
    <Card>
      <SectionTitle icon={PersonIcon} title={t('family.signInTitle')} help={t('family.signInSubtitle')} />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="family-email" className="mb-2 block text-lg font-extrabold text-ink">
            {t('family.email')}
          </label>
          <input
            id="family-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              onClearError();
            }}
            className={`field ${fieldErrors.email ? 'border-danger-500' : ''}`}
            aria-invalid={fieldErrors.email ? 'true' : undefined}
            aria-describedby={fieldErrors.email ? 'family-email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="family-email-error" className="mt-2 text-base font-semibold text-danger-800" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="family-password" className="mb-2 block text-lg font-extrabold text-ink">
            {t('family.password')}
          </label>
          <input
            id="family-password"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              onClearError();
            }}
            className={`field ${fieldErrors.password ? 'border-danger-500' : ''}`}
            aria-invalid={fieldErrors.password ? 'true' : undefined}
            aria-describedby="family-password-help"
          />
          <p id="family-password-help" className="mt-2 text-base font-semibold text-ink-soft">
            {t('family.passwordHelp')}
          </p>
        </div>

        {error && (
          <p
            className="rounded-card border-4 border-danger-300 bg-danger-50 p-4 text-lg font-extrabold text-danger-900"
            role="alert"
          >
            {t(error)}
          </p>
        )}

        <BigButton type="submit" size="block" loading={busy} icon={CheckCircleIcon}>
          {mode === 'in' ? t('family.signIn') : t('family.signUp')}
        </BigButton>
      </form>

      {/* No account? Do not push anyone toward signing up. The app works fine
          without one; this is genuinely optional. */}
      <div className="mt-5 space-y-3">
        <BigButton
          variant="secondary"
          size="block"
          disabled={busy}
          onClick={() => {
            onClearError();
            setMode(mode === 'in' ? 'up' : 'in');
          }}
        >
          {mode === 'in' ? t('family.signUp') : t('family.signIn')}
        </BigButton>

        <BigButton variant="ghost" size="block" onClick={onLocalOnly}>
          {t('family.needAccount')}
        </BigButton>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Signed in                                                                   */
/* -------------------------------------------------------------------------- */

function SignedInCard({ user, helperTarget, hasHelperTarget, onSignOut, busy }) {
  const { t } = useSettings();
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-calm-100 text-calm-800"
          aria-hidden="true"
        >
          <PersonIcon className="w-9 h-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            {t('family.signedInAs')}
          </p>
          <p className="truncate text-xl font-extrabold text-ink">{user?.email || user?.displayName}</p>
        </div>
        <BigButton variant="secondary" icon={LogoutIcon} onClick={onSignOut} loading={busy}>
          {t('family.signOut')}
        </BigButton>
      </div>

      {hasHelperTarget && (
        <p className="mt-5 rounded-card border-2 border-calm-300 bg-calm-50 p-4 font-bold text-calm-900">
          <span className="block text-sm font-bold uppercase tracking-wide text-calm-800">
            {t('family.targetSaved')}
          </span>
          <span className="mt-1 block break-words text-xl font-extrabold text-calm-900">
            {helperTarget?.email || t('family.targetUnset')}
          </span>
        </p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Target + preferences                                                        */
/* -------------------------------------------------------------------------- */

function PreferenceEditor() {
  const { t } = useSettings();
  const {
    language,
    setLanguage,
    fontSize,
    speechRate,
    ttsEnabled,
    highContrast,
    theme,
    setTheme,
    updateSettings,
    trustedPayees,
    addTrustedPayee,
    removeTrustedPayee,
  } = useSettings();

  const [name, setName] = useState('');
  const [vpa, setVpa] = useState('');
  const [error, setError] = useState(null);

  function handleAdd(event) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError(t('send.invalidPayee'));
      return;
    }
    addTrustedPayee({ name, vpa });
    setName('');
    setVpa('');
    setError(null);
  }

  return (
    <section className="space-y-6" aria-labelledby="family-prefs-heading">
      <h2 id="family-prefs-heading" className="card-title">
        {t('family.prefsTitle')}
      </h2>

      {/* ---- Language ------------------------------------------------------ */}
      <Card>
        <SectionTitle icon={GlobeIcon} title={t('family.languageTitle')} help={t('settings.languageHelp')} />
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
                    'min-h-touch w-full rounded-card border-4 px-5 text-left text-lg font-extrabold transition',
                    active
                      ? 'border-primary-700 bg-primary-700 text-white'
                      : 'border-primary-200 bg-surface text-ink hover:border-primary-500',
                  ].join(' ')}
                >
                  {t(`languageNames.${code}`)}
                  {active && <span className="ml-2" aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ---- Text size ------------------------------------------------------ */}
      <Card>
        <SectionTitle icon={TypeIcon} title={t('family.fontTitle')} help={t('settings.textHelp')} />
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

        {/* Contrast is a separate switch from the text size: some people need
            both, and for different reasons. One raises the letters, the other
            makes the colours harder to miss. */}
        <Toggle
          label={t('family.contrastTitle')}
          help={t('family.contrastHelp')}
          checked={highContrast}
          onChange={(v) => updateSettings({ highContrast: v })}
          className="mt-5"
        />
      </Card>

      {/* ---- Light or dark --------------------------------------------------
          A relative setting the phone up for somebody else is often the one
          who knows that the person cannot read a white screen at night. The
          control is the same one the person themselves uses, so neither of
          them has to learn a second way of doing it. */}
      <Card>
        <SectionTitle icon={ThemeIcon} title={t('settings.themeTitle')} help={t('settings.themeHelp')} />
        <ThemeChoice value={theme} onChange={setTheme} />
      </Card>

      {/* ---- Voice ----------------------------------------------------------
          One card for both voice settings, the same shape as the Voice card
          on the Settings screen: a relative moving between "set it up" and
          "check it" should not have to learn two layouts.

          The speed buttons stay visible even when reading aloud is off. The
          helper is setting the phone up for later - the person may well turn
          the voice on themselves a week from now - and a slower voice is the
          setting most likely to need to be right from the first minute. */}
      <Card>
        <SectionTitle icon={SpeakerIcon} title={t('family.voiceTitle')} help={t('family.voiceHelp')} />

        <Toggle
          label={t('family.speakTitle')}
          help={t('family.speakHelp')}
          checked={ttsEnabled}
          onChange={(v) => updateSettings({ ttsEnabled: v })}
        />

        <p className="mb-3 mt-6 text-lg font-extrabold text-ink">{t('family.voiceSpeedTitle')}</p>
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
      </Card>

      {/* ---- Trusted people ------------------------------------------------- */}
      <Card>
        <SectionTitle icon={PersonIcon} title={t('family.payeesTitle')} help={t('family.payeesHelp')} />

        {trustedPayees.length > 0 ? (
          <ul className="mb-5 flex flex-wrap gap-3">
            {trustedPayees.map((payee) => (
              <li key={payee.id}>
                <PayeeChip
                  name={payee.name}
                  trusted
                  removeLabel={t('family.removePayee')}
                  onRemove={() => removeTrustedPayee(payee.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-base font-semibold text-ink-muted">{t('family.noPayees')}</p>
        )}

        <form onSubmit={handleAdd} noValidate className="space-y-4">
          <SpeakableInput
            label={t('family.payeeName')}
            placeholder={t('send.payeePlaceholder')}
            value={name}
            onChange={setName}
            maxLength={40}
            error={error}
          />
          <SpeakableInput
            label={t('family.payeeVpa')}
            placeholder="name@upi"
            value={vpa}
            onChange={setVpa}
            maxLength={80}
            helpId="family-vpa-help"
          />
          <p id="family-vpa-help" className="-mt-1 text-base font-semibold text-ink-soft">
            {t('common.optional')}
          </p>

          <BigButton type="submit" icon={PlusIcon} size="block">
            {t('family.addPayee')}
          </BigButton>
        </form>
      </Card>

      {/* ---- What happens to these settings --------------------------------- */}
      <Card className="border-4 border-calm-300 bg-calm-50">
        <SectionTitle icon={CheckCircleIcon} title={t('family.applyTitle')} />
        <p className="text-lg leading-relaxed text-calm-900">{t('family.applyHelp')}</p>
      </Card>
    </section>
  );
}

/**
 * A card heading with an optional icon and a help sentence.
 *
 * Same shape as Settings' own section header, so the two screens a relative
 * moves between - "set it up" and "check it" - read as one app. The icon and
 * the darker heading are not decoration: at the "Very large" text size these
 * cards run most of a screen each, and a bold heading with a coloured badge is
 * what tells someone where one section ends and the next begins.
 */
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

/* -------------------------------------------------------------------------- */

function SetupHelp() {
  const { t } = useSettings();
  return (
    <Card>
      <SectionTitle icon={HelpIcon} title={t('family.helpTitle')} />
      <ol className="mt-4 space-y-4">
        {[t('family.help1'), t('family.help2'), t('family.help3')].map((line) => (
          <li key={line} className="flex items-start gap-3 text-lg leading-relaxed text-ink-soft">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-800"
            >
              •
            </span>
            {line}
          </li>
        ))}
      </ol>

      <p className="mt-5 flex items-start gap-3 rounded-card border-2 border-danger-200 bg-danger-50 p-4 text-base font-bold text-danger-900">
        <LockIcon className="w-6 h-6 shrink-0" />
        {t('common.privacyNote')}
      </p>
    </Card>
  );
}
