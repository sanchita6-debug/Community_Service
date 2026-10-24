/**
 * ============================================================================
 * VoicePay - UPI Transaction / SMS Explainer
 * ============================================================================
 *
 * Turns a real-looking bank or UPI SMS into plain, 6th-grade language:
 *   "₹500 was sent to Ramesh on Monday. Reference number 523412345678."
 *
 * It extracts structured facts first (amount, who, when, reference), then
 * builds a sentence from small translation-key templates. The templates are
 * language-neutral strings such as:
 *   { key: 'summary.debit', vars: { amount: '₹500', who: 'Ramesh', when: 'Monday' } }
 * and the client fills them in using the active language from i18n/*.json.
 * That way this parser is language-agnostic and works for all 5 languages.
 *
 * It ALSO runs the scam rule engine over the same text, because a "transaction
 * message" is one of the most common places a scam hides (fake refunds,
 * "update your details" links, etc).
 *
 * IMPORTANT: This is pattern matching for EXPLANATION ONLY. It never contacts
 * a bank, never moves money, and is not a bank statement.
 */

/* -------------------------------------------------------------------------- */
/* Number and amount extraction                                                */
/* -------------------------------------------------------------------------- */

const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  lakh: 100000, crore: 10000000,
};

/**
 * Converts spoken numbers into a real number so a user can literally say
 * "two hundred fifty" into the amount box.
 * Handles: "250", "two hundred fifty", "one lakh twenty thousand",
 * "two thousand rupees", "₹500", "1,20,000".
 *
 * @param {string} input
 * @returns {number|null}
 */
export function parseSpokenNumber(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).toLowerCase().trim();
  if (!text) return null;

  // Pure numeric (allows Indian grouping and decimal part).
  const numeric = text.replace(/,/g, '').match(/[-+]?\d*\.?\d+/);
  if (numeric && /^[\d.,\s]*$/.test(text)) {
    const n = Number.parseFloat(numeric[0]);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }

  // Word based, e.g. "two hundred fifty rupees".
  const words = text
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;   // value completed by thousand/lakh/crore
  let current = 0; // value below 100
  let sawNumber = false;

  for (const word of words) {
    if (word === 'and') continue;
    if (Object.prototype.hasOwnProperty.call(WORD_NUMBERS, word)) {
      sawNumber = true;
      const value = WORD_NUMBERS[word];
      if (value === 100) {
        current = (current || 1) * 100;
      } else if (value === 1000 || value === 100000 || value === 10000000) {
        // Indian grouping: "one lakh twenty thousand" = 120000
        total += (current || 1) * value;
        current = 0;
      } else {
        current += value;
      }
    }
  }
  if (!sawNumber) return null;
  const result = total + current;
  return Number.isFinite(result) ? result : null;
}

/** Formats a number the way Indians read it: 120000 -> "1,20,000". */
export function formatIndianNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** Formats money for display, e.g. 500 -> "₹500". */
export function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return `₹${formatIndianNumber(value)}`;
}

/**
 * Finds the amount in a transaction SMS.
 * Prefers amounts next to a money word (Rs, INR, ₹) to avoid grabbing a
 * phone number or a reference number by mistake.
 */
function extractAmount(text) {
  // "₹1,200.00" or "Rs. 500" or "INR 500" or "Rs 1,20,000.50"
  const moneyMatch = text.match(
    /(?:₹|\brs\.?\b|\binr\b)\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (moneyMatch) {
    const value = Number.parseFloat(moneyMatch[1].replace(/,/g, ''));
    if (Number.isFinite(value)) return { value, raw: moneyMatch[0].trim() };
  }
  // Fallback: a bare 4+ digit number that is not a 12-digit UPI reference.
  const bare = text.match(/(?:^|[^\d,])(\d{3,8}(?:\.\d{1,2})?)(?:[^\d,]|$)/);
  if (bare) {
    const digits = bare[1].replace(/\D/g, '');
    const value = Number.parseFloat(bare[1].replace(/,/g, ''));
    if (Number.isFinite(value) && digits.length <= 8) {
      return { value, raw: bare[1] };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Counterparty (who)                                                          */
/* -------------------------------------------------------------------------- */

const STOP_WORDS = new Set([
  'your', 'a', 'an', 'the', 'to', 'from', 'via', 'upi', 'inr', 'rs', 'ac', 'a c',
  'account', 'bank', 'up', 'is', 'has', 'have', 'been', 'on', 'at', 'by', 'for',
  'and', 'with', 'of', 'towards', 'payment', 'money', 'success', 'successful',
  'debit', 'credited', 'debited', 'ref', 'no', 'txn', 'transaction', 'id', 'utr',
  'pind', 'vpa', 'imps', 'neft', 'netbanking', 'dear', 'customer', 'sir', 'madam',
  'rupees', 'only', 'cash', 'done', 'completed', 'received', 'sent', 'today',
  'yesterday', 'this', 'that', 'it', 'them', 'us', 'me', 'you', 'we', 'i',
]);

/**
 * Finds the name of the other person: a label (to/from/towards/for) followed by
 * 1-4 capitalised words, then a bracket, a stop, or a plain trailing word so it
 * stops at "Ltd" in "Sunrise Textiles Pvt Ltd today" and at "Kumar" in "Suresh
 * Kumar was FAILED". The trailing-word list is deliberately specific (not "any
 * lowercase word") so a common noun like "payment" in "towards UPI payment to
 * Ramesh" cannot end the match before the real name. An optional "Dr."-style
 * title is allowed; a bare "Dr" is one too, and titles end in a period.
 * Falls back to a UPI handle ("ramesh@ybl" -> "ramesh") when no name is found.
 */
function extractCounterparty(text) {
  const m = text.match(
    /(?:towards|to|for|from)\s+(?:upi\s+payment\s+to\s+)?(?:[A-Z][a-z]{1,3}\.\s*)?([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3})\s*(?:\(|[.,;]|\bat\b|\bon\b|\bfor\b|\bwas\b|\bis\b|\bwith\b|\bvia\b|\btoday\b|\byesterday\b|$)/
  );
  if (m) {
    const name = cleanName(m[1]);
    if (name) return { name, source: 'label' };
  }

  // UPI id fallback: ramesh@ybl -> "ramesh"
  const vpa = text.match(/\b([a-z0-9._-]{2,})@(?:[\w-]+\.)?[a-z]{2,}\b/i);
  if (vpa) {
    const handle = vpa[1].replace(/[._-]+/g, ' ').trim();
    if (handle && !STOP_WORDS.has(handle.toLowerCase())) {
      return { name: capitalise(handle), source: 'upi-id' };
    }
  }
  return { name: null, source: null };
}

function cleanName(value) {
  if (!value) return null;
  const words = value
    .replace(/\b(mr|mrs|ms|dr|shri)\b/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return words.map(capitalise).join(' ');
}

function capitalise(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

/* -------------------------------------------------------------------------- */
/* Date                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Extracts a date and describes it in a friendly way: "today", "yesterday",
 * "on 12 September", or "on Monday".
 * Returns { when, whenKey, dateLabel } where whenKey is an i18n key.
 */
function extractWhen(text, now = new Date()) {
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 86400000);

  // ISO or dd-mm-yyyy
  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const date = new Date(now.getFullYear(), month - 1, day);
      const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
      return { when: `on ${dateLabel}`, whenKey: 'when.onDate', dateLabel, date };
    }
  }

  if (/\btoday\b/i.test(text)) {
    return { when: 'today', whenKey: 'when.today', dateLabel: 'today', date: today };
  }
  if (/\byesterday\b/i.test(text)) {
    return { when: 'yesterday', whenKey: 'when.yesterday', dateLabel: 'yesterday', date: yesterday };
  }
  if (/\bnow\b|\bjust now\b/i.test(text)) {
    return { when: 'just now', whenKey: 'when.justNow', dateLabel: 'just now', date: now };
  }

  // "12:22 PM" with no date -> today at that time
  const time = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (time) {
    return { when: 'today', whenKey: 'when.today', dateLabel: 'today', date: today, time: time[0] };
  }
  return { when: null, whenKey: null, dateLabel: null, date: null };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* -------------------------------------------------------------------------- */
/* Direction and status                                                        */
/* -------------------------------------------------------------------------- */

/** Was money sent out, received in, or are we not sure? */
function extractDirection(text) {
  const t = text.toLowerCase();
  const outward = [
    'debited', 'debit', 'sent to', 'has been sent', 'was sent', 'paid to',
    'transferred to', 'payment to', 'money sent', 'outgoing', 'debited from',
  ];
  const inward = [
    'credited', 'credit', 'received', 'received from', 'incoming', 'money received',
    'has been received', 'refund received', 'salary credited', 'cashback',
  ];
  const hasOut = outward.some((p) => t.includes(p));
  const hasIn = inward.some((p) => t.includes(p));

  if (hasOut && !hasIn) return 'debit';
  if (hasIn && !hasOut) return 'credit';
  if (hasOut && hasIn) return 'unknown'; // ambiguous - we must not guess
  if (t.includes('upi transaction') || t.includes('txn of')) return 'debit';
  return 'unknown';
}

function extractStatus(text) {
  const t = text.toLowerCase();
  if (/\b(failed|failed|declined|rejected|unsuccessful|could not be)\b/.test(t)) return 'failed';
  if (/\b(pending|processing|in progress|initiated|requested)\b/.test(t)) return 'pending';
  if (/\b(success|successful|completed|done|confirmed|credited|debited)\b/.test(t)) return 'success';
  // "You have received Rs.1,500" is money that already arrived, but "will be
  // received" is a promise, so only the completed tense counts as success.
  if (/\breceived\b/.test(t) && !/\b(will|shall|to|is being|would) be received\b/.test(t)) {
    return 'success';
  }
  return 'unknown';
}

function extractReference(text) {
  // UPI reference numbers are 12 digits (UTR/RRN).
  const twelve = text.match(/\b(\d{12})\b/);
  if (twelve) return twelve[1];
  const labelled = text.match(
    /\b(rrn|utr|txn\s*id|transaction\s*id|ref(?:erence)?\s*(?:no\.?|number|id))\b\s*[:\-#]?\s*([A-Z0-9]{6,})/i
  );
  if (labelled) return labelled[2].toUpperCase();
  return null;
}

function extractMethod(text) {
  const t = text.toLowerCase();
  if (/\bupi\b/.test(t)) return 'UPI';
  if (/\bimps\b/.test(t)) return 'IMPS';
  if (/\bneft\b|\brtgs\b/.test(t)) return 'NEFT';
  if (/\bnet\s*banking\b/.test(t)) return 'Net banking';
  if (/\bcheque\b/.test(t)) return 'Cheque';
  if (/\bcard\b|\bdebit card\b|\bcredit card\b/.test(t)) return 'Card';
  if (/\bcash\b/.test(t)) return 'Cash';
  return null;
}

function extractBank(text) {
  const banks = [
    'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
    'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Kotak Mahindra',
    'Yes Bank', 'IndusInd Bank', 'Union Bank', 'Bank of India', 'IDFC First',
    'Central Bank', 'UCO Bank', 'Federal Bank', 'Karnataka Bank',
  ];
  for (const bank of banks) {
    if (new RegExp(`\\b${bank.split(' ')[0]}\\b`, 'i').test(text)) return bank;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Explains a UPI/bank SMS in plain language.
 *
 * @param {string} rawText  Pasted SMS or OCR text.
 * @param {object} [options]
 * @param {Function} [options.checkSafetyFn] Injected by the server so the
 *        parser and the rule engine share one source of truth without a
 *        circular import.
 * @param {Date} [options.now] Injectable clock (used by tests).
 * @returns {object} A structured explanation, ready for i18n templating.
 */
export function explainTransaction(rawText, options = {}) {
  const text = String(rawText || '').trim();
  const now = options.now || new Date();

  if (!text || text.length < 5) {
    return {
      ok: false,
      rawText: text,
      errorKey: 'explain.error.tooShort',
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

  const amount = extractAmount(text);
  const direction = extractDirection(text);
  const status = extractStatus(text);
  const counterparty = extractCounterparty(text);
  const when = extractWhen(text, now);
  const reference = extractReference(text);
  const method = extractMethod(text);
  const bank = extractBank(text);

  // Build the plain-language summary from templates.
  let summaryKey = 'summary.unknown';
  const vars = {
    amount: formatMoney(amount?.value),
    who: counterparty.name || '{who}',
    when: when.when || '',
  };

  if (amount && direction === 'debit') {
    summaryKey = counterparty.name ? 'summary.debit' : 'summary.debitUnknown';
  } else if (amount && direction === 'credit') {
    summaryKey = counterparty.name ? 'summary.credit' : 'summary.creditUnknown';
  } else if (amount) {
    summaryKey = 'summary.amountOnly';
  }

  // Bullet-point "facts" the user can go through one at a time with the
  // speaker button. Each is a key + vars so it can be spoken in any language.
  const facts = [];
  if (amount) {
    facts.push({ id: 'amount', key: 'facts.amount', vars: { amount: formatMoney(amount.value) }, icon: 'rupee' });
  }
  if (direction === 'debit') {
    facts.push({
      id: 'direction',
      key: 'facts.wentOut',
      vars: { amount: formatMoney(amount?.value), who: counterparty.name || '' },
      icon: 'arrowUp',
    });
  } else if (direction === 'credit') {
    facts.push({
      id: 'direction',
      key: 'facts.cameIn',
      vars: { amount: formatMoney(amount?.value), who: counterparty.name || '' },
      icon: 'arrowDown',
    });
  }
  if (counterparty.name) {
    facts.push({
      id: 'who',
      key: 'facts.person',
      vars: { who: counterparty.name },
      icon: 'person',
    });
  }
  if (when.when) {
    facts.push({ id: 'when', key: 'facts.when', vars: { when: when.when }, icon: 'clock' });
  }
  if (reference) {
    facts.push({ id: 'ref', key: 'facts.reference', vars: { ref: reference }, icon: 'hash' });
  }
  if (method) {
    facts.push({ id: 'method', key: 'facts.method', vars: { method }, icon: 'card' });
  }
  if (bank) {
    facts.push({ id: 'bank', key: 'facts.bank', vars: { bank }, icon: 'bank' });
  }
  if (status !== 'unknown') {
    facts.push({ id: 'status', key: `facts.status.${status}`, vars: {}, icon: 'check' });
  }

  // Safety is computed on the same text, because fake "transaction" messages
  // are a very common scam carrier.
  let safety = null;
  if (typeof options.checkSafetyFn === 'function') {
    safety = options.checkSafetyFn(text);
  }

  return {
    ok: true,
    rawText: text,
    summaryKey,
    vars,
    amount: amount ? { value: amount.value, raw: amount.raw, formatted: formatMoney(amount.value) } : null,
    direction,
    status,
    counterparty: counterparty.name,
    counterpartySource: counterparty.source,
    reference,
    method,
    bank,
    when,
    facts,
    safety,
    // Everything we could and could not understand, so the UI can be honest.
    missing: [
      !amount ? 'amount' : null,
      counterparty.name ? null : 'counterparty',
      when.when ? null : 'when',
      reference ? null : 'reference',
    ].filter(Boolean),
  };
}
