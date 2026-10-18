# The Line: notes for Claude Code

The Line is a web voice recorder: anyone 18+ leaves a voice note of up to 60 seconds for a stranger, in English or French. Kenneth reviews every note before it is shared.

- **The spec is the source of truth:** `The_Line_Build_Spec.md`. Its section 17 (decisions log) overrides earlier sections and the design files.
- **Designs:** `design/*.dc.html`, one per screen. They are reference markup, not code to copy. Rebuild them with the app's own components, matching layout, type, colour and copy. Don't use their Google Fonts links.
- **Progress:** `PROGRESS.md` says what's done, what's next, and the decisions made. Keep it updated as you work.
- The owner, Kenneth, is not a developer. Explain changes in plain language.

## Rules for Claude Code (from the spec)

1. Build in the milestone order in section 16. Each milestone ends with its acceptance tests passing.
2. Section 2 lists invariants. Never weaken one to make something easier. If one blocks you, stop and ask.
3. Copy text comes from the spec and the design files. Don't invent sender-facing copy; mark gaps as `TODO(copy)`. French for new screens: draft it with *tu* and mark each string `TODO(copy-fr)` (decisions log).
4. Don't add analytics, trackers, third-party scripts, or any service not named in the spec without asking.

## Invariants (spec section 2; each one needs a test)

1. **No consent, no storage.** Nothing is uploaded until the sender ticks consent 1 and presses share. "Let it go" makes zero network requests carrying audio.
2. **No review, no publication.** A note can only become public if all three consents are true, a human reviewer approved it, and it is not flagged as confirmed risk or as a suspected minor.
3. **Classifier failure is a flag.** Any classifier error, timeout or invalid output sets `risk = high`. A note never passes silently.
4. **Raw is private.** Raw audio and raw transcripts are never served by any public route, never sent to the TTS engine, and are encrypted at rest.
5. **The deletion link always works,** before and after publication, and is the only way to identify a note's sender. Store only a hash of the token.
6. **No location, no identity.** No name, email, phone, account, or location is collected from senders. IP addresses are used only for rate limiting and never stored with a note.
7. **Expiry is real.** A note with no decision 30 days after submission is deleted, and so are its audio and transcripts.
8. **Wording.** The UI never says "anonymous" and never promises that every note is shared. Approved phrasing: "shared without your name" and "A person reviews every note before it's shared." / « Une personne vérifie chaque note avant qu'elle soit partagée. »
9. **Help is always visible.** Every sender and public page shows the helpline block (section 9.3).
10. **Real notes reach Mistral only under a signed DPA with training turned off** (section 8). If that isn't in place, the classifier runs in `CLASSIFIER_MODE=keywords` and sends nothing out.

## Where things are

```
CLAUDE.md, PROGRESS.md, The_Line_Build_Spec.md, design/
docker-compose.yml        web + Postgres (Postgres is unused until M1)
web/                      the Next.js app (App Router, TypeScript)
  app/                    routes: / (redirect), /leave, /privacy
  components/             Line, HelplineBlock, LanguageToggle, Gate, SourceTagCapture
  styles/tokens.css       colours, fonts, the line height (--line-y)
  styles/fonts.css        self-hosted fonts (files and OFL licences in public/fonts/)
  messages/en.json, fr.json
  i18n/                   language detection, the EN/FR cookie
  lib/                    small shared helpers
  tests/unit/             Vitest
  tests/e2e/              Playwright (phone 390×844 and desktop 1440×900)
```

## Conventions

- **Copy lives in `web/messages/en.json` and `fr.json`.** Both files have the same keys (a unit test checks this). A note about a string goes in a sibling key ending in `__TODO`, e.g. `"desktopHint__TODO": "TODO(copy-fr) draft, Kenneth to check"`. These keys are never shown. Search for `TODO(copy` to find unchecked text.
- **The line** is one component, `web/components/Line/Line.tsx`, with a `variant` per screen. Its centre sits at `--line-y` (500 px phone, 540 px desktop). Put the `above-the-line` class on the block right before it.
- **Phone vs desktop:** the desktop layout starts at 1024 px wide.
- **Touch targets** are at least 44 px. Use real `<button>`, `<a>` and `<label>` elements. Respect `prefers-reduced-motion`.
- **No third-party requests** from any page, fonts included. A test checks every public route; add new public routes to `PUBLIC_ROUTES` in `web/tests/e2e/helpers.ts`.
- **Next.js telemetry is off** (the npm scripts set `NEXT_TELEMETRY_DISABLED=1`). Keep it that way.
- This Next.js version is newer than most training data: read `web/node_modules/next/dist/docs/` before using an API you're unsure of (see `web/AGENTS.md`).

## How to run the app

Needs Node.js 22 or newer. All commands run from `web/`.

```bash
cd web
npm install
npm run dev            # development server: http://localhost:3000/leave
```

Production build: `npm run build && npm start`.

With Docker (from the repo root): `docker compose up --build`, then open http://localhost:3000/leave. Stop with `docker compose down`.

## How to run the tests

```bash
cd web
npm run test:unit      # Vitest, a second or two
npm run test:e2e       # Playwright: builds the app, starts it on port 3100, tests phone and desktop
npm test               # both
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm run format:check   # Prettier (npm run format to fix)
```

First time on a new machine: `npx playwright install chromium`.

### In a Claude Code cloud session

- Chromium is already installed, so don't run `playwright install`. Point Playwright at it:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e`
- Docker isn't running at the start. Start it with `dockerd &`. Docker Hub may refuse with "429 Too Many Requests"; pull `mirror.gcr.io/library/<image>` and tag it with the plain name. `npm ci` inside a build can't reach the network without the session's proxy and CA; see `/root/.ccr/README.md`. The committed `Dockerfile` must stay free of these session-only settings.
