/**
 * ============================================================================
 * Icon set - hand-rolled inline SVGs
 * ============================================================================
 *
 * WHY NOT AN ICON LIBRARY?
 * Every icon here is deliberately oversized, chunky, and single-colour. That
 * is the correct design for a partially sighted elderly user, and it is the
 * opposite of what a general-purpose icon set optimises for. Drawing them by
 * hand also keeps the bundle small and, importantly, means there is no runtime
 * icon-font flash before the language is applied.
 *
 * All icons share a 24x24 viewBox and inherit `currentColor`.
 */
import React from 'react';

/** Common wrapper: sizing, colour, and a decorative default. */
function Svg({ children, className = 'w-8 h-8', title, strokeWidth = 2, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Icons next to a text label are decoration. A missing `title` means
      // screen readers correctly skip them instead of reading "image".
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* --- Home cards ------------------------------------------------------------ */
export const SendIcon = (p) => (
  <Svg {...p}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </Svg>
);

export const ReceiptIcon = (p) => (
  <Svg {...p}>
    <path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </Svg>
);

export const ShieldIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const BookIcon = (p) => (
  <Svg {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
    <path d="M8 7h6M8 11h6" />
  </Svg>
);

export const FamilyIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="17" cy="10" r="2.5" />
    <path d="M15.5 20a5 5 0 0 1 6-4.5" />
  </Svg>
);

export const GearIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Svg>
);

/* --- Speech ---------------------------------------------------------------- */
export const SpeakerIcon = (p) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const SpeakerOffIcon = (p) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="m17 9 5 6M22 9l-5 6" />
  </Svg>
);

/* --- Verdicts and safety --------------------------------------------------- */
export const CheckCircleIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </Svg>
);

export const AlertTriangleIcon = (p) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Svg>
);

export const XCircleIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);

export const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const KeyIcon = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9M18 12v3M15 12v2" />
  </Svg>
);

export const HandIcon = (p) => (
  <Svg {...p}>
    <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M12 10.5V6a1.5 1.5 0 0 1 3 0v5" />
    <path d="M15 11V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 15a1.6 1.6 0 0 1 2.5-2L9 15" />
  </Svg>
);

export const PhoneIcon = (p) => (
  <Svg {...p}>
    <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" />
  </Svg>
);

export const PhoneOffIcon = (p) => (
  <Svg {...p}>
    <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const CameraIcon = (p) => (
  <Svg {...p}>
    <path d="M3 8h3l2-2h8l2 2h3v12H3z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);

export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const HashIcon = (p) => (
  <Svg {...p}>
    <path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16" />
  </Svg>
);

export const ClockIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const CardIcon = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19" />
  </Svg>
);

export const BankIcon = (p) => (
  <Svg {...p}>
    <path d="M3 9.5 12 4l9 5.5" />
    <path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />
  </Svg>
);

export const PersonIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

export const RupeeIcon = (p) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M7 4h10M7 9h10M15.5 4c0 4-2.5 5-5.5 5H7l8 11" />
  </Svg>
);

export const ArrowUpIcon = (p) => (
  <Svg {...p}>
    <path d="M12 20V6M6 12l6-6 6 6" />
  </Svg>
);

export const ArrowDownIcon = (p) => (
  <Svg {...p}>
    <path d="M12 4v14M6 12l6 6 6-6" />
  </Svg>
);

export const ArrowLeftIcon = (p) => (
  <Svg {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Svg>
);

export const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Svg>
);

export const ChevronRightIcon = (p) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const GlobeIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
  </Svg>
);

/* A large "A" beside a small one: read at a glance as text size, which a point
   size number or a magnifier alone does not say. */
export const TypeIcon = (p) => (
  <Svg {...p}>
    <path d="M3 19 8 6l5 13" />
    <path d="M4.6 15h6.8" />
    <path d="M15 19l3-8 3 8" />
    <path d="M16 16.4h4" />
  </Svg>
);

export const PlusIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/* The sun and the moon are the two halves of the light/dark switch. They are
   drawn as the SAME shape - a disc with rays - so that the button does not
   change size or meaning when it is pressed, only its picture. A person who
   cannot read the label still recognises "sun" and "moon". */
export const SunIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </Svg>
);

export const MoonIcon = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
);

/* Half a disc, half empty: the one picture that means "the light and the dark
   screen", without favouring either. Used to head the section that holds
   the switch itself. */
export const ThemeIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PlayIcon = (p) => (
  <Svg {...p}>
    <path d="M8 5l11 7-11 7z" />
  </Svg>
);

export const StarIcon = (p) => (
  <Svg {...p}>
    <path d="m12 4 2.5 5.5 6 .8-4.4 4.2 1.1 6-5.2-2.9-5.2 2.9 1.1-6L3.5 10.3l6-.8z" />
  </Svg>
);

export const HelpIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17.5v.01" />
  </Svg>
);

export const LogoutIcon = (p) => (
  <Svg {...p}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M15 8l4 4-4 4M19 12H9" />
  </Svg>
);

export const OfflineIcon = (p) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M5 13a10 10 0 0 1 3.5-2.2M19 13a10 10 0 0 0-3.6-2.2" />
    <path d="M2 8.8A15 15 0 0 1 7 6M22 8.8a15 15 0 0 0-9.5-3.7" />
    <path d="M12 20v.01" />
  </Svg>
);

export const ContactIcon = (p) => (
  <Svg {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="10" r="2.5" />
    <path d="M8 17a4 4 0 0 1 8 0" />
  </Svg>
);

export const DocumentIcon = (p) => (
  <Svg {...p}>
    <path d="M6 2.5h8l4 4V21H6z" />
    <path d="M14 2.5V7h4M9 12h6M9 16h6" />
  </Svg>
);

export const HomeIcon = (p) => (
  <Svg {...p}>
    <path d="m3 11 9-7 9 7" />
    <path d="M6 10v10h12V10" />
  </Svg>
);

export const SparkIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Svg>
);

/** Maps a fact/signal id to the right icon, used by the Explainer and Checker. */
export const FACT_ICONS = {
  rupee: RupeeIcon,
  arrowUp: ArrowUpIcon,
  arrowDown: ArrowDownIcon,
  person: PersonIcon,
  clock: ClockIcon,
  hash: HashIcon,
  card: CardIcon,
  bank: BankIcon,
  check: CheckCircleIcon,
  key: KeyIcon,
  shield: ShieldIcon,
  stop: HandIcon,
  receipt: ReceiptIcon,
  search: SearchIcon,
  lock: LockIcon,
  phone: PhoneIcon,
  hangup: PhoneOffIcon,
  contact: ContactIcon,
};
