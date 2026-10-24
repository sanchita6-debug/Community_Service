/**
 * ============================================================================
 * Home
 * ============================================================================
 *
 * The only design decision that matters here: four enormous cards, no text
 * walls, and a greeting that is read aloud on arrival. A person who cannot
 * read should be able to open the app, hear "choose any big button", and tap
 * the yellow one.
 *
 * The greeting auto-speaks via useSpeakOnMount (ttsEnabled in settings), so a
 * completely blind or low-vision user gets the same experience as everyone
 * else without touching anything.
 */
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useProgress } from '../context/ProgressContext.jsx';
import { Card, OfflineNotice } from '../components/ui.jsx';
import GlassHeadlineHero from '../components/ui/glass-headline-hero';
import LanguageSelector from '../components/LanguageSelector.jsx';
import { SpeakingWave } from '../components/SpeakerButton.jsx';
import {
  SendIcon,
  ReceiptIcon,
  ShieldIcon,
  BookIcon,
  FamilyIcon,
  GearIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '../components/icons.jsx';

/**
 * The colours behind the glass.
 *
 * The component's own defaults are a black-and-orange palette from the demo
 * it was written for. These are VoicePay's: the deepest brand blue is the
 * ground the glass sits on, the brand blue and the app's teal flow through
 * it, and a warm cream gives the letters something to bend.
 */
const HERO_COLORS = [
  '#172554', // primary-950 - the ground
  '#0b5cab', // primary     - the brand blue
  '#0d9488', // calm-600    - the teal the app uses for "normal"
  '#60a5fa', // primary-400 - a lighter blue for the highlights
  '#fde68a', // warn-200    - warm cream for the glow
];

const MAIN_CARDS = [
  {
    to: '/send',
    titleKey: 'home.sendTitle',
    subKey: 'home.sendSub',
    icon: SendIcon,
    // Calm green = the "normal" action. Reserved colour discipline: red stays
    // meaningful for fraud, so the normal path is never coloured red.
    bg: 'bg-calm-50 border-calm-300',
    iconBg: 'bg-calm-600',
  },
  {
    to: '/explain',
    titleKey: 'home.explainTitle',
    subKey: 'home.explainSub',
    icon: ReceiptIcon,
    bg: 'bg-primary-50 border-primary-300',
    iconBg: 'bg-primary-700',
  },
  {
    to: '/safety',
    titleKey: 'home.safetyTitle',
    subKey: 'home.safetySub',
    icon: ShieldIcon,
    bg: 'bg-warn-50 border-warn-400',
    iconBg: 'bg-warn-600',
  },
  {
    to: '/learn',
    titleKey: 'home.learnTitle',
    subKey: 'home.learnSub',
    icon: BookIcon,
    bg: 'bg-primary-50 border-primary-300',
    iconBg: 'bg-primary-700',
  },
];

export default function Home() {
  const { t, language, offline, user } = useSettings();
  const { ttsSupported, isAnySpeaking } = useSpeech();
  const { completedCount, lessonCount, allLessonsDone } = useProgress();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  // Spoken greeting on arrival.
  const greeting = `${t('home.greeting')} ${t('home.subtitle')}`;
  useSpeakOnMount(greeting, { id: 'home-greeting' });

  // The hero renders its actions as real links, which is right for a link
  // and wrong for an app: a bare <a href> reloads the whole app on tap,
  // throwing away the session and flashing the boot screen. Preventing the
  // default and navigating with the router keeps it a real link - middle
  // click, "copy link address", screen readers - without the reload.
  const heroAction = (to, label) => ({
    label,
    href: to,
    onClick: (event) => {
      event.preventDefault();
      navigate(to);
    },
  });

  const hour = new Date().getHours();
  // A short, warm time-of-day prefix, in the active language.
  const timeGreeting =
    hour < 12
      ? t('home.greetMorning')
      : hour < 17
        ? t('home.greetAfternoon')
        : t('home.greetEvening');

  return (
    <div className="space-y-6">
      {/* ---- The welcome banner -------------------------------------------
          The glass headline. It carries the page's only <h1>, which is why
          the greeting card that used to sit here is gone: two headings for
          one page is one heading too many, and the hero's greeting replaces
          it.

          The wording is the app's existing wording in the user's language -
          the time of day, the greeting, the instruction - so nothing new has
          to be learned. The headline is deliberately short: the glass type
          is enormous, and a whole sentence would wrap to four lines and push
          the four big buttons off the screen.

          The colours are VoicePay's palette, not the component's defaults,
          so the banner belongs to this app. The class name carries the
          layout adjustments (see the "Glass headline hero" block in
          index.css); the component itself is used exactly as it was
          written. */}
      <div className="relative">
        <GlassHeadlineHero
          className="ghr-home rounded-card border-4 border-primary-200 shadow-card"
          title={t('home.heroGreeting')}
          eyebrow={`${timeGreeting}${user?.displayName ? `, ${user.displayName}` : ''}`}
          description={t('home.subtitle')}
          primaryAction={heroAction('/safety', t('home.safetyTitle'))}
          secondaryAction={heroAction('/learn', t('home.learnTitle'))}
          colors={HERO_COLORS}
          height="auto"
        />
        {isAnySpeaking() && <SpeakingWave className="ghr-home-wave" />}
      </div>

      {!ttsSupported && (
        <Card className="border-warn-400 bg-warn-50">
          <p className="text-base font-semibold text-warn-900">
            <strong className="font-extrabold">{t('tts.unsupportedTitle')}.</strong>{' '}
            {t('tts.unsupportedBody')}
          </p>
        </Card>
      )}

      {offline && <OfflineNotice />}

      {/* ---- Language, always reachable from home ------------------------- */}
      <Card>
        <LanguageSelector />
      </Card>

      {/* ---- The four main actions --------------------------------------- */}
      <nav aria-label={t('nav.home')}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {MAIN_CARDS.map((card, index) => (
            <motion.li
              key={card.to}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.3 }}
            >
              <HomeCard
                to={card.to}
                title={t(card.titleKey)}
                subtitle={t(card.subKey)}
                icon={card.icon}
                bg={card.bg}
                iconBg={card.iconBg}
                speakText={`${t(card.titleKey)}. ${t(card.subKey)}`}
                speakId={`home-card-${card.to}`}
              />
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* ---- Smaller entries ---------------------------------------------- */}
      <ul className="grid gap-4 sm:grid-cols-2">
        <SmallCard
          to="/family"
          title={t('home.familyTitle')}
          subtitle={t('home.familySub')}
          icon={FamilyIcon}
        />
        <SmallCard
          to="/settings"
          title={t('home.settingsTitle')}
          subtitle={t('home.settingsSub')}
          icon={GearIcon}
        />
      </ul>

      {/* ---- Progress nudge: only shown once there is progress to show ---- */}
      {(completedCount > 0 || allLessonsDone) && (
        <Card className="border-calm-300 bg-calm-50">
          <div className="flex items-center gap-4">
            <CheckCircleIcon className="w-10 h-10 shrink-0 text-calm-800" />
            <div className="flex-1">
              <p className="text-lg font-extrabold text-calm-900">
                {t('learn.scoreLabel', { correct: completedCount, total: lessonCount })}
              </p>
            </div>
            <Link to="/learn" className="btn-secondary shrink-0">
              {t('nav.learn')}
            </Link>
          </div>
        </Card>
      )}

      {/* ---- The one thing to remember ------------------------------------ */}
      <Card className="border-4 border-primary-300 bg-primary-50">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-700 text-xl font-black text-white"
            aria-hidden="true"
          >
            !
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-primary-950">
              {t('home.trumpTitle')}
            </h2>
            <p className="mt-1 text-lg leading-relaxed text-ink">{t('home.trumpBody')}</p>
            <p className="mt-2 text-sm font-semibold text-ink-muted">
              {t('app.demoNotice')}
            </p>
          </div>
        </div>
      </Card>

      {/* Language coverage note for whoever is maintaining the translations. */}
      <p className="text-center text-sm text-ink-muted">
        {t('app.name')} · {t('common.language')}: {language.toUpperCase()}
      </p>
    </div>
  );
}

/** A big, tappable home card. Entire card is one link. */
function HomeCard({ to, title, subtitle, icon: Icon, bg, iconBg, speakText, speakId }) {
  const { t } = useSettings();
  const { speak, isSpeaking, ttsSupported } = useSpeech();
  const reduceMotion = useReducedMotion();
  const speaking = isSpeaking(speakId);

  return (
    <div className={`relative h-full rounded-card border-4 ${bg}`}>
      <Link
        to={to}
        className="flex min-h-[8.5rem] w-full items-center gap-4 rounded-card p-5 focus-visible:outline-offset-4"
      >
        <span
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-card ${iconBg} text-white`}
          aria-hidden="true"
        >
          <Icon className="w-11 h-11" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-extrabold leading-tight text-ink">
            {title}
          </span>
          <span className="mt-1 block text-base font-semibold leading-snug text-ink-soft">
            {subtitle}
          </span>
        </span>

        <ArrowRightIcon className="w-7 h-7 shrink-0 text-ink-muted" />
      </Link>

      {/* A speaker on its own, so reading the card is optional. */}
      {ttsSupported && (
        <motion.button
          type="button"
          onClick={() => speak(speakText, { id: speakId })}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          aria-pressed={speaking}
          aria-label={`${t('common.speak')}: ${title}`}
          className={[
            'absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border-2 transition',
            speaking ? 'border-primary-700 bg-primary-700 text-white' : 'border-surface bg-surface/90 text-primary-800',
          ].join(' ')}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}

/** A smaller entry point, for things that are not the main four. */
function SmallCard({ to, title, subtitle, icon: Icon }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-24 items-center gap-4 rounded-card border-2 border-primary-200 bg-surface p-4 shadow-card transition hover:border-primary-400"
      >
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800"
          aria-hidden="true"
        >
          <Icon className="w-8 h-8" />
        </span>
        <span className="min-w-0">
          <span className="block text-xl font-extrabold leading-tight text-ink">{title}</span>
          <span className="block text-base font-semibold text-ink-soft">{subtitle}</span>
        </span>
      </Link>
    </li>
  );
}
