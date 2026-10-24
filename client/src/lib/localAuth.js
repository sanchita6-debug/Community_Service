/**
 * ============================================================================
 * Local auth - accounts stored on this device only
 * ============================================================================
 *
 * There is no server and no database, so "sign in" here means something much
 * smaller than an account: it names the helper on THIS phone and keeps the
 * audit trail ("changed by Sita") honest.
 *
 * WHAT THIS IS NOT
 *   This is NOT authentication. It is not a login, and it does not protect
 *   anything. The password is never sent anywhere and never checked against
 *   anything authoritative - it exists only so a relative does not have to
 *   re-type it, and so two people sharing a phone do not edit each other's
 *   settings by accident. The SHA-256 below is there so a password is not
 *   sitting in localStorage in plain text, NOT because it defends anything:
 *   anyone with dev tools can read the digest and the salt right next to it.
 *
 *   Treat the stored records as disposable device state. Nothing here is a
 *   security boundary, and the API treats every request as anonymous regardless.
 *
 * PRIVACY
 *   Email, display name, and a salted password digest. No OTP, PIN, card
 *   number, or bank account is ever written.
 *
 * ERROR SHAPE
 *   Failures are thrown with a `code`, and `mapAuthError` turns that into an
 *   i18n key - the same contract the sign-in form expects, so the UI only ever
 *   shows a sentence a non-technical person can act on.
 */
import { KEYS, read, write, remove } from './storage.js';

/** Min length enforced here and mirrored by the form's own validation. */
const MIN_PASSWORD = 6;

/** Random hex, used for both salts and uids. */
function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < bytes; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 via WebCrypto. Present on every browser that supports the PWA, and it
 * keeps a ~60 line crypto implementation out of the bundle.
 *
 * Deliberately NOT a password KDF: bcrypt/argon2 exist to make brute-forcing
 * slow against a real server, and there is no server to attack. See the header.
 */
async function digest(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Throws an Error carrying a `code` that mapAuthError understands. */
function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** The whole account table: `{ [email]: { uid, email, displayName, salt, hash } }`. */
function readAccounts() {
  return read(KEYS.accounts, {});
}

function writeAccounts(accounts) {
  write(KEYS.accounts, accounts);
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Subscribes to sign-in / sign-out. Returns an unsubscribe function.
 *
 * The session lives in localStorage, so a second tab (or a second window) sees
 * the change through the `storage` event. That event does not fire in the tab
 * that made the change, which is why every mutator below also calls the
 * listeners directly.
 */
const listeners = new Set();

function emit() {
  const user = read(KEYS.user, null);
  listeners.forEach((fn) => {
    try {
      fn(user);
    } catch (err) {
      console.warn('[auth] listener failed:', err.message);
    }
  });
}

export function onAuthChange(callback) {
  listeners.add(callback);
  // Prime the new subscriber, matching how a real auth client behaves.
  callback(read(KEYS.user, null));

  const onStorage = (event) => {
    if (event.key === KEYS.user) emit();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Creates an account on this device and signs in.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 */
export async function signUp(email, password, displayName) {
  const key = normaliseEmail(email);
  if (!isValidEmail(key)) throw fail('email_address_invalid');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw fail('weak_password');

  const accounts = readAccounts();
  if (accounts[key]) throw fail('user_already_exists');

  const salt = randomHex();
  const record = {
    uid: randomHex(16),
    email: key,
    displayName: String(displayName || '').trim() || key.split('@')[0],
    salt,
    hash: await digest(password, salt),
    createdAt: new Date().toISOString(),
  };

  writeAccounts({ ...accounts, [key]: record });

  const user = { uid: record.uid, email: record.email, displayName: record.displayName, anonymous: false };
  write(KEYS.user, user);
  emit();
  return user;
}

/**
 * Checks a password against the stored digest and signs in.
 *
 * Throws the SAME `invalid_credentials` for an unknown email as for a wrong
 * password. Reporting them differently would turn the form into a way to find
 * out which addresses exist on the device.
 */
export async function signIn(email, password) {
  const key = normaliseEmail(email);
  if (!isValidEmail(key)) throw fail('invalid_credentials');

  const record = readAccounts()[key];
  if (!record) {
    // Same error, but still do the work so a missing account and a wrong
    // password take a comparable amount of time.
    await digest(String(password || ''), randomHex());
    throw fail('invalid_credentials');
  }

  const hash = await digest(String(password || ''), record.salt);
  if (hash !== record.hash) throw fail('invalid_credentials');

  const user = { uid: record.uid, email: record.email, displayName: record.displayName, anonymous: false };
  write(KEYS.user, user);
  emit();
  return user;
}

/** Forgets the session. The account itself stays, so signing back in works. */
export async function signOut() {
  remove(KEYS.user);
  emit();
}

/**
 * Always null.
 *
 * The API no longer verifies tokens - it treats every caller as the local demo
 * user - so there is nothing to hand it. The function is kept because
 * SettingsContext passes an auth token on every settings call, and removing that
 * plumbing would mean touching the routes for no behavioural gain.
 */
export async function getAccessToken() {
  return null;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Maps a thrown code to an i18n key, so the sign-in form shows a kind,
 * non-technical message instead of an error string.
 *
 * The keys are maintained by hand rather than scanned, because no component
 * ever passes them to `t()` literally - see scripts/verify-i18n.mjs.
 */
export function mapAuthError(err) {
  switch (err?.code) {
    case 'email_address_invalid':
      return 'family.errors.invalidEmail';
    case 'weak_password':
      return 'family.errors.weakPassword';
    case 'user_already_exists':
      return 'family.errors.emailInUse';
    case 'invalid_credentials':
    case 'email_not_confirmed':
      return 'family.errors.authFailed';
    default:
      return 'family.errors.authFailed';
  }
}