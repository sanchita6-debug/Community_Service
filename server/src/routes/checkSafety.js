/**
 * POST /api/check-safety
 * ---------------------------------------------------------------------------
 * Runs the transparent scam-phrase rule engine over typed text, a pasted SMS,
 * or OCR'd screenshot text.
 *
 * Body: { text: string, lang?: string }
 * Returns: { verdict: 'red'|'yellow'|'green', matchedRules, safeSignals, ... }
 *
 * GET /api/check-safety/rules
 *   Returns the rule list so the UI can show exactly how decisions are made.
 */
import express from 'express';
import { checkSafety, listRulesForDisplay, THRESHOLDS } from '../../../shared/scamRules.js';

const router = express.Router();

/** Public: shows the user the rule book, so nothing is hidden. */
router.get('/rules', (_req, res) => {
  res.json({
    ok: true,
    thresholds: THRESHOLDS,
    rules: listRulesForDisplay(),
    disclaimer:
      'These checks look for known scam wording. A "looks safe" result is not a promise that a message is genuine. When unsure, stop and ask someone you trust.',
  });
});

router.post('/', (req, res) => {
  const { text } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'safety.error.empty',
      message: 'Please type, paste, or photograph the message you want to check.',
    });
  }
  if (text.length > 8000) {
    return res.status(413).json({
      ok: false,
      error: 'safety.error.tooLong',
      message: 'That message is too long to check.',
    });
  }

  try {
    const result = checkSafety(text);
    return res.json({
      ok: true,
      // A copy of the text so the client can show "what you checked".
      checkedText: text,
      ...result,
      disclaimer:
        'VoicePay never moves money and never asks for your OTP, PIN, or password. Stop and ask someone you trust if you are unsure.',
    });
  } catch (err) {
    console.error('[check-safety]', err);
    return res.status(500).json({
      ok: false,
      error: 'safety.error.internal',
      message: 'We could not check that message. Please try again or ask a family member.',
    });
  }
});

export default router;
