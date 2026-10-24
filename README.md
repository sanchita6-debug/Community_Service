opencp# VoicePay — Easy UPI for Everyone

A voice-guided assistive layer that helps elderly and low-literacy Indian users
understand and safely perform common UPI tasks.

> **This app never moves money.** It is a practice and learning tool. It is not
> connected to any bank or payment provider, and it never asks for an OTP, UPI
> PIN, password, card number, expiry date, or CVV.

---

## What it does

| Screen | What it is for |
| --- | --- |
| **Send money** | A five-step, fully spoken walkthrough of a UPI payment. Practice mode only — the "Done" screen says so explicitly. |
| **Check a transaction** | Paste (or photograph) a UPI/bank SMS and get it back in plain words: what it says, what was missing, and how to verify it in the banking app. |
| **Is this safe?** | A green / amber / red verdict on any message, with the exact words that triggered it and what to do next. Works by typing, pasting, or on-device OCR. |
| **Learn** | Four short lessons and a "safe or fraud?" practice game (8 messages). Progress is remembered offline. |
| **Family helper** | A relative sets the phone up for the person who will use it: language, text size, extra strong colours, light/dark theme, reading aloud, voice speed, and trusted payees — on the phone in front of them, with no cross-device sync. |
| **History** | Everything the features decided, newest first, filterable by kind, with per-record and per-kind deletion. |
| **Settings** | Language, text size, contrast, theme, voice speed — all usable with no account. |

A calm blue "we never ask for your OTP" banner sits under the app header on
every screen, in the same sticky shell as the header itself. It is blue on
purpose: red is reserved for fraud warnings only, so the colour keeps meaning
exactly one thing.

## Why it is built this way

- **Red means exactly one thing.** Red is only ever used for a likely fraud
  message. "Be careful" is amber, "looks safe" is green. If red meant anything
  else, the people this app is for would stop trusting it.
- **It says what it does not know.** The Explainer lists which parts of a
  message it could not parse, rather than inventing a confident answer.
- **The answer comes back in the message's language.** A Tamil, Telugu,
  Bengali or Hindi SMS gets its verdict and explanation in that language,
  shown and spoken, whatever language the app itself is set to. The person
  is holding the message, so the answer matches it.
- **Nothing depends on a network.** The scam rule engine and the SMS parser live
  in `shared/` and run in the browser. The server is an optional sync layer.
- **Privacy is structural, not a promise.** No field for an OTP or PIN exists
  anywhere in the UI. Photos are read on-device with Tesseract.js and are never
  uploaded — there is no upload path in the app at all.

## Tech stack

- **Client** — React 18, Vite 5, Tailwind CSS 3, Framer Motion, React Router
- **Server** — Express 4, Helmet, rate limiting
- **Shared** — plain ESM, imported by *both* sides (aliased as `@shared`)
- **Storage** — the phone's `localStorage` is the always-available copy; the API
  keeps a second copy in a **SQLite database** (`server/data/voicepay.db`, via
  `better-sqlite3`) so settings, progress, and feature activity survive a
  restart and can be seen from another device. No database server, no cloud
  project, no third party — one file (see `server/src/db.js`, `store.js`)
- **Language** — JavaScript-first. `client/tsconfig.json` sets `allowJs: true`
  and `checkJs: false`, so the 34 `.js`/`.jsx` files under `client/src` are
  never type-checked. The only TypeScript is `client/src/lib/utils.ts` (the
  `cn` helper) and the vendored glass hero described below.
- **Speech** — Web Speech API (SpeechSynthesis + SpeechRecognition), with
  graceful degradation when the device lacks a voice or a microphone
- **OCR** — Tesseract.js, lazy-loaded only when a photo is actually taken
- **PWA** — `vite-plugin-pwa`, installable and usable offline

## Getting started

Requires **Node 22+** (developed on Node 24). `better-sqlite3` 13 ships prebuilt
binaries for Node 22 and 24 and declares `node >= 22`; on an older Node the
install would try to compile from source and fail without a C++ toolchain.

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000/api>

There is **nothing to configure** — no account, no `.env`, no keys. Clone it and
run it.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs client and server together |
| `npm run dev:client` | Runs only the Vite dev server |
| `npm run dev:server` | Runs only the API, with `node --watch` |
| `npm run build` | Production build of the client (into `client/dist`) |
| `npm start` | Serves the API |
| `npm run preview` | Previews the built client on port 4173 |
| `npm run lint` | ESLint over client, server, and shared |
| `npm run typecheck` | `tsc --noEmit -p client/tsconfig.json` |
| `npm run verify` | Runs the safety-engine, translation, voice, type, API and screen test suites (see below) |

## Testing the safety engine

`npm run verify` is not a formality — the two things this app can get wrong are
a missed scam and a false alarm, and both are tested:

- **`verify:rules`** checks every message the app actually ships against the
  expected verdict, and then runs ten *real* bank messages that must **not** be
  flagged red. A rule that cries wolf trains people to ignore it, so false
  positives are treated as failures, not noise.
- **`verify:parser`** checks the SMS parser against the shipped samples plus
  awkward phrasings, and asserts that it reports `null` rather than inventing a
  name when a message names nobody.
- **`verify:i18n`** derives every key the running app can emit and asserts each
  one resolves in English, plus a guard that no screen reads the rule engine's
  English sentences directly instead of going through `t()`.
- **`verify:voice`** checks every language has a BCP-47 tag the browser will
  accept and a voice that `voices.js` can resolve, then drives the real speech
  engine against a fake `speechSynthesis` to prove voices that arrive *late*
  are still used, and that a missing language stays silent rather than being
  read by a wrong-language voice.
- **`verify:typecheck`** runs `tsc --noEmit -p client/tsconfig.json`. The app is
  JavaScript, but `client/src/lib/utils.ts` and the vendored
  `components/ui/glass-headline-hero.tsx` are TypeScript, and nothing else
  would catch a type error in a file that only exists to be imported by a
  `.jsx` page.
- **`verify:api`** boots the real Express app against an in-memory SQLite
  database and drives every endpoint — the allow-list, the `speechRate` clamp,
  the 403 on writing someone else's settings, the helper consent list, the
  lesson/practice validation, the activity log (including the assertion that a
  pasted message is **not** stored), and `DELETE /api/settings/:userId`. It is
  here because a single typo in `server/src/store.js` once stopped the server
  booting at all, and nothing else in the suite would have noticed.
- **`verify:family`** drives the Family Helper screen in a real DOM (jsdom),
  against the real `<App />` (mounted by `scripts/family-harness/entry.jsx`).
  The bugs that screen had were all of the shape
  *"the right code ran, but the thing the user needs never appeared"* —
  signing in left the preference editor unrendered, the target could not be
  typed, the copy promised a cross-device sync the app cannot do, voice speed
  was in the README but not on the screen. None of those show up in a type
  check, a lint rule, or an API test; they only show up when something drives
  the screen and looks at the result. It also checks that the session survives
  a reload and that signing out does not trap the helper.

Five bugs found this way are worth keeping in mind when editing:

- `account-blocked` used to score 5 on its own, which is exactly the red
  threshold — so any genuine notice about a closed account was called fraud.
- `click-link` matched `click this link` but not `clicking this link`, which is
  how people actually write.
- `extractCounterparty` dropped the name in `from Sunrise Textiles Pvt Ltd
  today` and `from Dr. Anita Rao`, both of which the app itself ships.
- The helpers endpoint still called `getDoc`/`setDoc` from the deleted
  `store.js`, so `PUT /api/settings/:userId/helpers` returned a 500 for every
  caller.
- The speech engine listened for `voiceschanged` with `{ once: true }` and
  froze the first voice list. Chrome and Edge announce their online voices —
  the only Hindi, Tamil, Telugu and Bengali voices a stock Windows laptop has —
  in a *later* event, so English always spoke and every other language was
  silent.

## Configuration (optional)

The app runs with **nothing configured**. No database server, no accounts, no
keys — `npm run dev` is correct with no `.env` file at all. The `.env` file
only ever holds ports, origins, and the API URL.

There are two further variables in `.env`:

- The **client** reads it because `client/vite.config.js` sets `envDir` to the
  root. Vite only exposes `VITE_`-prefixed variables to the app.
- The **server** reads it because `server/src/env.js` loads that exact path, so
  it does not matter which directory you run `npm start` from.

| Variable | Read by | What it is |
| --- | --- | --- |
| `VITE_API_URL` | client | Where the app calls the API. `/api` (the Vite dev proxy) by default |
| `VITE_API_PROXY` | `vite.config.js` only | Where the dev server proxies `/api` to. Not part of the bundle |
| `VITE_APP_VERSION` | client | The version string shown on the Settings screen |
| `PORT` | server | The port the API listens on. `4000` |
| `CLIENT_ORIGIN` | server | The origin the client is served from |
| `CORS_ORIGIN` | server | Comma-separated list of allowed origins |
| `DATABASE_PATH` | server | The SQLite file. Defaults to `server/data/voicepay.db`; `:memory:` gives an ephemeral database |

`DATABASE_PATH` is not in `.env.example` because there is nothing to change
about it in normal use — it exists so the test suite can run against a real
database without leaving a file behind.

### Where the data lives

Local first, always. Two places:

1. **The phone's `localStorage`** — the always-available copy, written before
   any network call. Language, text size, voice speed, contrast, theme, trusted
   payee names, lesson progress, the activity history, and the local helper
   profile. This is the record of what the user chose, and it is the copy that
   survives the server being absent, slow, or restarted.
2. **The API's SQLite database** — `server/data/voicepay.db`, one file, created
   on first run. It holds the same documents (`users`, `settings`, `progress`)
   plus an append-only `activity` table. It is the copy that lets a family
   helper see the record from another device, and it survives a restart. No
   database server, no connection string, no third party.

`DATABASE_PATH=:memory:` makes the API use an ephemeral database instead — the
test suite sets this so each run starts clean without leaving a file behind.

There is no account system. The helper profile on the Family screen is a local
label, not a login — it is kept in `localStorage` and protects nothing. See
`client/src/lib/localAuth.js` for why that is stated so bluntly.

### What the features save, and what they never save

Every feature that produces an answer writes one **activity** record, so the
History screen can show what was done and a helper can review it:

| Feature | Recorded | **Never** recorded |
| --- | --- | --- |
| Safety Checker | verdict, score, which rules fired | the message you pasted |
| Transaction Explainer | direction, counterparty name, **amount band** | the message, the account number |
| Send Money (practice) | payee name you typed, **amount band** | the exact amount, any bank detail |
| Learn | lesson id and title | — |
| Practice game | which message, your answer, right/wrong | the message text |

The rule is enforced on **both** sides. `client/src/lib/activity.js` builds a
record from an allow-list of derived facts, so it never reads the pasted text;
`server/src/schema.js` runs the same allow-list again on the way into the
database. A caller that sends `{ text: "…" }` has it dropped, not stored — see
the `POST activity drops the pasted text` assertion in `scripts/smoke-api.mjs`.

An amount is stored as a **band** (`zero`, `under500`, `under5000`,
`under50000`, `over50000`) rather than the figure, because the History screen
only ever shows "under ₹5,000" and a precise figure in a log is more than the
feature needs.

"Delete my data" on the Settings screen removes both copies: the phone's
`localStorage` and the server's rows (`DELETE /api/settings/:userId`).

### API endpoint reference

```
GET    /api/health                     service + store kind + row counts
GET    /api/defaults                   default settings
POST   /api/check-safety               verdict for a message
POST   /api/explain-transaction        structured facts for a UPI SMS
GET    /api/check-safety/rules         the rule book (client copy is authoritative)
GET    /api/settings/:userId           preferences (falls back to defaults)
PUT    /api/settings/:userId           update preferences (allow-listed fields)
DELETE /api/settings/:userId           erase everything stored for this user
PUT    /api/settings/:userId/helpers   family-helper consent list
GET    /api/progress/:userId           lesson + practice progress
PUT    /api/progress/:userId           mark a lesson complete
POST   /api/progress/:userId/practice  record a "safe / fraud" answer
GET    /api/activity/:userId           activity history (newest first; ?kind= &limit= &offset=)
GET    /api/activity/:userId/summary   counts per kind
POST   /api/activity/:userId           record one thing a feature did
DELETE /api/activity/:userId/:id       remove one record
DELETE /api/activity/:userId           clear history (?kind= to clear one kind)
```

The family-helper consent list (`PUT /api/settings/:userId/helpers`) is still
implemented, but every request is the same anonymous local uid, so in practice
it can only ever be self-referential. It is kept because it is the single place
that decides who may write to whose settings, and that decision should not have
to be reinvented if real identity ever comes back.

## Architecture

```
shared/          Imported by BOTH client and server
  scamRules.js       Weighted rules -> green / amber / red, with reasons
  transactionParser.js  UPI SMS -> structured facts
  demoData.js        Samples, lessons, practice messages, defaults

server/src/
  index.js           Express app, security headers, rate limits
  env.js             Loads the one root .env, cwd-independently
  db.js              SQLite: schema, document + activity helpers
  store.js           Database-backed documents: users, settings, progress, activity
  schema.js          Field allow-list + sanitisation + activity meta allow-list
  auth.js            Stamps every request as the anonymous local user
  routes/            explain-transaction, check-safety, settings, progress, activity
  data/              voicepay.db lives here (gitignored, created on first run)

client/src/
  context/           Settings, Auth, Speech, Progress, Activity
  lib/               api, speech, ocr, storage, localAuth, activity, utils.ts
  i18n/              en, hi, ta, te, bn (index.js, voices.js)
  components/        BigButton, LanguageSelector, Layout, SafetyBanner,
                     SpeakerButton, icons, ui.jsx
    ui/              The shadcn target folder - currently a vendored hero
  pages/             Home, SendMoney, TransactionExplainer, SafetyChecker,
                     Learn, LessonPlayer, ScamSimulator, FamilyHelper,
                     History, Settings, NotFound

client/public/     PWA icons and favicon
client/dist/       Build output (gitignored)

components.json    shadcn/ui CLI config (aliases, tailwind + css paths)
client/tsconfig.json  TypeScript for the .ts/.tsx files only (checkJs: false)
.eslintrc.cjs      ESLint config, with a separate override for TypeScript

scripts/           The verification suites `npm run verify` runs
  verify-rules.mjs    Every shipped message -> its expected verdict
  verify-parser.mjs   The SMS parser against the shipped samples
  verify-i18n.mjs     Every runtime key resolves, in all five languages
  verify-voice.mjs    BCP-47 tags, and voices that arrive late
  smoke-api.mjs       The real Express app, endpoint by endpoint
  verify-family.mjs   The Family Helper screen, driven in a real DOM
  family-harness/     The jsdom entry point that mounts the real <App />
```

### Components and styling

Tailwind CSS is the styling system, and the app's own presentational components
live in `client/src/components/ui.jsx` — `Card`, `PageHeader`, `StepDots`,
`Toggle`, `VerdictBadge`, `PayeeChip`, `SpeakableInput` and the rest. They are
plain JSX and predate shadcn.

`client/src/components/ui/` is a **directory**, and it is the folder the
shadcn CLI writes into: `components.json` points its `ui` and `utils` aliases
at `@/components/ui` and `@/lib/utils`. It currently holds **no shadcn
primitives** — only vendored components:

- `glass-headline-hero.tsx` — the glass headline that opens the Home screen.
  It is kept byte-identical to the file it was copied from, so the lint and
  type-check rules that would demand edits to it are relaxed instead (see the
  overrides in `.eslintrc.cjs` and the comment in `client/tsconfig.json`).
- `glass-headline-hero.demo.tsx` — that component's own demo, mounted at
  `/demo/glass-hero`. It is deliberately not in the navigation.
- `frorest-green.jsx` — a WebGL shader background ("Waves" from the 21st.dev
  Shader Builder), ported to plain JSX. The glass hero replaced it on the Home
  screen, so it is kept unused: it is a working, documented background that is
  useful anywhere a decorative moving field is wanted, and it opts out of
  `prefers-reduced-motion` in JS, since CSS cannot reach a WebGL canvas.

Two things about this setup are deliberate and easy to trip over:

- **The app is JavaScript; only three files are TypeScript.**
  `client/tsconfig.json` sets `allowJs: true` with `checkJs: false`, so a
  `.tsx` file can import a `.jsx` one but the JavaScript files are never
  type-checked. The TypeScript is `client/src/lib/utils.ts` (the `cn` helper),
  `client/src/components/ui/glass-headline-hero.tsx` and its `.demo.tsx`.
  Turning on `checkJs` would be a migration, not a config change.
- **`components/ui.jsx` and `components/ui/` both exist.** The file is the app's
  own grab-bag of presentational components; the folder is the shadcn
  primitives folder. They do not collide because every import names the file
  explicitly (`'../components/ui.jsx'`). If you add a shadcn component, import
  it as `@/components/ui/<name>` — never `@/components/ui`, which resolves to
  the file.

The theme colours reach the CLI through CSS variables in `index.css` mapped
onto the palette in `tailwind.config.js`, so a primitive dropped in later uses
VoicePay's blues rather than shadcn's defaults.

### Language status

`npm run verify` derives every key the running app can emit and checks it in
every bundle, so this table cannot quietly go stale:

| Language | Coverage | Notes |
| --- | --- | --- |
| English (`en`) | 100% (389/389) | Base language; every key must exist here |
| Hindi (`hi`) | 100% (389/389) | Fully translated |
| Tamil (`ta`) | 100% (389/389) | Fully translated |
| Telugu (`te`) | 100% (389/389) | Fully translated |
| Bengali (`bn`) | 100% (389/389) | Fully translated |

Every key still falls back to English individually, so a key added to `en.json`
and forgotten anywhere else shows English words rather than a raw key, and
`verify:i18n` fails the build if `en.json` itself is ever short. The safety
wording in the non-English bundles has not had a native-speaker review yet —
treat a suspected mistranslation of "never share your OTP" as a bug.

**Results answer in the language of the message, not the app.** Pasting a
Tamil bank SMS while the app is set to Hindi gives a Tamil verdict: Safety
Checker and Transaction Explainer detect the script of the checked text
(`detectTextLang`) and render and speak the verdict, the reasons and the
summary through a translator bound to that language. Only the surrounding
controls — page header, input card, speaker-button labels, offline note —
stay in the app's language.

### Local-first, network-second

Every write follows the same order: `localStorage` immediately, then the server
in the background. If the network fails the change is queued and retried, and
the person in front of the screen has still been served correctly.

### Family Helper: what it does, and what it does not

A relative sits down with the person who uses VoicePay and sets the phone up
for them — language, text size, colours, voice, and the people they pay often.
The changes are written to the phone in front of them.

The screen offers the same two kinds of control as the person's own Settings
screen: **choices** (which language, which text size, how fast the voice
speaks) and **switches** (read every screen out loud, extra strong colours).
The switch is one shared component (`Toggle` in `client/src/components/ui.jsx`)
used by both screens, so a relative moving between "set it up" and "check it"
cannot find two different-looking switches for the same setting. Under the
switch is a real `<input type="checkbox">`, so a screen reader announces it
and a keyboard can operate it — a styled `<div>` with an `onClick` would be
invisible to both.

There is **no cross-device sync**. Nothing reaches the other person's phone,
because there is no link between the two phones for anything to travel along.
The workflow is deliberately "sit down and set it up", because that is the
intervention that actually happens in a household, and because faking a cloud
sync would mean inventing an account system this app refuses to have.

Two things are kept deliberately separate, and the screen says so in plain
words:

- **The helper's account** — who is making the change. Optional. It labels the
  audit trail ("changed by Sita") and stops two people sharing a phone from
  overwriting each other. It is not a login and it protects nothing.
- **Whose phone it is** — a label the helper types in, so they remember who
  they set up. It is *never* used as an id, so it can never be mistaken for a
  login or accidentally sent to the API as one.

That split is why the target keeps the fixed local uid `demo-user`
(`LOCAL_TARGET_UID` in `client/src/context/AuthContext.jsx`) no matter what
email is typed. Every API request is stamped with that same uid by
`server/src/auth.js`, so writing to any other id is refused with a 403 — the
email is a label, and the code says so at the point where it would otherwise
be tempting to use it as a key.

**The account is genuinely optional.** A helper can press "I do not have an
account" and set the phone up anyway; the screen then stops asking. Signing in
later is still possible, and a helper who signs *out* gets the form back, so
they can sign in again. The one thing that requires the account is the audit
trail: without it, a payee is recorded as added by "self", because nothing
else knows who touched the phone.

The audit trail is why `SettingsContext` mirrors the signed-in helper
(`authUser`): without that mirror `addedBy` was always "self", and the
"changed by Sita" promise above was decorative.

### Family Helper authorisation

There is no identity to authorise. Every API request is stamped with the same
anonymous local uid by `server/src/auth.js`, so a helper can only ever edit the
document in front of them — on their own phone. The consent-list endpoint
(`users/{ownerId}.helpers`) is still implemented in
`server/src/routes/settings.js`, but with a single shared uid it can only be
self-referential. It is kept as the one reviewable place that answers "who may
write to whose settings", so that a future version with real identity has
something correct to build on.

### Privacy

VoicePay stores only: language, text size, voice speed, contrast preference,
theme, the names of people you pay, your lesson and practice progress, and an
activity history of what the features decided. It never stores OTPs, PINs,
passwords, card numbers, or screenshots. **Message text is analysed and
discarded**; it is not written to any store. There is no field for any of those
things in `server/src/schema.js`, and the activity log has no column for pasted
text, so the API has no code path that could write one.

Where it is stored:

- **In the user's own browser `localStorage`.** Always written first, never
  leaves the device.
- **In the API's SQLite database** (`server/data/voicepay.db`), so the same
  record can be seen from another device and survives a restart. Sent to no
  third party. There is no cloud project, no database server, and no
  third-party SDK in the browser bundle.

Anything stored can be deleted: **Settings → My data → Delete my data** clears
both copies, and the History screen can remove one record or one kind at a time.

The Family Helper profile is an email, a display name, and a salted SHA-256
digest of a password — kept on the same device, and it is not an account.

## Accessibility

- Every interactive target is at least **64×64px**.
- Text scales via a CSS variable, so the "Very large" setting grows the whole
  interface without a separate stylesheet.
- Text-to-speech on every screen, plus a per-row speaker on the Explainer and
  lesson cards.
- `prefers-reduced-motion` is respected throughout — including in the WebGL
  background, which opts out in JS because CSS cannot reach a canvas.
- Verdicts are always written in words, never conveyed by colour alone.
- Focus moves to results automatically so screen-reader users are not left
  guessing what happened.
- The language picker is a native `<select>`, so the phone's own picker is
  spoken aloud in the user's language.

## License

MIT
