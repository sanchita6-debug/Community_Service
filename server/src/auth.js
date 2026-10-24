/**
 * Request identity.
 * ---------------------------------------------------------------------------
 * There is no account system, so every request is anonymous.
 * VoicePay's guidance features are public on purpose: someone should be able to
 * read a message aloud without creating anything first.
 *
 * The single local uid is the same 'demo-user' the browser uses in localStorage,
 * which is what makes the API and the phone agree on which document to read and
 * write.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   It does not verify an `Authorization: Bearer` header, and it must never be
 *   made to. A token that arrives here is unverified input, and `uid` is read
 *   from a request header, so treat both as display metadata only - never as an
 *   authorisation decision. routes/settings.js still checks ownership, and that
 *   check is only meaningful because every caller shares one uid.
 */
const LOCAL_UID = 'demo-user';

export function attachUser(req, _res, next) {
  req.auth = {
    uid: LOCAL_UID,
    email: null,
    name: null,
    anonymous: true,
  };
  return next();
}

export { LOCAL_UID };


