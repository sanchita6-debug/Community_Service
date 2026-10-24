/**
 * Stored-data reference (kept in code so it is impossible to drift).
 * ---------------------------------------------------------------------------
 * This file owns the *shape and the values*: what fields exist, which of them a
 * client is allowed to write, and what each one may contain. It is the single
 * authority on that shape - server/src/store.js delegates trusted-payee
 * sanitisation here rather than keeping a second copy. Documents live in the
 * API's in-memory store and in the browser's localStorage either way.
 *
 * users/{id}
 *   helpers       : string[]   (uids permitted to write settings/{id})
 *   displayName   : string
 *   language      : 'en' | 'hi' | 'ta' | 'te' | 'bn'
 *   createdAt     : ISO string
 *   updatedAt     : ISO string
 *
 * settings/{id}
 *   language      : 'en' | 'hi' | 'ta' | 'te' | 'bn'
 *   fontSize      : 'normal' | 'large' | 'xlarge'
 *   speechRate    : number (0.5 - 1.5)
 *   ttsEnabled    : boolean
 *   highContrast  : boolean
 *   trustedPayees : Array<{ id, name, vpa, addedBy, addedAt }>
 *   updatedBy     : string     (who made the last change, for the audit trail)
 *   updatedAt     : ISO string
 *   Kept separate from users/{id} so a relative (the "family helper") can have
 *   their own preferences while editing the main user's.
 *
 * progress/{id}
 *   completedLessons : string[]   (lesson ids)
 *   practice: { total, correct, byMessage: { [id]: 'safe' | 'fraud' } }
 *   lastSeenAt       : ISO string
 *
 * activity/{id}  (append-only; one row per thing a feature did)
 *   userId        : string
 *   kind          : 'safety' | 'explain' | 'send' | 'lesson' | 'practice'
 *   verdict       : string|null  (e.g. 'dangerous' | 'safe' | 'sent')
 *   score         : number|null  (safety score, 0-100)
 *   meta          : object       (DERIVED FACTS ONLY - see ACTIVITY_NOTE)
 *   actor         : string|null  (who did it, for the family-helper audit)
 *   createdAt     : ISO string
 *
 * `id` is the key each document is filed under - `users/{id}`, `settings/{id}`
 * and `progress/{id}`. Activity rows key on their own generated id and are
 * scoped by `userId`.
 *
 * SECURITY NOTE
 *   No OTP, card number, PIN, password, or account number is ever written to
 *   any of these documents. Only language, display preferences, trusted payee
 *   NAMES, and learning progress.
 *
 * ACTIVITY_NOTE
 *   The activity log is NARROWER than that: it records what the engine decided
 *   about a message (a verdict, a score, which rules fired) and derived facts
 *   such as an amount band or a payee name the user typed. It must NEVER store
 *   the message a user pasted, because a pasted bank SMS can contain an account
 *   number and an amount - which is exactly what the SECURITY NOTE above
 *   forbids. `sanitiseActivityMeta` below is the enforcement point: it is an
 *   allow-list, so a future field added to a feature cannot leak into the log
 *   by accident.
 */

export const COLLECTIONS = {
  users: 'users',
  settings: 'settings',
  progress: 'progress',
  activity: 'activity',
};

/** The kinds of thing a feature can record. */
export const ACTIVITY_KINDS = ['safety', 'explain', 'send', 'lesson', 'practice'];

/** Fields the client is allowed to write. Anything else is dropped. */
export const ALLOWED_SETTINGS_FIELDS = [
  'language',
  'fontSize',
  'speechRate',
  'ttsEnabled',
  'highContrast',
  'theme',
  'trustedPayees',
];

export const LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn'];
export const FONT_SIZES = ['normal', 'large', 'xlarge'];
/** The two screens the app can be shown in. */
export const THEMES = ['light', 'dark'];

/** Strips anything not on the allow-list and enforces value types. */
export function sanitiseSettings(input = {}) {
  const out = {};

  if (LANGUAGES.includes(input.language)) out.language = input.language;
  if (FONT_SIZES.includes(input.fontSize)) out.fontSize = input.fontSize;

  if (typeof input.speechRate === 'number') {
    out.speechRate = Math.min(1.5, Math.max(0.5, input.speechRate));
  }
  if (typeof input.ttsEnabled === 'boolean') out.ttsEnabled = input.ttsEnabled;
  if (typeof input.highContrast === 'boolean') out.highContrast = input.highContrast;
  if (THEMES.includes(input.theme)) out.theme = input.theme;

  if (Array.isArray(input.trustedPayees)) {
    out.trustedPayees = input.trustedPayees
      .filter((p) => p && typeof p.name === 'string' && p.name.trim())
      .slice(0, 50) // keep the list small
      .map((p) => ({
        id: String(p.id ?? `tp-${Math.random().toString(36).slice(2, 9)}`),
        name: String(p.name).trim().slice(0, 40),
        vpa: typeof p.vpa === 'string' ? p.vpa.trim().slice(0, 80) : '',
        addedBy: typeof p.addedBy === 'string' ? p.addedBy.slice(0, 80) : 'unknown',
        addedAt: p.addedAt || new Date().toISOString(),
      }));
  }

  return out;
}

/** Builds a fresh progress document. */
export function defaultProgress() {
  return {
    completedLessons: [],
    practice: { total: 0, correct: 0, byMessage: {} },
    lastSeenAt: new Date().toISOString(),
  };
}

/**
 * Merges a partial practice answer into stored progress.
 * Re-answering the same message replaces the earlier answer, so the totals
 * count DISTINCT messages the user has judged, not repeat attempts.
 */
export function mergePracticeResult(existing, answer) {
  const current = existing?.practice ?? { total: 0, correct: 0, byMessage: {} };
  const byMessage = { ...(current.byMessage || {}) };

  // Re-answering the same message replaces the earlier answer, so the totals
  // count DISTINCT messages judged, not repeat attempts.
  byMessage[answer.messageId] = answer.choice;

  const total = Object.keys(byMessage).length;

  // Score every stored answer against ITS OWN correct answer. Comparing all of
  // them to the current answer's correctChoice would silently zero out scores
  // as soon as the user saw a mix of safe and fraud messages.
  const correct = Object.entries(byMessage).reduce((count, [messageId, choice]) => {
    const expected = answer.correctChoiceById?.[messageId];
    return choice === expected ? count + 1 : count;
  }, 0);

  return {
    completedLessons: existing?.completedLessons ?? [],
    practice: { total, correct, byMessage },
    lastSeenAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Activity log                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Which meta fields each kind may carry, and how each is cleaned.
 *
 * This is an ALLOW-LIST on purpose. A deny-list ("strip `text`") fails the day
 * someone names the field `body` or `snippet`; an allow-list fails safe, by
 * storing nothing it does not recognise.
 */
const META_FIELDS = {
  safety: ['ruleIds', 'severity', 'categories'],
  explain: ['amount', 'amountBand', 'balance', 'direction', 'counterparty', 'txnType'],
  send: ['payeeName', 'amountBand'],
  lesson: ['lessonId', 'title'],
  practice: ['messageId', 'choice', 'correct'],
};

/** Free text (a payee name the user typed) is capped so a log row stays small. */
const shortText = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : undefined);

/** A finite number or undefined. Amounts are parsed facts, never raw digits. */
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** An array of short strings, capped. */
const stringList = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 40)) : undefined;

/**
 * Cleans one activity `meta` object for a given kind.
 *
 * Anything not named in META_FIELDS is dropped, which is what makes it
 * impossible for the message a user pasted to end up in the database even if a
 * caller passes it by mistake.
 */
export function sanitiseActivityMeta(kind, input = {}) {
  const allowed = META_FIELDS[kind];
  if (!allowed || !input || typeof input !== 'object') return {};

  const out = {};
  for (const field of allowed) {
    const raw = input[field];
    if (raw === undefined || raw === null) continue;

    let value;
    switch (field) {
      case 'ruleIds':
      case 'categories':
        value = stringList(raw);
        break;
      case 'amount':
      case 'balance':
      case 'severity':
        value = finite(raw);
        break;
      case 'correct':
        value = typeof raw === 'boolean' ? raw : undefined;
        break;
      case 'lessonId':
      case 'messageId':
      case 'choice':
      case 'direction':
      case 'txnType':
      case 'amountBand':
      case 'counterparty':
      case 'payeeName':
      case 'title':
        value = shortText(raw);
        break;
      default:
        value = undefined;
    }

    if (value !== undefined) out[field] = value;
  }
  return out;
}

/**
 * Validates and normalises one activity entry coming in over the wire.
 * Returns `null` when the entry cannot be stored, so the route can reject it.
 */
export function sanitiseActivity(input = {}) {
  if (!input || typeof input !== 'object') return null;
  if (!ACTIVITY_KINDS.includes(input.kind)) return null;

  const verdict = shortText(input.verdict) ?? null;

  let score = finite(input.score);
  if (score !== undefined) score = Math.min(100, Math.max(0, Math.round(score)));

  return {
    kind: input.kind,
    verdict,
    score: score ?? null,
    meta: sanitiseActivityMeta(input.kind, input.meta),
    actor: shortText(input.actor) ?? null,
  };
}

/** Kinds the client is allowed to filter by, for the route's query parsing. */
export function isActivityKind(value) {
  return ACTIVITY_KINDS.includes(value);
}
