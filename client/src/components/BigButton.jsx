/**
 * BigButton - the primary action control
 * ============================================================================
 *
 * Accessibility contract, enforced here once instead of at every call site:
 *   - min-height 64px (`min-h-touch`), min-width 64px.
 *   - Whole thing is a real <button> so keyboard and switch users get it free.
 *   - The label is written at `text-lg`+ so it reads at arm's length.
 *   - An optional icon is decorative when a text label is present, so screen
 *     readers do not announce "send money arrow up".
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from './icons.jsx';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ok: 'btn-ok',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZES = {
  md: 'px-6 py-4 text-lg',
  lg: 'px-8 py-5 text-xl min-h-tap',
  xl: 'px-8 py-7 text-2xl min-h-hero',
  block: 'w-full px-6 py-5 text-lg',
};

export default function BigButton({
  children,
  onClick,
  to,
  href,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  type = 'button',
  ariaLabel,
  ariaDescribedBy,
  autoFocus,
  animate = true,
}) {
  const reduceMotion = useReducedMotion();

  const classes = [
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? (
        <Spinner />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="w-7 h-7 shrink-0" />
      )}
      <span className="text-center">{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-7 h-7 shrink-0" />}
    </>
  );

  const motionProps = animate && !reduceMotion
    ? {
        whileTap: { scale: 0.97 },
        whileHover: { y: -2 },
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }
    : {};

  // `to` renders a router link so navigation is real, not faked with onClick.
  if (to) {
    return (
      <motion.div {...motionProps} className={fullWidth ? 'w-full' : 'inline-flex'}>
        <Link
          to={to}
          className={`${classes} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  if (href) {
    return (
      <motion.a
        href={href}
        {...motionProps}
        className={classes}
        aria-label={ariaLabel}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading || undefined}
      autoFocus={autoFocus}
      {...motionProps}
    >
      {content}
    </motion.button>
  );
}

/** A "go to next step" button. The chevron is the only place it is used. */
export function NextButton({ children, ...props }) {
  return (
    <BigButton icon={ChevronRightIcon} iconPosition="right" size="lg" {...props}>
      {children}
    </BigButton>
  );
}

export function Spinner({ className = 'w-6 h-6' }) {
  return (
    <span
      className={`${className} inline-block animate-spin rounded-full border-3 border-current border-t-transparent`}
      aria-hidden="true"
    />
  );
}
