/**
 * POST /api/explain-transaction
 * ---------------------------------------------------------------------------
 * Takes a pasted UPI/bank SMS (or OCR text) and returns a plain-language
 * explanation plus a safety verdict.
 *
 * Body: { text: string, lang?: 'en'|'hi'... }
 * Returns the shape produced by shared/transactionParser.js.
 */
import express from 'express';
import { explainTransaction } from '../../../shared/transactionParser.js';
import { checkSafety } from '../../../shared/scamRules.js';

const router = express.Router();

router.post('/', (req, res) => {
  const { text, lang = 'en' } = req.body || {};

  if (typeof text !== 'string' || text.trim().length < 5) {
    return res.status(400).json({
      ok: false,
      error: 'explain.error.tooShort',
      message: 'Please paste the full message from your phone.',
    });
  }

  // Guard against someone pasting a whole novel.
  if (text.length > 8000) {
    return res.status(413).json({
      ok: false,
      error: 'explain.error.tooLong',
      message: 'That message is too long. Please paste only the transaction message.',
    });
  }

  try {
    const result = explainTransaction(text, { checkSafetyFn: checkSafety, now: new Date() });

    // Strip the raw text back out of the safety block to keep the payload
    // small, and add a spoken summary for TTS on the client.
    return res.json({
      ok: true,
      lang,
      ...result,
      // Convenience so the client can build one sentence without templating.
      spokenSummaryKey: result.summaryKey,
      disclaimer:
        'VoicePay only explains the text you pasted. It cannot check your real bank account and no money is ever moved.',
    });
  } catch (err) {
    console.error('[explain-transaction]', err);
    return res.status(500).json({
      ok: false,
      error: 'explain.error.internal',
      message: 'Something went wrong while reading that message. Please try again.',
    });
  }
});

export default router;
