# Progress

Milestones are in `The_Line_Build_Spec.md` section 16. How to run things is in `CLAUDE.md`.

## Where we are

**M1 is done** (23 October 2026). The sender flow 01–05, the upload, the deletion page and their tests are built. Browser tests 1–3 from spec 15 pass, and staging on Clever Cloud is reachable. On 23 October Kenneth left a test note from an iPhone X (Safari) on staging, then opened its private link and deleted it: every step worked.

Next: M2 (the worker and the queue), once Kenneth has reviewed the M1 pull request and its draft copy.

**M0 is done** (18 October 2026).

## Done

### M1: sender flow, upload, deletion page, staging

- **Screens 02–05** on phone and desktop, matching `Mode`/`DMode`, `Record`/`DRecord`, `Share`/`DShare` and `Ticket`/`DTicket`, plus the "Let it go" ending and the "microphone blocked" screen. They all happen on `/leave`, one after the other: the recording stays in the browser tab and is never put in a web address.
- **The line's new shapes:** fork (02), live waveform (03), knot (04), ticket (05). Each stays at 500 px (phone) / 540 px (desktop) from the top, in English and French.
- **Recording (03):** the centre button starts (filled cream circle) and stops (the square). The microphone is asked for only when recording starts. The line is drawn from the voice's loudness as it goes, and stops by itself at 60 s. Start over discards the recording. Done is enabled once a recording of at least 5 s exists. The space bar starts and stops. If the microphone can't be reached (refused, or an Instagram/TikTok in-app browser), the "We can't reach your microphone" screen appears, with Copy the link.
- **What now (04):** Listen back. **Let it go** throws the recording away and sends nothing (tested: zero requests carrying audio). **Share it** opens the three consents (none pre-ticked), the voice and timing choices, and loads the Cloudflare bot check, only at that moment. "Put it on the line" stays locked until everything is set.
- **Private link (05):** the deletion link (24 random characters), Copy link, Save as a file (desktop), a summary of the choices, the helplines and "Leave another note".
- **Deletion page `/d/<token>`:** shows "waiting" or "already deleted", and a Delete button with a confirmation. Deleting removes the recording, keeps an empty record (no content) and writes the deletion log. The page is never cached, indexed or passed on to other websites.
- **Upload (`POST /api/notes`):** checks, in order:
  - size under 3 MB;
  - the Cloudflare bot check;
  - all three consents, plus the consent wording's version;
  - the voice and timing choices;
  - the file really being WebM or MP4 audio (read from the file itself, not the browser's label);
  - its length of 5–62 s, also read from the file itself;
  - 3 notes a day per connection.

  Only then is anything stored. The connection's address is never stored: only a scrambled value that changes daily and is deleted after 24 h.
- **Encryption:** each recording is locked with its own key, which is itself locked with the master key (AES-256-GCM). Files are stored in Cellar on staging, or in a folder when run locally.
- **Database:** Postgres, set up automatically when the app starts (`web/db/migrations/`). The `notes` table has every column from spec 5; the later ones stay empty until their milestone.
- **Staging protection:** with `APP_ENV=staging`, every page asks for a password, sends `noindex`, and shows a thin "STAGING · test data only" bar. Without a password set, staging stays closed.
- **Tests:** 45 unit tests and 143 browser tests (phone and desktop, EN and FR). They cover:
  - the full flow, start to finish, in both languages, up to the encrypted file on disk and its deletion (E2E 1);
  - Let it go sending nothing (E2E 2);
  - the auto-stop at 60 s (E2E 3);
  - every upload rule;
  - the rate limit;
  - Turnstile loading only after "Share it";
  - the helplines, the "anonymous" ban and the accessibility checks on every screen;
  - the staging password.
- **CI** now has a Postgres database and also checks the formatting.
- **The Docker image** was built and run here as Clever Cloud will run it (port 8080, staging mode, password, fresh database): it answered, asked for the password, showed the staging bar and created its tables.

### M0: foundations

- **App:** Next.js 16 (App Router, TypeScript, React 19) in `web/`, server-rendered.
- **Docker Compose:** `web` (the app) and `db` (Postgres 18, unused until M1). Built and run in the session: the app answered on port 3000 and the database accepted connections.
- **Fonts:** Archivo (variable, width axis 62–125), Source Serif 4 and Caveat Brush, served from the app itself with their OFL licences in `web/public/fonts/`. Nothing is loaded from Google.
- **Design tokens:** colours, the three type styles and the line height in `web/styles/tokens.css`.
- **The line component:** `web/components/Line/`, one shared component with variants. The dial variant (screen 01) is built.
- **Languages:** English and French message files; the language follows the browser, and the EN/FR toggle overrides it and is remembered in a cookie. The toggle works even before JavaScript loads.
- **Helpline block:** one shared component, in both languages.
- **Screen 01 (gate)** on phone and desktop, matching `Main` and `DGate`. "Pick up the line" unlocks when "I'm 18 or older" is ticked and does nothing yet.
- **Routes:** `/` redirects to `/leave` and keeps the query string. `?from=` tags are checked and kept in the browser session. `/privacy` is a placeholder.
- **CI:** `.github/workflows/ci.yml` runs lint, type check, unit tests and browser tests on every pull request, so it shows a pass/fail tick on GitHub.
- **Tests:** 25 unit tests (Vitest) and 59 browser tests (Playwright, phone and desktop). They cover:
  - the gate button;
  - every approved EN and FR string (read straight from the spec's decisions log);
  - the line's position;
  - the locked and unlocked button looks;
  - desktop font sizes and positions, measured against `DGate`;
  - 44 px touch targets;
  - the language toggle and cookie;
  - the redirect and source tags;
  - the helpline block on every public page (invariant 9);
  - no "anonymous" anywhere (invariant 8);
  - no request to any other website;
  - automated accessibility checks.

## Next

### M1 staging: how it went (done)

- **Done:**
  - Clever Cloud app `the-line-staging` with its Postgres and Cellar add-ons, all in Paris.
  - The Turnstile widget for the staging address.
  - The secret settings, entered by Kenneth in Clever Cloud.
  - The app deploys from the pull request's branch. **Staging is reachable** (password, noindex and staging bar all working).
- **First phone test** (iPhone X, Safari), with the real Cloudflare check passing:
  - **Saving the note failed:** Cellar said `411 MissingContentLength`. Inside the running app, uploads were sent as a stream without their size. Fixed: the request is signed first, then sent with its size. The browser tests now save through the same storage code as staging, to a strict local stand-in for Cellar that refuses uploads without a size (with the old code, they fail the same way staging did).
  - **Failed saves used up the 3-a-day allowance**, so Kenneth was told he'd left 3 notes. Fixed: a note that can't be saved no longer counts. Today's counts are cleared on the next deploy (migration 002).
  - **Listening back** was unreliable at first in Safari. The recording is now made in one piece rather than one-second chunks, and playback retries once.
- **Second phone test, after the fixes:** listening back worked first time, the note was saved, the private link opened as "waiting", and deleting it worked.

### M2: the worker (normalise, transcribe, classify) and the queue

The classifier is provider-agnostic, and keywords mode is on until a provider is confirmed (decisions log, 23 October). The worker's hosting cost on Clever Cloud is decided in M2.

### Open items to check (not blocking)

- `TODO(legal)` / `TODO(legal-fr)`: the privacy notice, which must also mention Cloudflare Turnstile (decisions log). The French consent texts are drafts (`TODO(legal-fr)`).
- `TODO(copy)` / `TODO(copy-fr)`: drafts for Kenneth to check in the pull request:
  - the deletion page;
  - the other screen 05 combinations (narrator; "once it's reviewed");
  - the error messages on 04;
  - "too short" on 03;
  - the "Copied" confirmations;
  - the saved link file;
  - all French for 02–05.

  Search the message files for `TODO(copy` to list them.

## Launch checklist (additions)

These join the spec's launch checklist (section 18).

- [ ] **npm audit: recheck before launch.** It reports 5 "high" advisories, all in ESLint's file-matching libraries (`braces`, via `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`). They're development tools that never reach visitors. The only "fix" npm offers downgrades to Next.js 14 tooling, so it's left as is for now.

## Decisions

The full list is in the spec, section 17 (decisions log). In short:

**Classifier (23 October, before M1):** provider-agnostic, built in M2. One interface, two adapters: Mistral's EU API (`api.eu.mistral.ai` only, no global fallback) or a self-hosted open-weights model, plus keywords-only mode. Mistral sees real notes only when all four conditions in spec section 8 are met. Until a provider is confirmed, `CLASSIFIER_MODE=keywords`.

**Screen 01 French copy:** approved by Kenneth, used exactly. The table is in spec section 17, and a test checks the page against it.

**French for later screens:** drafted with *tu*, each string marked `TODO(copy-fr)` for Kenneth to check.

**Wording:** "No name." on the gate is allowed.

**Approved after M0 review:** "Language" / "Langue" (toggle label) and the French desktop hint. The locked "Pick up the line" is cream with a 2 px ink border and ink text at 50%; unlocked is solid ink with cream text.

**M0 build decisions (approved):**
- "Pick up the line" unlocks when the box is ticked and does nothing yet; it is wired to screen 02 in M1.
- Fonts are self-hosted; the design files' Google Fonts links are not used.
- The line sits at 500 px (phone) and 540 px (desktop) from the top.
- Desktop layout from 1024 px wide. Short phones scroll; the line keeps its height.
- Screen 01's dial tone is static, as drawn.
- The line is one component; each variant is built with its screen.
- "Listen to strangers" is hidden until v1.1.
- `/privacy` is a `TODO(legal)` placeholder.
- "Pick up the line" is a real button on desktop too.
- The line-state label is fixed at "open" until M3.
- Docker Compose is written in M0 and was run in this session.

**Design contradictions (the spec wins):**
- **Consent text 2:** spec version `2026-10-a`.
- **Surge:** only raises an alert; the line state changes only when Kenneth sets it.
- **A03:** headline "CHECK THIS FLAG", sub-line "If it's a real risk, it's deleted. If not, it goes back to the queue."
- **A01:** under Approve in v1, "Goes live on its playback page, and to 'Approved, not placed' on the schedule."
- **Report (09):** a small form with a reason and optional text, no reporter data, rate-limited per IP. One report: top of Flagged, tagged "Reported", still live. Three reports: hidden until Kenneth decides.
- **Private link (05):** fits a 22+ character token, monospace, two lines on phone if needed.
- **A07:** "3 notes a day per connection" (still IP-based).
- **Alyssa** is the mental-health board lead (plain text on A03).

**Smaller decisions made while building M1:**
- **"WHAT NOW?" on phone** is scaled to fit one line. At the design's 84 px it is 379 px wide, which runs past a 390 px screen.
- **French titles** (04, 05) are set smaller than the English ones, so they keep the same number of lines and the line stays at its height. They were measured with the real fonts.
- **The review sentence on 04** is "A person reviews every note before it's shared." with a capital A (the approved wording). The design had it in lower case.
- **The consent panel on 04** appears when "Share it" is chosen. Before that, it isn't shown (on desktop, the right half is empty), and Turnstile hasn't loaded.
- **"or say anything" (03)** is a toggle: the question fades and the note is saved without a weekly question.
- **Done (03)** also needs at least 5 seconds, so a too-short note can't fail at the very end. A short "too short" line explains why. `TODO(copy)`.
- **The space bar note on desktop 03** reads "Space bar to start and stop", since it now also starts (`TODO(copy)`).
- **The browser's Back button** moves back through 01–04. After 05 or "Let it go", it doesn't bring the recording back.
- **The deletion token** is 24 characters (the spec asks for 22 or more).
- **Security headers** on every page, including the microphone allowed only for our own site. On `/d/…`: no referrer, no caching, no indexing.
- **The weekly question** has a row in a new `prompts` table, so notes can point to it. Its text still comes from the message files until M3.
- **The staging bar** uses the alert red, so it can't be mistaken for part of the design.
- **The `Dockerfile` is at the top of the repository** (it builds the app from `web/`): Clever Cloud's Docker apps only look for it there, and ignore `APP_FOLDER`.

**Smaller decisions made while building M0:**
- **Next.js "Cache Components" is off.** Every page depends on the visitor's language, so plain server rendering is simpler and matches the spec.
- **Next.js telemetry is off.** By default, Next.js sends anonymous usage statistics about the build tools to Vercel. It isn't visitor data, but rule 4 says no outside services.
- **The language toggle's buttons are 44 px tall for touch, with the 32 px pill drawn inside.** This follows the spec's 44 px rule while keeping the design's look.
- **The language cookie** is `lang`: one year, `SameSite=Lax`, not readable by scripts.
- **Source tags:** the first valid `?from=` tag in a browser session is kept, matching the spec's "from landing to submit".
- **Desktop sizes** were measured against `DGate` with the real fonts loaded: every element matches within a pixel, and the title is exactly 330 px at 1440 px wide. A test now pins these sizes. (An early preview of the design had fallen back to a wider stand-in font, which made ours look smaller than it is.)
- **Phone spacing below the line** is tightened by about 15 px, so the gate fits a 390×844 phone without scrolling. The real Source Serif 4 is slightly wider than the designs' stand-in font.
- **Fonts come from the Fontsource npm packages**, which carry the same OFL font files as Google's font archive. GitHub downloads are blocked in the build session.
