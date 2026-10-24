/** @type {import('tailwindcss').Config} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute, so the scanned files do not depend on which directory npm happened
// to run in. Relative globs here resolve against the cwd, which is now the repo
// root rather than `client/` - and a tailwind config that matches nothing does
// NOT fail quietly: every custom colour, font size and min-h-touch utility is
// dropped, and the build then dies on the first unknown class.
//
// Forward slashes are required, not cosmetic. fast-glob reads `\` as an escape
// character, so a Windows path like `C:\app\client\src` matches zero files and
// Tailwind reports "content is missing or empty".
const globRoot = __dirname.split(path.sep).join('/');

export default {
  content: [
    `${globRoot}/index.html`,
    // `.ts`/`.tsx` are in the list because the project now has TypeScript
    // files (components/ui/glass-headline-hero.tsx and friends). Tailwind
    // only generates utilities for classes it can SEE in a scanned file, so
    // a class used only in a .tsx file is silently missing from the CSS if
    // the glob does not cover it.
    `${globRoot}/src/**/*.{js,jsx,ts,tsx}`,
  ],
  // The `dark:` variant is driven by the same `data-theme` attribute the
  // palette swaps on. Almost nothing needs it - the palette is variables, so
  // the theme applies itself - but it is here for the rare case where a
  // colour has to change rather than be re-pointed (a photographic banner, a
  // shadow that needs a hard edge).
  darkMode: ['variant', '&:where([data-theme="dark"], [data-theme="dark"] *)'],
  theme: {
    extend: {
      colors: {
        // ---------------------------------------------------------------------
        // The palette lives in CSS custom properties, not here as hexes.
        //
        // WHY: the app has a dark theme now. If these were hexes, every
        // screen would need a `dark:` twin of every class - hundreds of
        // edits, and every one of them a chance to forget a screen and leave
        // it light. As variables, the theme is ONE file (client/src/index.css)
        // and every screen follows it for free.
        //
        // The values are RGB channels without the wrapper ("11 92 171") so
        // Tailwind's `rgb(var(--x) / <alpha-value>)` form works, which keeps
        // the opacity modifiers (`bg-surface/95`, `border-ink/10`) working too.
        //
        // `surface` is the new name for "the white of a card". It used to be
        // Tailwind's built-in `white`, which cannot change with the theme;
        // `text-white` is deliberately NOT renamed, because white on a filled
        // brand button has to stay white in both themes.
        // ---------------------------------------------------------------------
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground))',
          50: 'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
          950: 'rgb(var(--c-primary-950) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: '#00F6FF',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        dimWhite: 'rgba(255,255,255,0.7)',
        dimBlue: 'rgba(9,151,124,0.1)',
        // Keep existing semantic colors for app functionality
        calm: {
          50: 'rgb(var(--c-calm-50) / <alpha-value>)',
          100: 'rgb(var(--c-calm-100) / <alpha-value>)',
          200: 'rgb(var(--c-calm-200) / <alpha-value>)',
          300: 'rgb(var(--c-calm-300) / <alpha-value>)',
          400: 'rgb(var(--c-calm-400) / <alpha-value>)',
          500: 'rgb(var(--c-calm-500) / <alpha-value>)',
          600: 'rgb(var(--c-calm-600) / <alpha-value>)',
          700: 'rgb(var(--c-calm-700) / <alpha-value>)',
          800: 'rgb(var(--c-calm-800) / <alpha-value>)',
          900: 'rgb(var(--c-calm-900) / <alpha-value>)',
        },
        danger: {
          50: 'rgb(var(--c-danger-50) / <alpha-value>)',
          100: 'rgb(var(--c-danger-100) / <alpha-value>)',
          200: 'rgb(var(--c-danger-200) / <alpha-value>)',
          300: 'rgb(var(--c-danger-300) / <alpha-value>)',
          400: 'rgb(var(--c-danger-400) / <alpha-value>)',
          500: 'rgb(var(--c-danger-500) / <alpha-value>)',
          600: 'rgb(var(--c-danger-600) / <alpha-value>)',
          700: 'rgb(var(--c-danger-700) / <alpha-value>)',
          800: 'rgb(var(--c-danger-800) / <alpha-value>)',
          900: 'rgb(var(--c-danger-900) / <alpha-value>)',
        },
        warn: {
          50: 'rgb(var(--c-warn-50) / <alpha-value>)',
          100: 'rgb(var(--c-warn-100) / <alpha-value>)',
          200: 'rgb(var(--c-warn-200) / <alpha-value>)',
          300: 'rgb(var(--c-warn-300) / <alpha-value>)',
          400: 'rgb(var(--c-warn-400) / <alpha-value>)',
          500: 'rgb(var(--c-warn-500) / <alpha-value>)',
          600: 'rgb(var(--c-warn-600) / <alpha-value>)',
          700: 'rgb(var(--c-warn-700) / <alpha-value>)',
          800: 'rgb(var(--c-warn-800) / <alpha-value>)',
          900: 'rgb(var(--c-warn-900) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
          // Muted text used to be #64748b (slate-500). On the two lightest
          // surfaces in the app - paper #f4f8fd and primary-50 #eff6ff - that
          // lands at 4.46:1 and 4.37:1, just UNDER the 4.5:1 that WCAG AA asks
          // for on body text. It is the colour used for every caption, hint
          // and label, so those are exactly the words a person with low vision
          // is relying on. #5f6b7d is the same hue a little darker: 5.07:1 on
          // paper, 4.97:1 on primary-50, 5.40:1 on white.
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
        },
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        // The card/panel colour. `bg-white` in the old palette; a token now,
        // so it can become a dark card in the dark theme.
        surface: 'rgb(var(--c-surface) / <alpha-value>)',

        // ---------------------------------------------------------------------
        // shadcn/ui tokens
        // ---------------------------------------------------------------------
        // The shadcn CLI writes components against these names. They are
        // exposed as CSS variables (see the `:root` block in index.css) so a
        // component added later inherits VoicePay's palette instead of
        // introducing a second, clashing colour system.
        //
        // They are ADDITIVE: the app's own names above - primary, calm,
        // danger, warn, ink, paper - keep their exact meaning and values.
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        sans: [
          'Poppins',
          'Nunito',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Noto Sans',
          'Noto Sans Devanagari',
          'Noto Sans Tamil',
          'Noto Sans Telugu',
          'Noto Sans Bengali',
          'sans-serif',
        ],
      },
      screens: {
        xs: '480px',
        ss: '620px',
      },
      // Base type scale. `--font-scale` is multiplied by user font-size
      // preference (see SettingsContext), so elderly users get bigger text
      // without a separate stylesheet.
      fontSize: {
        // Every step multiplies by `--font-scale`, including these two. Left at
        // Tailwind's defaults they would stay put while `text-base` and up grew,
        // so turning on "Very large" shrank the caption-to-body contrast - worst
        // on phones, where the bottom-nav labels are `text-xs`.
        xs: ['calc(0.875rem * var(--font-scale, 1))', { lineHeight: '1.45' }],
        sm: ['calc(1rem * var(--font-scale, 1))', { lineHeight: '1.5' }],
        base: ['calc(1.125rem * var(--font-scale, 1))', { lineHeight: '1.6' }],
        lg: ['calc(1.3rem * var(--font-scale, 1))', { lineHeight: '1.55' }],
        xl: ['calc(1.5rem * var(--font-scale, 1))', { lineHeight: '1.45' }],
        '2xl': ['calc(1.8rem * var(--font-scale, 1))', { lineHeight: '1.35' }],
        '3xl': ['calc(2.2rem * var(--font-scale, 1))', { lineHeight: '1.25' }],
        '4xl': ['calc(2.7rem * var(--font-scale, 1))', { lineHeight: '1.2' }],
        '5xl': ['calc(3.3rem * var(--font-scale, 1))', { lineHeight: '1.15' }],
      },
      minHeight: {
        // The accessibility rule from the brief: 64px minimum tap target.
        touch: '64px',
        tap: '72px',
        hero: '96px',
      },
      minWidth: {
        touch: '64px',
      },
      // Fixed sizes, for controls whose own box should be exactly 64px (the
      // speaker button) rather than merely at least that big.
      height: {
        touch: '64px',
        tap: '72px',
        hero: '96px',
      },
      width: {
        touch: '64px',
        tap: '72px',
        hero: '96px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
      borderRadius: {
        card: '1.25rem',
        pill: '9999px',
      },
      // The shadows are variables too, because a dark grey shadow on a dark
      // card is invisible: the cards would lose the depth that separates them
      // from the page. See --shadow-* in index.css.
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        focus: 'var(--shadow-focus)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '50%': { transform: 'scale(1.12)', opacity: '0' },
          '100%': { transform: 'scale(1.25)', opacity: '0' },
        },
        'wave-1': { '0%,100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1)' } },
        'wave-2': { '0%,100%': { transform: 'scaleY(0.6)' }, '50%': { transform: 'scaleY(0.9)' } },
        'wave-3': { '0%,100%': { transform: 'scaleY(0.3)' }, '50%': { transform: 'scaleY(1.1)' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-1': 'wave-1 1s ease-in-out infinite',
        'wave-2': 'wave-2 1s ease-in-out infinite',
        'wave-3': 'wave-3 1s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
