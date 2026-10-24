/**
 * ============================================================================
 * Activity records - the shape of "what a feature did"
 * ============================================================================
 *
 * One record per thing the user did: a safety check, a transaction explained, a
 * draft payment, a finished lesson, a practice answer. This module owns the
 * SHAPE of those records and the privacy rule that governs them.
 *
 * THE PRIVACY RULE (this is the whole point of this file)
 *   A record carries the VERDICT and DERIVED FACTS - never the message the user
 *   pasted. A pasted bank SMS contains an account number and an amount, and
 *   this app promises never to store those. So `buildRecord` takes a feature's
 *   result object and picks out only the fields on the allow-list below; a
 *   caller cannot leak the source text by including it, because it is simply
 *   not read.
 *
 *   server/src/schema.js enforces the same rule on the way into the database.
 *   Between the two, the pasted text has no path to disk.
 *
 * WHY THIS IS A SEPARATE MODULE
 *   The three feature screens that produce a record (Safety Checker, Explainer,
 *   Send Money) have nothing else in common, and the History screen consumes
 *   records without knowing which feature made them. Concentrating the shape
 *   here means the screen and the features agree on one description, and the
 *   allow-list is in a single place rather than repeated per screen.
 */

/** Record kinds. Kept in sync with ACTIVITY_KINDS in server/src/schema.js. */
export const ACTIVITY_KINDS = ['safety', 'explain', 'send', 'lesson', 'practice'];

/**
 * Which derived facts each kind may carry. An ALLOW-LIST, so a field added to a
 * feature later is dropped rather than silently stored.
 */
const META_FIELDS = {
  safety: ['ruleIds', 'severity', 'categories'],
  explain: ['amount', 'amountBand', 'balance', 'direction', 'counterparty', 'txnType'],
  send: ['payeeName', 'amountBand'],
  lesson: ['lessonId', 'title'],
  practice: ['messageId', 'choice', 'correct'],
};

/** A payee name is user-typed text; cap it so a record stays small. */
const shortText = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : undefined);

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Turns an amount into a coarse band instead of the figure itself.
 *
 * WHY NOT THE AMOUNT: the History screen only ever shows "a small payment" or
 * "a large payment", and a precise figure sitting in a log is more than the
 * feature needs. The exact amount stays in the result the user is looking at.
 */
export function amountBand(amount) {
  const n = finite(amount);
  if (n === undefined) return undefined;
  const abs = Math.abs(n);
  if (abs === 0) return 'zero';
  if (abs < 500) return 'under500';
  if (abs < 5000) return 'under5000';
  if (abs < 50000) return 'under50000';
  return 'over50000';
}

/** Picks the allow-listed meta fields out of a feature result. */
function pickMeta(kind, source = {}) {
  const allowed = META_FIELDS[kind] || [];
  const out = {};
  for (const field of allowed) {
    const raw = source[field];
    if (raw === undefined || raw === null) continue;

    let value;
    switch (field) {
      case 'ruleIds':
      case 'categories':
        value = Array.isArray(raw)
          ? raw.filter((x) => typeof x === 'string').slice(0, 20)
          : undefined;
        break;
      case 'amount':
      case 'balance':
      case 'severity':
        value = finite(raw);
        break;
      case 'correct':
        value = typeof raw === 'boolean' ? raw : undefined;
        break;
      default:
        value = shortText(raw);
    }
    if (value !== undefined) out[field] = value;
  }
  return out;
}

/** Extra derived facts each feature computes on its way in. */
const META_BUILDERS = {
  // The safety engine reports matched rules; keep their ids, not the wording
  // of the message, so a helper sees "which warning fired" and nothing more.
  safety: (source) => ({
    ruleIds: Array.isArray(source.matchedRules)
      ? source.matchedRules.map((r) => r?.id).filter(Boolean)
      : source.ruleIds,
  }),
  explain: (source) => ({
    ...source,
    amountBand: source.amountBand ?? amountBand(source.amount),
  }),
  send: (source) => ({ ...source, amountBand: source.amountBand ?? amountBand(source.amount) }),
};

/**
 * Builds a storable record from a feature's result.
 *
 * @param {string} kind  one of ACTIVITY_KINDS
 * @param {object} source  the feature's own result object (may contain the
 *                         pasted text - it is simply never read here)
 * @param {object} extra   verdict / score / actor the caller supplies
 */
export function buildRecord(kind, source = {}, extra = {}) {
  if (!ACTIVITY_KINDS.includes(kind)) return null;

  const withDerived = META_BUILDERS[kind] ? META_BUILDERS[kind](source) : source;

  const score = finite(extra.score ?? source.score);

  return {
    id: extra.id || `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    verdict: shortText(extra.verdict ?? source.verdict) ?? null,
    score: score === undefined ? null : Math.min(100, Math.max(0, Math.round(score))),
    meta: pickMeta(kind, withDerived),
    actor: shortText(extra.actor) ?? null,
    createdAt: extra.createdAt || new Date().toISOString(),
  };
}

/**
 * Strips a record read back from the API or localStorage down to what the UI
 * needs, so a malformed row cannot crash the History screen.
 */
export function normaliseRecord(raw) {
  if (!raw || typeof raw !== 'object' || !ACTIVITY_KINDS.includes(raw.kind)) return null;
  return {
    id: String(raw.id || ''),
    kind: raw.kind,
    verdict: typeof raw.verdict === 'string' ? raw.verdict : null,
    score: typeof raw.score === 'number' ? raw.score : null,
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
    actor: typeof raw.actor === 'string' ? raw.actor : null,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/** Icon + i18n key per kind, so the History screen stays declarative. */
export const KIND_META = {
  safety: { key: 'safety', tone: 'danger' },
  explain: { key: 'explain', tone: 'info' },
  send: { key: 'send', tone: 'info' },
  lesson: { key: 'lesson', tone: 'success' },
  practice: { key: 'practice', tone: 'success' },
};

/**
 * The tones a record can render with. Safety checks colour by their verdict
 * (red / amber / green), everything else by kind, because "you finished a
 * lesson" has no verdict and a green tick is the honest thing to show.
 */
export function recordTone(record) {
  if (!record) return 'info';
  if (record.kind === 'safety') {
    if (record.verdict === 'red' || record.verdict === 'dangerous') return 'danger';
    if (record.verdict === 'yellow' || record.verdict === 'caution') return 'warn';
    if (record.verdict === 'green' || record.verdict === 'safe') return 'success';
  }
  return KIND_META[record.kind]?.tone || 'info';
}
