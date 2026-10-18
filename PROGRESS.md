# Progress

Milestones are in `The_Line_Build_Spec.md` section 16. How to run things is in `CLAUDE.md`.

## Where we are

**M0 is done** (18 October 2026): screen 01 runs locally in English and French, and the tests run and pass. Review changes are in (locked button look, exact desktop sizes, CI).

## Done

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

### M1: sender flow and first deploy

- Screens 02–05 (Mode, Record, What now, Private link), with the line's fork, waveform, knot and ticket variants.
- Wire "Pick up the line" to screen 02 (marked `TODO(M1)` in `web/components/Gate/AgeGate.tsx`).
- Upload API, Turnstile, rate limit, encrypted storage, deletion page.
- First deploy to an EU staging server (Caddy for TLS).
- Acceptance: E2E 1–3 pass; staging is reachable.

### Open items to check (not blocking)

- `TODO(legal)` / `TODO(legal-fr)`: the privacy notice.

## Launch checklist (additions)

These join the spec's launch checklist (section 18).

- [ ] **npm audit: recheck before launch.** It reports 5 "high" advisories, all in ESLint's file-matching libraries (`braces`, via `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`). They're development tools that never reach visitors. The only "fix" npm offers downgrades to Next.js 14 tooling, so it's left as is for now.

## Decisions

The full list is in the spec, section 17 (decisions log). In short:

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

**Smaller decisions made while building M0:**
- **Next.js "Cache Components" is off.** Every page depends on the visitor's language, so plain server rendering is simpler and matches the spec.
- **Next.js telemetry is off.** By default, Next.js sends anonymous usage statistics about the build tools to Vercel. It isn't visitor data, but rule 4 says no outside services.
- **The language toggle's buttons are 44 px tall for touch, with the 32 px pill drawn inside.** This follows the spec's 44 px rule while keeping the design's look.
- **The language cookie** is `lang`: one year, `SameSite=Lax`, not readable by scripts.
- **Source tags:** the first valid `?from=` tag in a browser session is kept, matching the spec's "from landing to submit".
- **Desktop sizes** were measured against `DGate` with the real fonts loaded: every element matches within a pixel, and the title is exactly 330 px at 1440 px wide. A test now pins these sizes. (An early preview of the design had fallen back to a wider stand-in font, which made ours look smaller than it is.)
- **Phone spacing below the line** is tightened by about 15 px, so the gate fits a 390×844 phone without scrolling. The real Source Serif 4 is slightly wider than the designs' stand-in font.
- **Fonts come from the Fontsource npm packages**, which carry the same OFL font files as Google's font archive. GitHub downloads are blocked in the build session.
