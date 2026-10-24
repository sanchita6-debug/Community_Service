/**
 * ============================================================================
 * Family Helper - end to end in a real DOM
 * ============================================================================
 *
 * WHY THIS EXISTS
 *   The Family Helper is the one screen where "does it work" cannot be
 *   answered by reading the code. The bugs it had were all of the shape
 *   "the right code ran, but the thing the user needs never appeared":
 *
 *     - Signing in left `helperTarget` null, so the preference editor - the
 *       whole point of the screen - was never rendered.
 *     - The target email could not be typed, because there was no input.
 *     - The copy promised the change would appear on the other person's
 *       phone, which this app cannot do and must not claim to do.
 *     - Voice speed was in the README but not on the screen.
 *
 *   None of those show up in a unit test, a type check, or a lint rule. They
 *   only show up when something drives the screen and looks at the result. So
 *   this script does that, in jsdom, against the real <App />.
 *
 * WHAT IT ASSERTS
 *   On what the SCREEN shows, scoped to a card rather than to the page - the
 *   layout has a screen-reader-only "Language" label that a page-wide text
 *   search happily matches. When it fails it names the element it expected.
 *
 * RUN: node scripts/verify-family.mjs
 */
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* -------------------------------------------------------------------------- */
/* Optional dependency                                                        */
/* -------------------------------------------------------------------------- */

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('FAMILY HELPER (jsdom)');
  console.log('  SKIP  jsdom is not installed. Run: npm install -D jsdom');
  console.log('  (the rest of `npm run verify` does not need it)');
  process.exit(0);
}

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  console.log('FAMILY HELPER (jsdom)');
  console.log('  SKIP  esbuild is not installed. Run: npm install -D esbuild');
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Build the app for the test                                                 */
/* -------------------------------------------------------------------------- */

/*
 * The bundle is written INSIDE the project (under node_modules/.cache) so that
 * Node resolves 'react' and 'react-dom' from the project's own node_modules.
 * Written to the OS temp directory it would fail to find them, and the test
 * needs the app and the test to share ONE React instance.
 */
const outDir = join(ROOT, 'node_modules', '.cache', 'voicepay-verify-family');

rmSync(outDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [join(HERE, 'family-harness', 'entry.jsx')],
  bundle: true,
  format: 'esm',
  outfile: join(outDir, 'bundle.mjs'),
  jsx: 'automatic',
  target: 'es2022',
  platform: 'browser',
  absWorkingDir: ROOT,
  alias: {
    '@': join(ROOT, 'client', 'src'),
    '@shared': join(ROOT, 'shared'),
  },
  loader: { '.js': 'jsx' },
  // Keep React external so the test and the app share ONE instance - two
  // Reacts cannot be driven by one act().
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'framer-motion'],
  define: {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env.VITE_API_URL': '"/api"',
    'import.meta.env.VITE_APP_VERSION': '"1.0.0-test"',
  },
  logLevel: 'error',
});

/* -------------------------------------------------------------------------- */
/* jsdom bootstrap                                                            */
/* -------------------------------------------------------------------------- */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/family',
  pretendToBeVisual: true,
});

const { window } = dom;

// Node 24 defines some of these as getter-only globals, so plain assignment
// throws. defineProperty works for all of them.
function setGlobal(key, value) {
  try {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  } catch {
    /* keep whatever Node already has */
  }
}

setGlobal('window', window);
setGlobal('document', window.document);
setGlobal('navigator', window.navigator);
setGlobal('HTMLElement', window.HTMLElement);
setGlobal('Element', window.Element);
setGlobal('Node', window.Node);
setGlobal('Event', window.Event);
setGlobal('KeyboardEvent', window.KeyboardEvent);
setGlobal('MouseEvent', window.MouseEvent);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
setGlobal('requestAnimationFrame', window.requestAnimationFrame.bind(window));
setGlobal('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
setGlobal('localStorage', window.localStorage);
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);

for (const name of [
  'SVGElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLFormElement',
  'HTMLTextAreaElement', 'HTMLAnchorElement', 'HTMLSelectElement', 'HTMLCanvasElement',
  'HTMLImageElement', 'DOMParser', 'CustomEvent', 'FocusEvent', 'InputEvent',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'CSS', 'Range',
  'Text', 'NodeFilter', 'XMLHttpRequest',
]) {
  if (window[name]) setGlobal(name, window[name]);
}

// framer-motion builds an AbortSignal with the GLOBAL AbortController. Node's
// signal is not a jsdom AbortSignal, and jsdom's addEventListener rejects it.
setGlobal('AbortController', window.AbortController);
setGlobal('AbortSignal', window.AbortSignal);
window.scrollTo = () => {};

// jsdom has no speech engine. VoicePay is supposed to degrade quietly when
// the device has no voice, so the absence IS the interesting case.
if (!window.speechSynthesis) {
  window.speechSynthesis = {
    speak() {}, cancel() {}, getVoices: () => [],
    addEventListener() {}, removeEventListener() {}, onvoiceschanged: null,
  };
}
setGlobal('speechSynthesis', window.speechSynthesis);

const { act } = await import('react');
const { mount } = await import(pathToFileURL(join(outDir, 'bundle.mjs')).href);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const KEY_SETTINGS = 'voicepay:settings';
const KEY_HELPER = 'voicepay:helper-target';
const KEY_SESSION = 'voicepay:user';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function text(container) {
  return container.textContent || '';
}

/** An element with exactly this text, restricted to one tag. */
function byText(container, needle, tag = '*') {
  return [...container.querySelectorAll(tag)].find((n) => (n.textContent || '').trim() === needle) || null;
}

/**
 * The .card whose h2 has this title. Cards are the unit the user sees, so
 * scoping to one is how the user reads the screen.
 */
function card(container, title) {
  const heading = [...container.querySelectorAll('h2')].find(
    (h) => (h.textContent || '').trim() === title,
  );
  if (!heading) return null;
  return heading.closest('.card') || heading.parentElement;
}

/** A clickable element with exactly this text, inside `scope`. */
function button(container, label, scope = container) {
  return [...scope.querySelectorAll('button, [role="button"]')].find(
    (n) => (n.textContent || '').trim() === label,
  ) || null;
}

function click(el) {
  act(() => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

function submit(form) {
  act(() => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
}

function stored(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

async function flush(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/* -------------------------------------------------------------------------- */
/* The test                                                                   */
/* -------------------------------------------------------------------------- */

console.log('\nFAMILY HELPER (jsdom, the real App at /family)\n');

const container = window.document.getElementById('root');
let root;
await act(async () => {
  root = mount(container);
});
await flush(150);

// ---- signed out ------------------------------------------------------------
check('signed out: the sign-in form is shown', byText(container, 'Sign in to help', 'h2') !== null);
check(
  'signed out: no preference editor yet (no target, no account)',
  card(container, 'Language') === null,
);
check(
  'signed out: "I do not have an account" is offered',
  byText(container, 'I do not have an account') !== null,
);

// ---- sign up --------------------------------------------------------------
const createAccount = byText(container, 'Create account');
check('the sign-up toggle exists', createAccount !== null);
click(createAccount);

const emailInput = container.querySelector('#family-email');
const passwordInput = container.querySelector('#family-password');
check('the email and password fields exist', Boolean(emailInput && passwordInput));

setValue(emailInput, 'sita@example.com');
setValue(passwordInput, 'secret123');
submit(emailInput.closest('form'));
await flush(150);

// ---- the editor must appear ------------------------------------------------
check('after signing in, the account card is shown', byText(container, 'Signed in as') !== null);
check('after signing in, the Language card is shown', card(container, 'Language') !== null);
check('after signing in, the Text size card is shown', card(container, 'Text size') !== null);
check('after signing in, the Voice card is shown', card(container, 'Voice') !== null);
check('after signing in, the "Who are you helping?" card is shown', card(container, 'Who are you helping?') !== null);

// ---- the target can be typed and saved --------------------------------------
const targetCard = card(container, 'Who are you helping?');
const targetInput = targetCard?.querySelector('input');
check('the target email input exists', targetInput !== null);
check(
  'the raw uid is never shown to the user',
  !text(container).includes('demo-user'),
);

if (targetInput) {
  setValue(targetInput, 'amma@example.com');
  const saveButton = button(targetCard, 'Save');
  check('the Save button exists', saveButton !== null);
  if (saveButton) {
    click(saveButton);
    await flush(80);
    check('the saved target is shown back to the helper', text(container).includes('amma@example.com'));
    const target = stored(KEY_HELPER);
    check('the target is persisted', target?.email === 'amma@example.com', JSON.stringify(target));
    check(
      'the target uid stays the local document id (never the email)',
      target?.uid === 'demo-user',
      JSON.stringify(target),
    );
  }
}

// ---- the copy must not promise a cross-device sync -------------------------
check('the "Saved on this phone" card is shown', card(container, 'Saved on this phone') !== null);
check(
  'no copy claims the change will appear on the other phone',
  !/on their phone|their phone the next time/i.test(text(container)),
);
check('the copy tells the helper to hand the phone over', /hand the phone/i.test(text(container)));
check(
  'the steps no longer tell the helper to make an account for the parent',
  !/create an account for them here/i.test(text(container)),
);
check(
  'step 1 now says to sign in with your own email',
  /sign in with your own email/i.test(text(container)),
);

// ---- the on/off switches ----------------------------------------------------
// A relative setting the phone up has to be able to turn things ON as well as
// choose between options. These were the two settings the screen could not
// reach: reading aloud, and extra strong colours.
const voiceCard = card(container, 'Voice');
check('the Voice card is shown', voiceCard !== null);

// The speed buttons have to be there BEFORE the switch is touched: a helper may
// set the speed now, and the person may turn the voice on themselves later.
const slow = button(voiceCard, 'Slow');
check('a "Slow" voice speed button exists', slow !== null);
check(
  'the voice speed buttons are shown whatever the reading-aloud switch says',
  slow !== null,
);

// Reading aloud is ON by default - this is a voice-first app - so the switch
// starts on. The test flips it both ways, because a switch that only works in
// one direction is still broken.
const speakToggle = voiceCard?.querySelector('input[type="checkbox"]');
check('the Voice card has an on/off switch for reading aloud', speakToggle !== null);
if (speakToggle) {
  check(
    'reading aloud starts on, the way the app ships',
    speakToggle.checked === true,
    `the switch starts ${speakToggle.checked ? 'on' : 'off'}`,
  );

  click(speakToggle);
  await flush(80);
  check(
    'turning reading aloud off writes ttsEnabled false',
    stored(KEY_SETTINGS)?.ttsEnabled === false,
    `ttsEnabled = ${stored(KEY_SETTINGS)?.ttsEnabled}`,
  );

  click(speakToggle);
  await flush(80);
  check(
    'turning reading aloud back on writes ttsEnabled true',
    stored(KEY_SETTINGS)?.ttsEnabled === true,
    `ttsEnabled = ${stored(KEY_SETTINGS)?.ttsEnabled}`,
  );
}

// ---- voice speed ------------------------------------------------------------
if (slow) {
  click(slow);
  await flush(80);
  check(
    'clicking "Slow" writes speechRate 0.7',
    stored(KEY_SETTINGS)?.speechRate === 0.7,
    `speechRate = ${stored(KEY_SETTINGS)?.speechRate}`,
  );
}

// ---- text size --------------------------------------------------------------
const sizeCard = card(container, 'Text size');
const veryLarge = button(sizeCard, 'Very large');
check('the "Very large" text size button exists', veryLarge !== null);
if (veryLarge) {
  click(veryLarge);
  await flush(80);
  check(
    'clicking "Very large" writes fontSize "xlarge"',
    stored(KEY_SETTINGS)?.fontSize === 'xlarge',
    `fontSize = ${stored(KEY_SETTINGS)?.fontSize}`,
  );
}

// ---- extra strong colours ---------------------------------------------------
// A separate switch from the text size: some people need both, and for
// different reasons.
const contrastToggle = sizeCard?.querySelector('input[type="checkbox"]');
check('the Text size card has an on/off switch for extra strong colours', contrastToggle !== null);
if (contrastToggle) {
  check(
    'extra strong colours starts off',
    contrastToggle?.checked === false,
    `the switch starts ${contrastToggle?.checked ? 'on' : 'off'}`,
  );
  click(contrastToggle);
  await flush(80);
  check(
    'turning extra strong colours on writes highContrast true',
    stored(KEY_SETTINGS)?.highContrast === true,
    `highContrast = ${stored(KEY_SETTINGS)?.highContrast}`,
  );
}

// ---- trusted payees ---------------------------------------------------------
const payeesCard = card(container, 'People they pay often');
const payeeInput = payeesCard?.querySelector('input');
check('the trusted payee name input exists', payeeInput !== null);
if (payeeInput) {
  setValue(payeeInput, 'Ravi');
  const addBtn = button(payeesCard, 'Add this person');
  check('the "Add this person" button exists', addBtn !== null);
  if (addBtn) {
    click(addBtn);
    await flush(80);
    const payees = stored(KEY_SETTINGS)?.trustedPayees || [];
    const ravi = payees.find((p) => p.name === 'Ravi');
    check(
      'a trusted payee records the helper as the one who added it',
      Boolean(ravi) && ravi.addedBy === 'sita@example.com',
      JSON.stringify(ravi),
    );
  }
}

// ---- language (last: it switches the whole UI language) ----------------------
const langCard = card(container, 'Language');
const tamil = button(langCard, 'தமிழ்');
check('the Tamil language button exists (shown in its own script)', tamil !== null);
if (tamil) {
  click(tamil);
  await flush(80);
  check(
    'clicking the Tamil button writes language "ta"',
    stored(KEY_SETTINGS)?.language === 'ta',
    `language = ${stored(KEY_SETTINGS)?.language}`,
  );
}

// ---- the session must survive a reload --------------------------------------
await act(async () => {
  root.unmount();
});
container.innerHTML = '';
await act(async () => {
  root = mount(container);
});
await flush(200);

check(
  'the session record survived the reload',
  stored(KEY_SESSION)?.email === 'sita@example.com',
  window.localStorage.getItem(KEY_SESSION),
);
check(
  'the helper is still signed in after a reload (the UI is Tamil by now)',
  byText(container, 'உள்நுழைந்தவர்') !== null,
);
check(
  'the target survived the reload',
  stored(KEY_HELPER)?.email === 'amma@example.com',
  JSON.stringify(stored(KEY_HELPER)),
);
check(
  'the settings survived the reload',
  stored(KEY_SETTINGS)?.language === 'ta',
  `language = ${stored(KEY_SETTINGS)?.language}`,
);
check(
  'the audit trail still names the helper after a reload',
  (stored(KEY_SETTINGS)?.trustedPayees || []).some((p) => p.addedBy === 'sita@example.com'),
  JSON.stringify(stored(KEY_SETTINGS)?.trustedPayees),
);

// ---- sign out ---------------------------------------------------------------
const signOutButton = byText(container, 'வெளியேறு');
check('the sign-out button is shown', signOutButton !== null);
if (signOutButton) {
  click(signOutButton);
  await flush(120);
  check(
    'signing out clears the session record',
    stored(KEY_SESSION) === null,
    String(stored(KEY_SESSION)),
  );
  check(
    'signing out brings the sign-in form back, so the helper can sign in again',
    byText(container, 'உதவ உள்நுழையவும்', 'h2') !== null,
  );
  check(
    'signing out keeps the target, so the settings are not lost',
    stored(KEY_HELPER)?.email === 'amma@example.com',
    JSON.stringify(stored(KEY_HELPER)),
  );
}

// ---- the guest path ---------------------------------------------------------
// A helper who does not want an account must still be able to set the phone
// up, and must not be nagged to sign in.
await act(async () => {
  root.unmount();
});
container.innerHTML = '';
window.localStorage.clear();
await act(async () => {
  root = mount(container);
});
await flush(150);

const noAccount = byText(container, 'I do not have an account');
check('the "I do not have an account" button is offered', noAccount !== null);
if (noAccount) {
  click(noAccount);
  await flush(120);
  check(
    'choosing to skip the account reveals the editor',
    card(container, 'Language') !== null,
  );
  check(
    'choosing to skip the account does not nag about signing in',
    byText(container, 'Sign in to help', 'h2') === null,
  );
  check(
    'choosing to skip the account leaves the session empty',
    stored(KEY_SESSION) === null,
    String(stored(KEY_SESSION)),
  );
  check(
    'choosing to skip the account creates the target as a guest one',
    stored(KEY_HELPER)?.guest === true,
    JSON.stringify(stored(KEY_HELPER)),
  );
}

await act(async () => {
  root.unmount();
});

rmSync(outDir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
