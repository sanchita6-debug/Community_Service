/**
 * ============================================================================
 * VoicePay - Scam Phrase Rules (TRANSPARENT + EDITABLE CONFIG)
 * ============================================================================
 *
 * This is deliberately a plain, human-readable config file so that a
 * non-engineer (bank, NGO, or the family member helping the user) can add or
 * remove scam patterns without touching any other code.
 *
 * HOW A RULE WORKS
 * ----------------
 * 1. The incoming text (typed, pasted SMS, or OCR'd screenshot) is normalised
 *    by `normaliseText()` -> lowercase, punctuation stripped, extra spaces
 *    collapsed. So "Share  your OTP!!!" becomes "share your otp".
 * 2. Every `patterns` entry is tested against that normalised text.
 *    - A `phrases` entry matches if the phrase appears as a whole word-group.
 *      Partial words are safe: "cotp" will NOT match "otp".
 *    - A `regex` entry is an advanced escape hatch for tricky phrasing.
 * 3. Every matching rule contributes its `weight` to a score. It also adds a
 *    `reasons` entry explaining *why* in plain 6th-grade language.
 * 4. Final verdict is derived from score + the highest severity matched:
 *      RED    (danger)  -> score >= RED_MIN_SCORE  (default 5)  "likely fraud"
 *      YELLOW (caution) -> score >= YELLOW_MIN_SCORE(default 2)  "be careful"
 *      GREEN  (safe)    -> otherwise                           "looks safe"
 *
 * EDITING GUIDE (for non-engineers)
 * ---------------------------------
 * - To catch a NEW scam, copy an existing rule, give it a new `id`, and list
 *   the wording scammers use in `phrases`.
 * - Keep `explanation` and `safeAction` short, kind, and in plain language.
 *   These strings are shown on screen AND read aloud, so no jargon.
 * - Lower `weight` if a phrase is also used in genuine bank alerts.
 *
 * DISCLAIMER
 * ----------
 * VoicePay NEVER moves money. This engine only *explains and warns*.
 * A GREEN verdict is "nothing suspicious found", not a guarantee of safety.
 */

export const SEVERITY = {
  DANGER: 'danger',
  CAUTION: 'caution',
  SAFE: 'safe',
};

export const VERDICT = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
};

/** Thresholds used to convert a weighted score into a colour. */
export const THRESHOLDS = {
  yellowMinScore: 2,
  redMinScore: 5,
  /**
   * Some rules are near-certain fraud. If one of these matches, we go RED
   * immediately even if the total score is low (e.g. the message is short).
   */
  instantRedRuleIds: ['otp-request', 'pin-request', 'password-request', 'screen-share'],
};

/**
 * The rule list. Ordered from most to least severe so the UI can show the
 * strongest reason first.
 */
export const SCAM_RULES = [
  {
    id: 'otp-request',
    severity: SEVERITY.DANGER,
    weight: 6,
    titleKey: 'rules.otpRequest.title',
    title: 'Asking for your OTP',
    explanationKey: 'rules.otpRequest.explanation',
    explanation:
      'No bank and no real company will ever ask you to read out a one time password. This is the oldest trick used to steal money.',
    safeActionKey: 'rules.otpRequest.safeAction',
    safeAction: 'Stop. Do not share the number. If someone asked, it is a fraudster.',
    phrases: [
      'share otp',
      'share your otp',
      'share the otp',
      'enter the otp',
      'enter otp here',
      'send me otp',
      'send otp',
      'tell me the otp',
      'give your otp',
      'provide your otp',
      'otp is required',
      'otp required',
      'verify with otp',
      'confirm with otp',
      'one time password',
      'onetime password',
      'verification code is',
    ],
    regex: [
      /\b(share|send|give|tell|provide|enter|type|paste)\b[^.!?]{0,40}\b(otp|one[\s-]?time\s+password)\b/,
    ],
  },
  {
    id: 'pin-request',
    severity: SEVERITY.DANGER,
    weight: 6,
    titleKey: 'rules.pinRequest.title',
    title: 'Asking for your UPI PIN',
    explanationKey: 'rules.pinRequest.explanation',
    explanation:
      'Your UPI PIN is the secret that lets money leave your account. Real payment apps never ask for it, not even support staff.',
    safeActionKey: 'rules.pinRequest.safeAction',
    safeAction: 'Never read out your UPI PIN. If you already shared it, change it in your bank app right now.',
    phrases: [
      'share pin',
      'share your pin',
      'upi pin',
      'enter your pin',
      'tell me your pin',
      'provide your pin',
      'four digit pin',
      '4 digit pin',
    ],
    regex: [/\b(share|send|give|tell|provide|enter)\b[^.!?]{0,30}\b(pin|mpin)\b/],
  },
  {
    id: 'password-request',
    severity: SEVERITY.DANGER,
    weight: 6,
    titleKey: 'rules.passwordRequest.title',
    title: 'Asking for your password',
    explanationKey: 'rules.passwordRequest.explanation',
    explanation:
      'Nobody legitimate needs your password. A fraudster asking for it is trying to log in as you.',
    safeActionKey: 'rules.passwordRequest.safeAction',
    safeAction: 'Do not type your password anywhere because of a phone call or message.',
    phrases: [
      'share password',
      'share your password',
      'enter your password',
      'give your password',
      'send your password',
      'password required to verify',
    ],
    regex: [/\b(share|send|give|provide)\b[^.!?]{0,30}\b(password|passcode|pass word)\b/],
  },
  {
    id: 'screen-share',
    severity: SEVERITY.DANGER,
    weight: 6,
    titleKey: 'rules.screenShare.title',
    title: 'Asking you to share your screen',
    explanationKey: 'rules.screenShare.explanation',
    explanation:
      'If a stranger can watch your screen, they can see your PIN and your OTP. They can then take your money.',
    safeActionKey: 'rules.screenShare.safeAction',
    safeAction: 'Hang up immediately. Never allow screen sharing with an unknown person.',
    phrases: [
      'share your screen',
      'screen share',
      'screensharing',
      'share the screen',
      'start screen recording',
      'record your screen',
      'keep camera on',
      'keep your camera on',
    ],
    regex: [],
  },
  {
    id: 'install-app',
    severity: SEVERITY.DANGER,
    weight: 5,
    titleKey: 'rules.installApp.title',
    title: 'Telling you to install a new app',
    explanationKey: 'rules.installApp.explanation',
    explanation:
      'Scammers send a link to a fake app that can read your messages and steal money. Only install apps from the official app store, by searching the name yourself.',
    safeActionKey: 'rules.installApp.safeAction',
    safeAction: 'Do not install anything from a link in a message. Close it and open your usual banking app yourself.',
    phrases: [
      'install this app',
      'install the app',
      'install this application',
      'download this app',
      'download the app',
      'install our app',
      'sideload',
      'install from this link',
      'apk file',
      'install the apk',
      'install from the link',
    ],
    regex: [],
  },
  {
    id: 'account-blocked',
    severity: SEVERITY.DANGER,
    // 4, not 5: at 5 this rule alone hit the red threshold, so any real notice
    // about a closed account was called fraud. Red now needs a second signal.
    weight: 4,
    titleKey: 'rules.accountBlocked.title',
    title: 'Threatening that your account will be blocked',
    explanationKey: 'rules.accountBlocked.explanation',
    explanation:
      'Real banks never block an account over a phone call or a message. This threat is used to make you act fast and panic.',
    safeActionKey: 'rules.accountBlocked.safeAction',
    safeAction: 'Do nothing. Close the message. Call your bank yourself using the number on your card.',
    phrases: [
      'your account will be blocked',
      'account will be blocked',
      'account will be closed',
      'account will be deactivated',
      'account is blocked',
      'will be suspended',
      'account suspension',
      'deactivate your account',
      'your account will be frozen',
      'account has been blocked',
      'kyc will be cancelled',
      'kyc will be rejected',
      'account will be deactivated tomorrow',
    ],
    regex: [/\baccount\b[^.!?]{0,40}\b(block|block ed|blocked|suspend|suspended|freeze|frozen|close|closed|deactivat)/],
  },
  {
    id: 'click-link',
    severity: SEVERITY.CAUTION,
    weight: 3,
    titleKey: 'rules.clickLink.title',
    title: 'Asking you to click a link',
    explanationKey: 'rules.clickLink.explanation',
    explanation:
      'Links in messages can take you to a fake page that copies what you type. Real bank alerts rarely need you to click anything.',
    safeActionKey: 'rules.clickLink.safeAction',
    safeAction: 'Do not click. If you think you must, open your banking app on your own instead.',
    phrases: [
      'click this link',
      'click the link',
      'click on the link',
      'click here',
      'click the below link',
      'tap the link',
      'open this link',
      'follow this link',
      'update your kyc by clicking',
      'verify by clicking',
      'update your details by clicking',
    ],
    // Covers "clicking this link" and "tap on the link" too, so the rule does
    // not miss the message just because the verb was inflected.
    regex: [/\b(click|clicking|clicked|tap|tapping|open|opening)\b[^.!?]{0,20}\b(link|links|here|below)\b/],
  },
  {
    id: 'new-number',
    severity: SEVERITY.CAUTION,
    weight: 3,
    titleKey: 'rules.newNumber.title',
    title: 'Money must go to a new number',
    explanationKey: 'rules.newNumber.explanation',
    explanation:
      'A new phone number or bank account that has just appeared in your contacts is a common way to steal money. The number may belong to a stranger.',
    safeActionKey: 'rules.newNumber.safeAction',
    safeAction: 'Do not send money yet. Call the person on their old number to confirm.',
    phrases: [
      'transfer to new number',
      'send to the new number',
      'new number has been updated',
      'my number has changed',
      'number has been changed',
      'use this new number',
      'send money to this number',
      'new upi id',
      'new bank account',
      'payment to new account',
    ],
    regex: [],
  },
  {
    id: 'lottery-prize',
    severity: SEVERITY.DANGER,
    weight: 5,
    titleKey: 'rules.lottery.title',
    title: 'Prize or lottery you never entered',
    explanationKey: 'rules.lottery.explanation',
    explanation:
      'You cannot win a prize you never joined. These messages ask for your details or a small "processing" payment to steal money.',
    safeActionKey: 'rules.lottery.safeAction',
    safeAction: 'Delete it. Do not send any "processing fee" or your bank details.',
    phrases: [
      'you have won',
      'you won',
      'congratulations you have won',
      'lucky winner',
      'you are the winner',
      'claim your prize',
      'claim your reward',
      'you have been selected',
      'lucky draw winner',
      'cash prize',
      'you have won rs',
    ],
    regex: [/\b(you|congratulations)\b[^.!?]{0,30}\b(win|winner|won|selected|prize)\b/],
  },
  {
    id: 'kyc-update',
    severity: SEVERITY.CAUTION,
    weight: 3,
    titleKey: 'rules.kycUpdate.title',
    title: 'Urgent KYC or "update details" message',
    explanationKey: 'rules.kycUpdate.explanation',
    explanation:
      'KYC updates are real, but they are done inside your banking app or branch. A message telling you to update through a link or phone number is fake.',
    safeActionKey: 'rules.kycUpdate.safeAction',
    safeAction: 'Open your banking app yourself and check for a KYC notice. Do not use links or phone numbers from the message.',
    phrases: [
      'kyc will be expired',
      'kyc is expired',
      'kyc expiring',
      'kyc pending update',
      'update your kyc',
      'kyc mandatory',
      'aadhaar will be blocked',
      'pan card will be blocked',
      'update your information',
      'update your details immediately',
    ],
    regex: [],
  },
  {
    id: 'refund-fee',
    severity: SEVERITY.DANGER,
    weight: 5,
    titleKey: 'rules.refundFee.title',
    title: 'Refund that needs a fee first',
    explanationKey: 'rules.refundFee.explanation',
    explanation:
      'A real refund comes back on its own. Anyone asking you to pay a small amount first to "release" money is stealing from you.',
    safeActionKey: 'rules.refundFee.safeAction',
    safeAction: 'Do not pay anything. Check your bank account balance to see if the refund already arrived.',
    phrases: [
      'processing fee',
      'registration fee',
      'customs fee',
      'to receive your refund',
      'refund of rs',
      'claim your refund',
      'pay rs 10 to receive',
      'pay a small amount to receive',
      'clearance fee',
      'convenience charge of',
    ],
    regex: [/\b(pay|send)\b[^.!?]{0,30}\b(fee|charge)\b[^.!?]{0,40}\b(refund|receive|release)\b/],
  },
  {
    id: 'personal-data',
    severity: SEVERITY.CAUTION,
    weight: 3,
    titleKey: 'rules.personalData.title',
    title: 'Asking for card or bank details',
    explanationKey: 'rules.personalData.explanation',
    explanation:
      'A genuine app already knows your card and bank details. A stranger asking for the full card number, expiry date, or CVV is a fraudster.',
    safeActionKey: 'rules.personalData.safeAction',
    safeAction: 'Stop. Do not read out card numbers, expiry dates, or CVV to anyone.',
    phrases: [
      'card number',
      'full card number',
      'expiry date',
      'cvv',
      'cvc',
      'atm pin',
      'account number and ifsc',
      'bank account details',
      'send your debit card details',
    ],
    regex: [/\b(card\s*number|cvv|cvc|expiry\s*date)\b/],
  },
  {
    id: 'remote-access',
    severity: SEVERITY.DANGER,
    weight: 5,
    titleKey: 'rules.remoteAccess.title',
    title: 'Asking you to stay on the phone and do things',
    explanationKey: 'rules.remoteAccess.explanation',
    explanation:
      'This is called "technical support fraud". The caller walks you through your banking app and takes the money themselves while talking to you.',
    safeActionKey: 'rules.remoteAccess.safeAction',
    safeAction: 'Hang up. Call your bank on the number printed on your card or from its website.',
    phrases: [
      'do not hang up',
      'do not cut the call',
      'stay on the line',
      'keep talking to me',
      'i will guide you step by step',
      'let me control your phone',
      'anydesk',
      'teamviewer',
      'quick support',
      'remote access',
      'i am from the bank',
      'this is from your bank',
      'calling from the bank',
    ],
    regex: [],
  },
  {
    id: 'urgency',
    severity: SEVERITY.CAUTION,
    weight: 2,
    titleKey: 'rules.urgency.title',
    title: 'Rushing you with a deadline',
    explanationKey: 'rules.urgency.explanation',
    explanation:
      'Scammers create panic so you act before you think. Urgency is a trick, not a real deadline.',
    safeActionKey: 'rules.urgency.safeAction',
    safeAction: 'Slow down. Close the message and come back to it later, or ask a family member.',
    phrases: [
      'within 24 hours',
      'within 2 hours',
      'within one hour',
      'before midnight',
      'last warning',
      'final warning',
      'immediately or',
      'or your account will be',
      'today itself',
      'expire today',
      'offer ends today',
      'act now',
      'hurry',
    ],
    regex: [],
  },
  {
    id: 'fake-official',
    severity: SEVERITY.CAUTION,
    weight: 2,
    titleKey: 'rules.fakeOfficial.title',
    title: 'Pretending to be an official company',
    explanationKey: 'rules.fakeOfficial.explanation',
    explanation:
      'Anyone can copy a bank logo and name. The message is fake if it arrived as a call, a text, or a WhatsApp message rather than from the app itself.',
    safeActionKey: 'rules.fakeOfficial.safeAction',
    safeAction: 'Open your banking app yourself. Do not trust the number that called you.',
    phrases: [
      'sbi customer care',
      'rbi helpline',
      'bank security team',
      'security department',
      'fraud department calling',
      'official whatsapp',
      'official helpline',
      'verification department',
      'bank verification team',
    ],
    regex: [],
  },
];

/**
 * Positive signals. These are things that are NORMAL for a genuine UPI alert.
 * We show them so the user learns what "safe" looks like, and they add a small
 * amount of confidence to a GREEN verdict.
 */
export const SAFE_SIGNALS = [
  {
    id: 'upi-ref',
    labelKey: 'signals.upiRef.label',
    label: 'Has a UPI reference number',
    // A 12 digit UTR / RRN reference.
    regex: [/\b\d{12}\b/, /\b(rrn|utr|txn\s*id|transaction\s*id|ref(erence)?\s*(no|number|id))\b\s*[:\-#]?\s*[a-z0-9]{6,}/i],
  },
  {
    id: 'upi-word',
    labelKey: 'signals.upiWord.label',
    label: 'Mentions UPI (the normal payment method)',
    regex: [/\bupi\b/],
  },
  {
    id: 'no-request',
    labelKey: 'signals.noRequest.label',
    label: 'Does not ask you for any secret',
    // No sensitive-data rule matched. Handled specially in the engine.
    special: 'no-secret-request',
  },
  {
    id: 'known-bank',
    labelKey: 'signals.knownBank.label',
    label: 'Comes from a known Indian bank name',
    regex: [/\b(sbi|state\s*bank|hdfc|icici|axis\s*bank|punjab\s*national|bank\s*of\s*baroda|canara|kotak|yes\s*bank|indusind|union\s*bank|pnb|boi|canara\s*bank|idfc|uco|central\s*bank)\b/i],
  },
];

/* -------------------------------------------------------------------------- */
/* Text normalisation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Lower-cases, removes punctuation, and collapses whitespace so that
 * "Share  your OTP!!!" and "share your otp" compare equal.
 * Devanagari / Tamil / Telugu / Bengali characters are preserved because the
 * scam phrases in this build are English-first, but the normaliser must not
 * destroy the user's own script.
 */
export function normaliseText(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    // Keep letters (any script), digits and spaces. Everything else becomes a space.
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-phrase containment. Uses word boundaries so "otp" does not match
 * inside "cotp", and "pin" does not match "spinning".
 */
function containsPhrase(haystack, phrase) {
  const needle = normaliseText(phrase);
  if (!needle) return false;
  const pattern = needle
    .split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}([^\\p{L}\\p{N}]|$)`, 'u').test(haystack);
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Runs every rule over the text.
 *
 * @param {string} rawText  Typed text, pasted SMS, or OCR output.
 * @param {object} [options]
 * @param {Array}  [options.rules]     Override the rule list (used by tests).
 * @param {number} [options.yellowMinScore]
 * @param {number} [options.redMinScore]
 * @returns {{
 *   verdict: 'red'|'yellow'|'green',
 *   severity: 'danger'|'caution'|'safe',
 *   score: number,
 *   matchedRules: Array<object>,
 *   safeSignals: Array<object>,
 *   summaryKey: string,
 *   reasons: string[],
 *   recommendedActions: string[],
 *   matchedPhrases: string[]
 * }}
 */
export function checkSafety(rawText, options = {}) {
  const rules = options.rules || SCAM_RULES;
  const yellowMin = options.yellowMinScore ?? THRESHOLDS.yellowMinScore;
  const redMin = options.redMinScore ?? THRESHOLDS.redMinScore;
  const instantRed = options.instantRedRuleIds || THRESHOLDS.instantRedRuleIds;

  const original = String(rawText || '');
  const text = normaliseText(original);
  const isEmpty = text.length < 3;

  const matchedRules = [];
  let score = 0;
  const matchedPhrases = [];

  for (const rule of rules) {
    const hits = [];

    for (const phrase of rule.phrases || []) {
      if (containsPhrase(text, phrase)) hits.push(phrase);
    }
    for (const sourceRegex of rule.regex || []) {
      // The regexes are written against normalised text (lowercased, no
      // punctuation), so we test them as-is.
      try {
        if (sourceRegex.test(text)) hits.push(sourceRegex.source);
      } catch {
        // A malformed user-supplied regex must never break the app.
      }
    }

    if (hits.length > 0) {
      // Each rule counts once, even if several of its phrases matched, so a
      // long message cannot inflate the score by repeating itself.
      score += rule.weight;
      matchedPhrases.push(...hits);
      matchedRules.push({
        id: rule.id,
        severity: rule.severity,
        weight: rule.weight,
        titleKey: rule.titleKey,
        title: rule.title,
        explanationKey: rule.explanationKey,
        explanation: rule.explanation,
        safeActionKey: rule.safeActionKey,
        safeAction: rule.safeAction,
        matchedPhrases: hits,
      });
    }
  }

  // Strongest first so the UI can show the most important reason up top.
  const severityRank = { [SEVERITY.DANGER]: 0, [SEVERITY.CAUTION]: 1, [SEVERITY.SAFE]: 2 };
  matchedRules.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.weight - a.weight;
  });

  // Safe signals: the reassuring things that were found in the message.
  const secretRules = new Set(['otp-request', 'pin-request', 'password-request', 'personal-data']);
  const askedForSecret = matchedRules.some((r) => secretRules.has(r.id));
  const safeSignals = [];
  for (const signal of SAFE_SIGNALS) {
    if (signal.special === 'no-secret-request') {
      if (!isEmpty && !askedForSecret) {
        safeSignals.push({ id: signal.id, labelKey: signal.labelKey, label: signal.label });
      }
      continue;
    }
    if (signal.regex?.some((r) => r.test(original))) {
      safeSignals.push({ id: signal.id, labelKey: signal.labelKey, label: signal.label });
    }
  }

  const hasInstantRed = matchedRules.some((r) => instantRed.includes(r.id));
  let verdict;
  if (isEmpty) {
    verdict = VERDICT.YELLOW; // Nothing to judge - show a "tell me more" state.
  } else if (hasInstantRed || score >= redMin) {
    verdict = VERDICT.RED;
  } else if (score >= yellowMin) {
    verdict = VERDICT.YELLOW;
  } else {
    verdict = VERDICT.GREEN;
  }

  const severity =
    verdict === VERDICT.RED
      ? SEVERITY.DANGER
      : verdict === VERDICT.YELLOW
        ? SEVERITY.CAUTION
        : SEVERITY.SAFE;

  return {
    verdict,
    severity,
    score,
    matchedRules,
    safeSignals,
    matchedPhrases,
    reasons: matchedRules.map((r) => r.explanation),
    recommendedActions: matchedRules.map((r) => r.safeAction),
    summaryKey:
      verdict === VERDICT.RED
        ? 'verdict.red'
        : verdict === VERDICT.YELLOW
          ? 'verdict.yellow'
          : 'verdict.green',
  };
}

/**
 * Human-readable list of the rules, used by the "How we decide" screen so the
 * checking is never a black box.
 */
export function listRulesForDisplay() {
  return SCAM_RULES.map((r) => ({
    id: r.id,
    severity: r.severity,
    weight: r.weight,
    titleKey: r.titleKey,
    title: r.title,
    explanationKey: r.explanationKey,
    explanation: r.explanation,
    safeActionKey: r.safeActionKey,
    safeAction: r.safeAction,
    phraseCount: (r.phrases || []).length,
    samplePhrases: (r.phrases || []).slice(0, 3),
  }));
}
