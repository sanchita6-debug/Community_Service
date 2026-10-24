/**
 * Verifies the transaction parser against every message the app ships, plus
 * the awkward phrasings that broke it during development.
 * Run: node scripts/verify-parser.mjs
 */
import { explainTransaction } from '../shared/transactionParser.js';
import { SAMPLE_SMS, PRACTICE_MESSAGES } from '../shared/demoData.js';

let pass = 0;
let fail = 0;

function check(label, text, expected) {
  const r = explainTransaction(text);
  const bad = Object.entries(expected).filter(([k, v]) => r[k] !== v);
  const ok = bad.length === 0;
  ok ? pass++ : fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(24)}` +
      `${r.direction}/${r.status} ${String(r.amount?.value ?? '-').padEnd(9)}` +
      `who=${String(r.counterparty ?? '-').padEnd(22)}` +
      `${bad.length ? ' <-- ' + bad.map(([k, v]) => `${k}=${r[k]} want=${v}`).join(' ') : ''}`
  );
}

console.log('\nSHIPPED SAMPLES');
check(
  'debit-success',
  SAMPLE_SMS[0].text,
  { direction: 'debit', status: 'success', counterparty: 'Ramesh Kumar' }
);
check('credit-salary', SAMPLE_SMS[1].text, { direction: 'credit', status: 'success', counterparty: 'Sunrise Textiles Pvt Ltd' });
check('failed-txn', SAMPLE_SMS[2].text, { direction: 'debit', status: 'failed', counterparty: 'Suresh Kumar' });
check('otp-scam', SAMPLE_SMS[3].text, { direction: 'unknown', counterparty: null });
check('kyc-scam', SAMPLE_SMS[4].text, { direction: 'unknown' });

console.log('\nSHIPPED PRACTICE MESSAGES');
check('practice-normal-txn', PRACTICE_MESSAGES[1].text, { direction: 'debit', status: 'success', counterparty: 'Sita Devi' });
check('practice-normal-receipt', PRACTICE_MESSAGES[3].text, { direction: 'credit', status: 'success', counterparty: 'Amit Verma' });
// No real counterparty here, and inventing one would be worse than none.
check('practice-pension', PRACTICE_MESSAGES[6].text, { direction: 'credit', counterparty: null });

/**
 * The name must be found even when an ordinary word follows it, and must NOT
 * be invented when the message names nobody.
 */
const COUNTERPARTY = [
  ['followed by "today"', 'Rs.500 credited to you towards salary from Sunrise Textiles Pvt Ltd today.', 'Sunrise Textiles Pvt Ltd'],
  ['followed by "was"', 'Your UPI transaction of Rs.2,000 to Suresh Kumar was FAILED.', 'Suresh Kumar'],
  ['with VPA in brackets', 'Rs.900 debited towards UPI payment to Amit Verma (VPA amit@okhdfc).', 'Amit Verma'],
  ['with title prefix', 'Rs.400 received from Dr. Anita Rao.', 'Anita Rao'],
  ['upi id only', 'Rs.200 debited to ramesh@ybl. Ref No. 123456', 'Ramesh'],
  ['nobody named', 'Rs.1,15,400 credited to your account. This is your regular monthly pension.', null],
  ['no money at all', 'Your OTP is 482913. Please share it with the support agent.', null],
  ['empty string', '', null],
  ['gibberish', 'asdkjh askdjh', null],
];

console.log('\nCOUNTERPARTY RESOLUTION');
for (const [label, text, want] of COUNTERPARTY) {
  const got = explainTransaction(text).counterparty;
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(24)}got=${String(got).padEnd(24)}${ok ? '' : `want=${want}`}`);
}

console.log('\nSTATUS HONESTY');
// "failed" must always win over any success wording, and a promise of future
// credit must never be reported as money that has already arrived.
const STATUS = [
  ['completed credit', 'You have received Rs.1,500 from Amit Verma.', 'success'],
  ['future credit is not success', 'Rs.5,000 will be received in your account tomorrow.', 'unknown'],
  ['failure beats other wording', 'Your UPI transaction of Rs.2,000 to Suresh Kumar was FAILED. Amount was debited.', 'failed'],
  ['pending', 'Your withdrawal of Rs.900 is pending at the ATM.', 'pending'],
  ['no status words', 'Rs.300 transaction, reference 123456789012.', 'unknown'],
];
for (const [label, text, want] of STATUS) {
  const got = explainTransaction(text).status;
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(30)}got=${String(got).padEnd(10)}${ok ? '' : `want=${want}`}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
