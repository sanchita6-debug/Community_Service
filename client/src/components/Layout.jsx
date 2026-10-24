/**
 * ============================================================================
 * App shell - header, navigation, safety banner, footer
 * ============================================================================
 *
 * Layout goals, in priority order:
 *  1. The four main destinations are ALWAYS visible without scrolling or
 *     opening a menu. Bottom navigation on phones, a top bar on desktop.
 *  2. The safety banner sits above everything on every screen.
 *  3. Nothing is more than one tap away. There is no hamburger-only navigation.
 *  4. A persistent "Back" control, because getting lost is the fastest way to
 *     lose a low-literacy user.
 */
import { useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech } from '../context/SpeechContext.jsx';
import SafetyBanner from './SafetyBanner.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import { ThemeToggleButton } from './ui.jsx';
import { SendIcon, ReceiptIcon, ShieldIcon, BookIcon, FamilyIcon, GearIcon, ArrowLeftIcon, HomeIcon, SparkIcon, ClockIcon } from './icons.jsx';

/** The four things most people come here to do. */
const PRIMARY_NAV = [
  { to: '/send', labelKey: 'nav.send', icon: SendIcon, accent: 'text-calm-800 bg-calm-100' },
  { to: '/explain', labelKey: 'nav.explain', icon: ReceiptIcon, accent: 'text-primary-800 bg-primary-100' },
  { to: '/safety', labelKey: 'nav.safety', icon: ShieldIcon, accent: 'text-warn-800 bg-warn-100' },
  { to: '/learn', labelKey: 'nav.learn', icon: BookIcon, accent: 'text-primary-800 bg-primary-100' },
];

const SECONDARY_NAV = [
  { to: '/history', labelKey: 'nav.history', icon: ClockIcon },
  { to: '/family', labelKey: 'nav.family', icon: FamilyIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: GearIcon },
];

export default function Layout({ children }) {
  const { t } = useSettings();
  const { stop } = useSpeech();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // Stop talking when the screen changes, otherwise the new screen's content
  // and the old screen's sentence overlap.
  useEffect(() => {
    stop();
    // Scroll to the top on navigation: a partially-sighted user who lands
    // halfway down a new page has no idea there is content above them.
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isHome = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:pl-72">

      <a href="#main" className="skip-link">
        {t('nav.skipToContent')}
      </a>

      {/* ---- Sticky top chrome ---------------------------------------------
          Header and safety banner share ONE sticky shell. Two siblings both
          pinned to `top-0` overlapped instead of stacking, so the header
          painted over the banner and the "always-on" reminder vanished the
          moment you scrolled. One shell keeps them stacked at any size, with
          no hardcoded offset to drift out of sync with the header's height. */}
      <div className="sticky top-0 z-40">
        <header className="border-b-4 border-primary-100 bg-surface/95 backdrop-blur">
          <div className="flex w-full items-center gap-3 px-4 py-3 lg:px-6">
          {!isHome && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              /* 64px, the app's own minimum tap target, and the same size as
                 the light/dark button next to it - two round buttons of
                 different sizes in the same row look like a mistake. */
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary-200 text-primary-800 transition active:scale-95"
              aria-label={t('nav.back')}
            >
              <ArrowLeftIcon className="w-7 h-7" />
            </button>
          )}

          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white"
              aria-hidden="true"
            >
              <SparkIcon className="w-7 h-7" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-extrabold leading-tight text-primary-950">
                {t('app.name')}
              </span>
              <span className="block truncate text-sm font-semibold text-ink-muted">
                {t('app.tagline')}
              </span>
            </span>
          </Link>

          {/* The light/dark shortcut. On a phone the header has no room for
              it - the back button, the logo, the name and the language
              picker already fill the width - so it appears from the tablet
              size up. On a phone the same switch is on the Settings screen
              and in Family Helper, both of which are one tap away. */}
          <ThemeToggleButton className="hidden lg:flex" />

          <LanguageSelector variant="compact" className="shrink-0 max-w-[9.5rem]" />
          </div>
        </header>

        {/* Always-on safety reminder */}
        <SafetyBanner />
      </div>

      {/* ---- Main --------------------------------------------------------- */}
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-40 pt-4 lg:max-w-4xl lg:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---- Footer ------------------------------------------------------- */}
      <footer className="mx-auto w-full max-w-3xl px-4 pb-28 lg:max-w-4xl lg:pb-8">
        <SecondaryNav />
        <p className="mt-4 rounded-card bg-surface p-4 text-center text-sm leading-relaxed text-ink-muted">
          {t('app.demoNotice')}
          <br />
          {t('common.privacyNote')}
        </p>
      </footer>

      {/* ---- Bottom navigation (phones) ------------------------------------ */}
      <nav
        aria-label={t('nav.openMenu')}
        className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-primary-100 bg-surface/98 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs font-bold transition',
                    isActive ? 'bg-primary-700 text-white' : 'text-ink-soft',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-full',
                        isActive ? 'bg-white/20 text-white' : item.accent,
                      ].join(' ')}
                    >
                      <item.icon className="w-6 h-6" />
                    </span>
                    <span className="leading-tight">{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ---- Desktop side navigation --------------------------------------- */}
      <nav
        aria-label={t('nav.openMenu')}
        className="fixed bottom-6 left-6 z-40 hidden flex-col gap-2 lg:flex"
      >
        <Link
          to="/"
          className="flex min-h-touch items-center gap-3 rounded-card border-2 border-primary-200 bg-surface px-5 py-3 text-base font-bold text-primary-800 shadow-card transition hover:border-primary-400"
        >
          <HomeIcon className="w-6 h-6" />
          {t('nav.home')}
        </Link>
        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex min-h-touch items-center gap-3 rounded-card border-2 px-5 py-3 text-base font-bold shadow-card transition',
                isActive
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-primary-200 bg-surface text-primary-800 hover:border-primary-400',
              ].join(' ')
            }
          >
            <item.icon className="w-6 h-6" />
            {t(item.labelKey)}
          </NavLink>
      ))}
      </nav>
    </div>
  );
}

/** Secondary links, rendered once in the footer for large screens. */
function SecondaryNav() {
  const { t } = useSettings();
  return (
    <div className="hidden gap-3 lg:flex">
      {SECONDARY_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'flex min-h-touch flex-1 items-center justify-center gap-2 rounded-card border-2 bg-surface px-4 py-3 text-base font-bold transition',
              isActive ? 'border-primary-700 text-primary-800' : 'border-primary-200 text-ink-soft',
            ].join(' ')
          }
        >
          <item.icon className="w-6 h-6" />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </div>
  );
}
