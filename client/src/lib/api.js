/**
 * ============================================================================
 * API client - network first, local second
 * ============================================================================
 *
 * Every network call in VoicePay follows the same pattern:
 *
 *      try the server  ->  on ANY failure, do the same job locally
 *
 * The local job is possible because the rule engine (`checkSafety`) and the
 * SMS parser (`explainTransaction`) live in `shared/` and are imported directly
 * by the browser. That is what makes the Safety Checker and the Transaction
 * Explainer work with no network at all - which is the normal state of affairs
 * for this app.
 *
 * The server exists so that settings, progress, and feature activity can sync
 * across devices (Family Helper Mode) and survive a restart. Guidance itself
 * never depends on it.
 */
import { checkSafety, listRulesForDisplay, THRESHOLDS } from '@shared/scamRules.js';
import { explainTransaction } from '@shared/transactionParser.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT_MS = 8000;

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // The server sends a translation KEY in `error`; the UI maps it via t().
      const err = new Error(data.message || 'Request failed');
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* POST /check-safety                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Checks a message for scam wording.
 * Always returns the same shape whether it came from the server or the local
 * engine, so the UI never needs to know which happened.
 */
export async function checkMessageSafety(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return {
      ok: false,
      local: true,
      error: 'safety.error.empty',
      verdict: 'yellow',
      matchedRules: [],
      safeSignals: [],
      reasons: [],
      recommendedActions: [],
      score: 0,
    };
  }

  try {
    const data = await request('/check-safety', { method: 'POST', body: { text } });
    return { ...data, local: false };
  } catch {
    // --- Local fallback: the same engine, running in the browser. ---
    const result = checkSafety(text);
    return {
      ok: true,
      local: true,
      checkedText: text,
      ...result,
      disclaimer:
        'Checked on your phone, not on a server. VoicePay never moves money and never asks for your OTP, PIN, or password.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* POST /explain-transaction                                                   */
/* -------------------------------------------------------------------------- */

/** Explains a pasted UPI/bank SMS in plain language. */
export async function explainTransactionText(text) {
  if (typeof text !== 'string' || text.trim().length < 5) {
    return {
      ok: false,
      local: true,
      error: 'explain.error.tooShort',
      amount: null,
      direction: 'unknown',
      status: 'unknown',
      counterparty: null,
      reference: null,
      method: null,
      bank: null,
      when: { when: null, whenKey: null, dateLabel: null },
      facts: [],
      safety: null,
    };
  }

  try {
    const data = await request('/explain-transaction', { method: 'POST', body: { text } });
    return { ...data, local: false };
  } catch {
    const result = explainTransaction(text, { checkSafetyFn: checkSafety, now: new Date() });
    return { ...result, local: true };
  }
}

/* -------------------------------------------------------------------------- */
/* GET /check-safety/rules - the transparent rule book                        */
/* -------------------------------------------------------------------------- */

/** The rule list for the "How I decide" screen. Local copy is authoritative. */
export async function fetchScamRules() {
  // Statically imported above, so the screen works offline. The server copy is
  // only a freshness check and would fail closed, so we do not bother asking.
  return { ok: true, rules: listRulesForDisplay(), thresholds: THRESHOLDS, local: true };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchSettings(userId, token) {
  return request(`/settings/${encodeURIComponent(userId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function saveSettings(userId, settings, token) {
  return request(`/settings/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: { settings },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Erases everything the server stores for this user - preferences, progress,
 * and the whole activity history. This is the "delete my data" endpoint; the
 * caller must also clear localStorage, since that is the other copy.
 */
export async function deleteAllData(userId, token) {
  return request(`/settings/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchProgress(userId, token) {
  return request(`/progress/${encodeURIComponent(userId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function completeLesson(userId, lessonId, token) {
  return request(`/progress/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: { completedLessonId: lessonId },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function submitPracticeAnswer(userId, messageId, choice, token) {
  return request(`/progress/${encodeURIComponent(userId)}/practice`, {
    method: 'POST',
    body: { messageId, choice },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/* -------------------------------------------------------------------------- */
/* Activity - what the features did                                            */
/* -------------------------------------------------------------------------- */

/**
 * Records one thing a feature did, so it shows up in History and a helper can
 * see it later.
 *
 * The caller must pass only DERIVED FACTS in `meta` (a verdict, an amount, a
 * payee name the user typed) and must never pass the pasted message. The
 * server enforces this too - see ACTIVITY_NOTE in server/src/schema.js.
 */
export async function recordActivityEntry(userId, entry, token) {
  return request(`/activity/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: entry,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchActivity(userId, { kind, limit, offset } = {}, token) {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const qs = params.toString();
  return request(`/activity/${encodeURIComponent(userId)}${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchActivitySummary(userId, token) {
  return request(`/activity/${encodeURIComponent(userId)}/summary`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function deleteActivityEntry(userId, id, token) {
  return request(`/activity/${encodeURIComponent(userId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function clearActivity(userId, kind, token) {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return request(`/activity/${encodeURIComponent(userId)}${qs}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */
