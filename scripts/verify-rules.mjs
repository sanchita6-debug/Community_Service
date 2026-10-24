/**
 * Verifies the rule engine against every message the app actually ships.
 * Run: node scripts/verify-rules.mjs
 */
import { checkSafety, THRESHOLDS } from '../shared/scamRules.js';
import { SAMPLE_SMS, PRACTICE_MESSAGES } from '../shared/demoData.js';

function expectVerdict(text) {
  return checkSafety(text).verdict;
}

let pass = 0;
let fail = 0;

function check(label, text, expected) {
  const got = expectVerdict(text);
  const ok = got === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(22)} got=${got.padEnd(7)} want=${expected}`);
}

console.log('\nPRACTICE MESSAGES (from shared/demoData.js)');
for (const m of PRACTICE_MESSAGES) {
  check(m.id, m.text, m.isFraud ? 'red' : 'green');
}

console.log('\nSAMPLE MESSAGES (from shared/demoData.js)');
// samples[2] is a FAILED transaction - a real bank message about a payment
// that did not happen, so it must not read as fraud.
check('failed-txn', SAMPLE_SMS[2].text, 'green');
check('debit-success', SAMPLE_SMS[0].text, 'green');
check('credit-salary', SAMPLE_SMS[1].text, 'green');
check('otp-scam', SAMPLE_SMS[3].text, 'red');
check('kyc-scam', SAMPLE_SMS[4].text, 'red');

/**
 * FALSE POSITIVES ARE THE DANGEROUS DIRECTION.
 * A rule that cries wolf on ordinary bank traffic trains people to ignore it,
 * which defeats the entire purpose. Every message below is something a real
 * bank legitimately sends, and none of them may be anything worse than amber.
 */
const BENIGN = [
  'Your UPI payment of Rs.350 to Reliance Fresh is successful. UPI Ref No. 412398756012.',
  'Rs.1,20,000.00 has been credited to your SB account on 04-10-2025 towards salary. Avl Bal Rs.3,40,210.00',
  'Your EMI of Rs.6,500 for the home loan has been debited. Ref No. 8891234477',
  'OTP 482913 is valid for 10 minutes. Do not share it with anyone. - HDFC Bank',
  'Rs.250 has been debited from your account towards UPI payment to Sita Devi. UPI Ref No. 511223344556',
  'Your account will be closed if the mandate is not approved. Please approve in your banking app.',
  'Statement for your account for September 2025 is ready. Please download it from the app.',
  'Your UPI transaction of Rs.2,000 to Suresh Kumar was FAILED. Ref No. 998877665544',
  'Cheque of Rs.45,000 has been credited to your account. Ref No. 556677889900',
  'You have an auto-pay mandate of Rs.999 for a streaming service. Tap here to manage it.',
];

console.log('\nFALSE POSITIVES (real bank traffic must NOT be red)');
for (const [i, text] of BENIGN.entries()) {
  const r = checkSafety(text);
  const ok = r.verdict !== 'red';
  ok ? pass++ : fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  benign[${i}]`.padEnd(28) +
      `got=${r.verdict.padEnd(7)}score=${String(r.score).padEnd(3)}` +
      `${r.matchedRules.map((x) => x.id).join(',')}`
  );
}

console.log(`\nthresholds: ${JSON.stringify(THRESHOLDS)}`);
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
