/**
 * ============================================================================
 * Auth context - a local helper profile, used ONLY for Family Helper Mode
 * ============================================================================
 *
 * The main VoicePay experience needs no profile. A relative helping a parent
 * names themselves so they can set language, text size, and trusted payees.
 *
 * There is no server and no database, so this is NOT a login. It is a profile
 * kept on this device (client/src/lib/localAuth.js) whose only jobs are to keep
 * the "changed by" audit trail honest and to stop two people sharing a phone
 * from overwriting each other. It protects nothing.
 *
 * Because it is local, it always works: there is nothing to configure and no
 * backend to be unreachable, so no screen has to handle a "not available" case.
 *
 * TWO THINGS, NOT ONE
 *   `user` is who is doing the changing (the relative). `helperTarget` is whose
 *   phone it is (the parent). They are deliberately separate: the parent's
 *   email is a label the relative types in, and it is never used as an id, so
 *   it can never be mistaken for a login.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthChange,
  signIn as localSignIn,
  signUp as localSignUp,
  signOut as localSignOut,
  getAccessToken,
  mapAuthError,
} from '../lib/localAuth.js';
import { KEYS, read, write, remove } from '../lib/storage.js';

const AuthContext = createContext(null);

/**
 * The uid every helper target must carry.
 *
 * It is NOT the uid of the person being helped - there is no such uid, because
 * there is no account for them and no link between the two phones. It is the
 * one local document this browser owns, and it is the only uid the API will
 * accept a write for: every request is stamped with 'demo-user' by
 * server/src/auth.js, so writing to any other id is refused with a 403.
 *
 * The email that goes with a target is a LABEL ("whose phone is this?"), never
 * an id. Keeping that split here means no screen has to remember it.
 */
export const LOCAL_TARGET_UID = 'demo-user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [error, setError] = useState(null); // an i18n key, e.g. 'family.errors...'
  const [busy, setBusy] = useState(false);

  // Who this device is helping. Stored separately from the signed-in profile so
  // a helper can switch which person they are setting up.
  const [helperTarget, setHelperTargetState] = useState(() => read(KEYS.helper, null));

  useEffect(() => onAuthChange((u) => {
    setUser(u);
    setInitialising(false);
  }), []);

  /**
   * Makes sure a helper target exists once somebody has signed in.
   *
   * Without this, signing in - the path the screen nudges people towards -
   * left `helperTarget` null, and the preference editor, which is the entire
   * point of the screen, was never rendered. A helper who did the right thing
   * got a "Signed in as Sita" card and nothing they could actually change.
   *
   * The target is created with NO email on purpose: the person being helped is
   * typed in by the helper, and the helper's own account is a different thing
   * (it is the audit trail - "changed by Sita" - not the target).
   */
  const ensureHelperTarget = useCallback(() => {
    const existing = read(KEYS.helper, null);
    if (existing) {
      // Signing in promotes a guest target to a real one, so that signing out
      // later offers the form again instead of the "no account" note. Without
      // this a helper who signed in and then signed out could never sign in
      // again from this screen.
      if (existing.guest) {
        const promoted = { ...existing, guest: false };
        write(KEYS.helper, promoted);
        setHelperTargetState(promoted);
      }
      return;
    }
    const next = { uid: LOCAL_TARGET_UID, email: null, local: true, guest: false };
    write(KEYS.helper, next);
    setHelperTargetState(next);
  }, []);

  const signIn = useCallback(async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      await localSignIn(email.trim(), password);
      ensureHelperTarget();
      return true;
    } catch (err) {
      setError(mapAuthError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureHelperTarget]);

  const signUp = useCallback(async (email, password, displayName) => {
    setBusy(true);
    setError(null);
    try {
      await localSignUp(email.trim(), password, displayName?.trim());
      ensureHelperTarget();
      return true;
    } catch (err) {
      setError(mapAuthError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureHelperTarget]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await localSignOut();
      setError(null);
    } catch {
      /* nothing useful to do */
    } finally {
      setBusy(false);
    }
  }, []);

  const setHelperTarget = useCallback((target) => {
    setHelperTargetState(target);
    if (target) write(KEYS.helper, target);
    else remove(KEYS.helper);
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialising,
      error,
      busy,
      isSignedIn: Boolean(user),
      // True when a relative has chosen whose phone they are configuring.
      hasHelperTarget: Boolean(helperTarget),
      helperTarget,
      signIn,
      signUp,
      signOut,
      // Always null: the API treats every caller as the local demo user. Passed
      // to settings calls so that plumbing stays in one place.
      getAccessToken,
      setHelperTarget,
      clearError: () => setError(null),
    }),
    [user, initialising, error, busy, helperTarget, signIn, signUp, signOut, setHelperTarget]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
