/**
 * ============================================================================
 * History - everything the features have saved about this device
 * ============================================================================
 *
 * One screen showing what has been done: safety checks, transactions explained,
 * practice payments, finished lessons, and practice answers. It is the visible
 * half of the data system - the thing that proves "saved" means saved, because
 * the user can see it, filter it, and delete it.
 *
 * WHAT IT SHOWS, AND WHAT IT DELIBERATELY CANNOT
 *   There is no message text here, because there is none stored - not in this
 *   device's localStorage and not in the API's database. A record carries the
 *   VERDICT ("looked dangerous"), a coarse amount band ("under ₹5,000"), and a
 *   payee name the user themself typed. See lib/activity.js and
 *   server/src/schema.js for the allow-list that keeps it that way.
 *
 * WHY IT IS LOCAL-FIRST
 *   It renders from ActivityContext, which reads this device's localStorage.
 *   So the list is complete and instant with no network - and the "Delete"
 *   controls work offline too, which matters: a person asking to erase their
 *   history must not be told to try again when they have signal.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useActivity } from '../context/ActivityContext.jsx';
import { recordTone } from '../lib/activity.js';
import { Card, PageHeader, OfflineNotice } from '../components/ui.jsx';
import BigButton from '../components/BigButton.jsx';
import {
  ShieldIcon,
  ReceiptIcon,
  SendIcon,
  BookIcon,
  StarIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SparkIcon,
} from '../components/icons.jsx';

/** Icon + colour per record kind, so the list reads at a glance. */
const KIND_STYLES = {
  safety: { icon: ShieldIcon, chip: 'bg-warn-100 text-warn-800', to: '/safety' },
  explain: { icon: ReceiptIcon, chip: 'bg-primary-100 text-primary-800', to: '/explain' },
  send: { icon: SendIcon, chip: 'bg-calm-100 text-calm-800', to: '/send' },
  lesson: { icon: BookIcon, chip: 'bg-calm-100 text-calm-800', to: '/learn' },
  practice: { icon: StarIcon, chip: 'bg-primary-100 text-primary-800', to: '/learn/simulator' },
};

/** Filter chips, in the order they appear. `null` is "everything". */
const FILTERS = [null, 'safety', 'explain', 'send', 'lesson', 'practice'];

export default function History() {
  const { t, language } = useSettings();
  const { records, counts, total, remove, clear, syncError } = useActivity();

  const [filter, setFilter] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const shown = useMemo(
    () => (filter ? records.filter((r) => r.kind === filter) : records),
    [records, filter]
  );

  const hasAnything = total > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        icon={ClockIcon}
        speakText={`${t('history.title')}. ${t('history.subtitle')}`}
      />

      {syncError && <OfflineNotice />}

      {/* ---- Filter chips -------------------------------------------------- */}
      {hasAnything && (
        <div>
          <h2 className="mb-3 text-lg font-extrabold text-ink">{t('history.filterLabel')}</h2>
          <ul className="flex flex-wrap gap-3">
            {FILTERS.map((kind) => {
              const active = filter === kind;
              const count = kind ? counts[kind] : total;
              const label = kind ? t(`history.kind.${kind}`) : t('history.filterAll');
              return (
                <li key={kind || 'all'}>
                  <button
                    type="button"
                    onClick={() => setFilter(kind)}
                    aria-pressed={active}
                    className={[
                      'min-h-touch rounded-pill border-4 px-5 py-3 text-base font-extrabold transition active:scale-95',
                      active
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-primary-200 bg-surface text-primary-800 hover:border-primary-400',
                    ].join(' ')}
                  >
                    {label}
                    <span className={`ml-2 tnum ${active ? 'text-white/80' : 'text-ink-muted'}`}>
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ---- The list, or the empty state --------------------------------- */}
      {shown.length === 0 ? (
        <EmptyHistory hasAnything={hasAnything} />
      ) : (
        <ul className="space-y-4">
          {shown.map((record, index) => (
            <li key={record.id}>
              <RecordCard
                record={record}
                language={language}
                index={index}
                onRemove={() => remove(record.id)}
                removeLabel={t('history.remove')}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ---- Clear-all, behind a confirmation ------------------------------ */}
      {hasAnything && (
        <Card className="border-4 border-danger-200 bg-danger-50">
          <h2 className="text-xl font-extrabold text-danger-900">{t('history.deleteTitle')}</h2>
          <p className="mt-1 text-base text-ink-soft">{t('history.deleteBody')}</p>

          {confirmClear ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <BigButton variant="secondary" size="block" onClick={() => setConfirmClear(false)}>
                {t('common.cancel')}
              </BigButton>
              <BigButton
                variant="danger"
                size="block"
                onClick={() => {
                  clear(filter);
                  setConfirmClear(false);
                }}
              >
                {filter
                  ? t('history.deleteConfirmKind', { kind: t(`history.kind.${filter}`) })
                  : t('history.deleteConfirmAll')}
              </BigButton>
            </div>
          ) : (
            <div className="mt-5">
              <BigButton variant="danger" size="block" onClick={() => setConfirmClear(true)}>
                {filter ? t('history.clearKind') : t('history.clearAll')}
              </BigButton>
            </div>
          )}
        </Card>
      )}

      <p className="rounded-card bg-surface p-4 text-center text-sm leading-relaxed text-ink-muted">
        {t('history.privacyNote')}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One record                                                                  */
/* -------------------------------------------------------------------------- */

function RecordCard({ record, index, onRemove, removeLabel }) {
  const { t } = useSettings();
  const style = KIND_STYLES[record.kind] || KIND_STYLES.explain;
  const Icon = style.icon;
  const tone = recordTone(record);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03 }}
    >
      <Card className="border-2">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${style.chip}`}
            aria-hidden="true"
          >
            <Icon className="w-8 h-8" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold leading-snug text-ink">
                {t(`history.kind.${record.kind}`)}
              </h3>
              <ToneBadge tone={tone} label={t(verdictKey(record, tone))} />
            </div>

            <p className="tnum mt-1 text-sm font-semibold text-ink-muted">
              {formatWhen(record.createdAt, t)}
            </p>

            <RecordDetail record={record} />
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`${removeLabel}: ${t(`history.kind.${record.kind}`)}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-danger-200 text-danger-800 transition hover:border-danger-400 active:scale-95"
          >
            <span aria-hidden="true" className="text-2xl leading-none">✕</span>
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

/** The one or two derived facts worth showing for a kind. */
function RecordDetail({ record }) {
  const { t } = useSettings();
  const meta = record.meta || {};

  if (record.kind === 'safety') {
    const n = Array.isArray(meta.ruleIds) ? meta.ruleIds.length : 0;
    return n > 0 ? (
      <p className="mt-2 text-base text-ink-soft">
        {t('history.detail.warnings', { n })}
      </p>
    ) : (
      <p className="mt-2 text-base text-ink-soft">{t('history.detail.noWarnings')}</p>
    );
  }

  if (record.kind === 'explain' || record.kind === 'send') {
    return (
      <p className="mt-2 text-base text-ink-soft">
        {meta.payeeName || meta.counterparty
          ? t('history.detail.payee', { name: meta.payeeName || meta.counterparty })
          : t('history.detail.payeeUnknown')}
        {meta.amountBand ? ` · ${t(`history.band.${meta.amountBand}`)}` : ''}
      </p>
    );
  }

  if (record.kind === 'lesson') {
    return (
      <p className="mt-2 text-base text-ink-soft">
        {meta.title || t('history.detail.lessonDone')}
      </p>
    );
  }

  if (record.kind === 'practice') {
    return (
      <p className="mt-2 text-base text-ink-soft">
        {meta.choice === 'fraud' ? t('history.detail.saidFraud') : t('history.detail.saidSafe')}
      </p>
    );
  }

  return null;
}

function ToneBadge({ tone, label }) {
  const tones = {
    danger: 'bg-danger-100 text-danger-900',
    warn: 'bg-warn-100 text-warn-900',
    success: 'bg-calm-100 text-calm-900',
    info: 'bg-primary-100 text-primary-900',
  };
  const Icon = tone === 'danger' ? AlertTriangleIcon : tone === 'info' ? SparkIcon : CheckCircleIcon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-extrabold ${tones[tone] || tones.info}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyHistory({ hasAnything }) {
  const { t } = useSettings();
  return (
    <Card className="border-4 border-primary-200 bg-primary-50 text-center">
      <span
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface text-primary-800"
        aria-hidden="true"
      >
        <ClockIcon className="w-11 h-11" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-ink">
        {hasAnything ? t('history.emptyFilteredTitle') : t('history.emptyTitle')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-lg leading-relaxed text-ink-soft">
        {hasAnything ? t('history.emptyFilteredBody') : t('history.emptyBody')}
      </p>
      {!hasAnything && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <BigButton to="/safety" variant="secondary" size="block">
            {t('nav.safety')}
          </BigButton>
          <BigButton to="/explain" variant="secondary" size="block">
            {t('nav.explain')}
          </BigButton>
          <BigButton to="/learn" size="block">
            {t('nav.learn')}
          </BigButton>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Maps a record to the i18n key for its short badge. */
function verdictKey(record, tone) {
  if (record.kind === 'safety') {
    if (tone === 'danger') return 'history.verdict.dangerous';
    if (tone === 'warn') return 'history.verdict.caution';
    if (tone === 'success') return 'history.verdict.safe';
  }
  if (record.kind === 'practice') {
    return record.verdict === 'correct' ? 'history.verdict.correct' : 'history.verdict.incorrect';
  }
  if (record.kind === 'lesson') return 'history.verdict.completed';
  if (record.kind === 'send') {
    return record.verdict === 'sent-trusted' ? 'history.verdict.trusted' : 'history.verdict.notTrusted';
  }
  return 'history.verdict.explained';
}

/**
 * A short, human "when". Uses the browser's own locale formatting, so a Telugu
 * user gets Telugu month names without us shipping a month table per language.
 */
function formatWhen(iso, t) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return t('history.when.unknown');

  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('history.when.justNow');
  if (mins < 60) return t('history.when.minutesAgo', { n: mins });

  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('history.when.hoursAgo', { n: hours });

  const days = Math.floor(hours / 24);
  if (days === 1) return t('history.when.yesterday');
  if (days < 7) return t('history.when.daysAgo', { n: days });

  try {
    return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return then.toISOString().slice(0, 10);
  }
}
