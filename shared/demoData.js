/**
 * ============================================================================
 * VoicePay - Seed / Demo data
 * ============================================================================
 *
 * Makes the app feel alive on first load. Everything here is FAKE.
 * No real bank account, no real person, no real UPI id is referenced.
 * The UPI ids use the reserved-looking "voicepay-demo" handle on purpose.
 */

/** Sample SMS messages the user can try in the Explainer with one tap. */
export const SAMPLE_SMS = [
  {
    id: 'debit-success',
    labelKey: 'samples.debitSuccess',
    // The normal, boring, good message.
    text: 'Dear Customer, Rs.500.00 has been debited from your A/C XXXX1234 on 12-09-2025 14:22 towards UPI payment to Ramesh Kumar (VPA rameshdemo@upi). UPI Ref No. 523412345678. Thank you for banking with us.',
  },
  {
    id: 'credit-salary',
    labelKey: 'samples.creditSalary',
    text: 'Rs.12,000.00 has been credited to your account towards salary from Sunrise Textiles Pvt Ltd today. Avl Bal Rs.48,210.55',
  },
  {
    id: 'failed-txn',
    labelKey: 'samples.failedTxn',
    text: 'Your UPI transaction of Rs.2,000 to Suresh Kumar was FAILED. Amount was debited to your bank account. Ref No. 998877665544',
  },
  {
    id: 'otp-scam',
    labelKey: 'samples.otpScam',
    // Pretends to be a refund, then asks for the OTP.
    text: 'HDFC Bank: Your refund of Rs.4,500 is pending. To release it, share your OTP with our support agent now. Do not share with anyone.',
  },
  {
    id: 'kyc-scam',
    labelKey: 'samples.kycScam',
    text: 'URGENT: Your SBI account will be blocked today. Click this link and update your KYC immediately or your account will be closed. Act now!',
  },
];

/** Messages used in the "Is this fraud?" practice game. */
export const PRACTICE_MESSAGES = [
  {
    id: 'practice-otp',
    isFraud: true,
    text: 'Dear customer, we have detected a failed transaction. Kindly share your OTP to verify your account, otherwise your account will be blocked.',
    correctKey: 'learn.practice.explain.otp',
  },
  {
    id: 'practice-normal-txn',
    isFraud: false,
    text: 'Rs.250.00 has been debited from your account towards UPI payment to Sita Devi on 03-10-2025 09:12. UPI Ref No. 511223344556.',
    correctKey: 'learn.practice.explain.normal',
  },
  {
    id: 'practice-install',
    isFraud: true,
    text: 'To keep your account active, install this app from the link below and sign in once. Your account will be blocked otherwise.',
    correctKey: 'learn.practice.explain.install',
  },
  {
    id: 'practice-normal-receipt',
    isFraud: false,
    text: 'You have received Rs.1,500 from Amit Verma. Available balance Rs.22,140. Thank you for using UPI.',
    correctKey: 'learn.practice.explain.receipt',
  },
  {
    id: 'practice-new-number',
    isFraud: true,
    text: 'My new number has been updated to 9876543210 from today. Please transfer to new number for all payments. Confirm by clicking this link.',
    correctKey: 'learn.practice.explain.newNumber',
  },
  {
    id: 'practice-prize',
    isFraud: true,
    text: 'Congratulations! You are the lucky winner of Rs.10,00,000 cash prize. Pay Rs.199 processing fee to claim your prize today.',
    correctKey: 'learn.practice.explain.prize',
  },
  {
    id: 'practice-pension',
    isFraud: false,
    text: 'Your pension of Rs.9,800 has been credited to your savings account. This is your regular monthly pension. Balance Rs.1,15,400.',
    correctKey: 'learn.practice.explain.pension',
  },
  {
    id: 'practice-screenshare',
    isFraud: true,
    text: 'I am calling from the bank fraud department. To stop the fraud, share your screen with me and keep your camera on. Do not hang up.',
    correctKey: 'learn.practice.explain.screenShare',
  },
];

/** Interactive lessons for Learn / Practice mode. */
export const LESSONS = [
  {
    id: 'lesson-otp',
    order: 1,
    titleKey: 'learn.lessons.otp.title',
    title: 'Your OTP is your key. Never share it.',
    minutes: 2,
    steps: [
      { key: 'learn.lessons.otp.s1', icon: 'key' },
      { key: 'learn.lessons.otp.s2', icon: 'shield' },
      { key: 'learn.lessons.otp.s3', icon: 'stop' },
    ],
    quiz: {
      questionKey: 'learn.lessons.otp.quiz.q',
      options: [
        { key: 'learn.lessons.otp.quiz.a', isCorrect: true },
        { key: 'learn.lessons.otp.quiz.b', isCorrect: false },
        { key: 'learn.lessons.otp.quiz.c', isCorrect: false },
      ],
    },
  },
  {
    id: 'lesson-verify',
    order: 2,
    titleKey: 'learn.lessons.verify.title',
    title: 'How to check a UPI payment really went through',
    minutes: 3,
    steps: [
      { key: 'learn.lessons.verify.s1', icon: 'receipt' },
      { key: 'learn.lessons.verify.s2', icon: 'search' },
      { key: 'learn.lessons.verify.s3', icon: 'lock' },
    ],
    quiz: {
      questionKey: 'learn.lessons.verify.quiz.q',
      options: [
        { key: 'learn.lessons.verify.quiz.a', isCorrect: false },
        { key: 'learn.lessons.verify.quiz.b', isCorrect: true },
        { key: 'learn.lessons.verify.quiz.c', isCorrect: false },
      ],
    },
  },
  {
    id: 'lesson-calls',
    order: 3,
    titleKey: 'learn.lessons.calls.title',
    title: 'No real bank ever calls to ask for secrets',
    minutes: 2,
    steps: [
      { key: 'learn.lessons.calls.s1', icon: 'phone' },
      { key: 'learn.lessons.calls.s2', icon: 'hangup' },
      { key: 'learn.lessons.calls.s3', icon: 'card' },
    ],
    quiz: {
      questionKey: 'learn.lessons.calls.quiz.q',
      options: [
        { key: 'learn.lessons.calls.quiz.a', isCorrect: false },
        { key: 'learn.lessons.calls.quiz.b', isCorrect: false },
        { key: 'learn.lessons.calls.quiz.c', isCorrect: true },
      ],
    },
  },
  {
    id: 'lesson-newcontact',
    order: 4,
    titleKey: 'learn.lessons.newcontact.title',
    title: 'If a friend says "my number changed", be careful',
    minutes: 3,
    steps: [
      { key: 'learn.lessons.newcontact.s1', icon: 'contact' },
      { key: 'learn.lessons.newcontact.s2', icon: 'phone' },
      { key: 'learn.lessons.newcontact.s3', icon: 'stop' },
    ],
    quiz: {
      questionKey: 'learn.lessons.newcontact.quiz.q',
      options: [
        { key: 'learn.lessons.newcontact.quiz.a', isCorrect: false },
        { key: 'learn.lessons.newcontact.quiz.b', isCorrect: true },
        { key: 'learn.lessons.newcontact.quiz.c', isCorrect: false },
      ],
    },
  },
];

/** Payees a new user starts with. A relative can edit these in Family Mode. */
export const DEFAULT_TRUSTED_PAYEES = [
  { id: 'tp-1', name: 'Ramesh', vpa: 'rameshdemo@upi', addedBy: 'demo' },
  { id: 'tp-2', name: 'Sita', vpa: 'sitademo@upi', addedBy: 'demo' },
];

/** A default settings object, matching the `settings/{id}` shape in server/src/schema.js. */
export const DEFAULT_USER_SETTINGS = {
  language: 'en',
  fontSize: 'large', // 'normal' | 'large' | 'xlarge'
  speechRate: 0.9,
  trustedPayees: DEFAULT_TRUSTED_PAYEES,
  ttsEnabled: true,
  highContrast: false,
  // Which of the two screens the app uses: 'light' or 'dark'. Light is the
  // default because it is what the phone was showing before the app had a
  // dark theme at all, and a person who never opens Settings should not find
  // the screen they are used to has changed.
  theme: 'light',
  demoMode: true,
};
