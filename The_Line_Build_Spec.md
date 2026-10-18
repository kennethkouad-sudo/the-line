# The Line: build spec for Claude Code

Version 1 · 18 October 2026 · Owner: Kenneth (Strnger)

This is the build spec for The Line. Where it differs from `claude/The_Line_Brief.md`, this spec wins. The screens are in `design/` (one `.dc.html` file per screen, exported from the design canvas). They are reference markup, not code to copy: rebuild them in the app's own components, matching layout, type, colour and copy.

**Rules for Claude Code**

1. Build in the milestone order in section 16. Each milestone ends with its acceptance tests passing.
2. Section 2 lists invariants. Never weaken one to make something easier. If one blocks you, stop and ask.
3. Copy text comes from this spec and the design files. Don't invent sender-facing copy; mark gaps as `TODO(copy)`.
4. Don't add analytics, trackers, third-party scripts, or any service not named here without asking.

---

## 1. What we're building

A web voice recorder where anyone 18+ leaves a voice note of up to 60 seconds for a stranger, in English or French. Kenneth reviews every note before it is shared. Approved notes are shared without the sender's name on a playback page, on Instagram and in the "Dear Stranger" newsletter, and later in a public listening library.

| Release | Scope |
|---|---|
| **v1** | Sender flow (gate, mode, record, share, private link), single-note playback page, deletion page, processing pipeline, the whole switchboard (admin), content kits (newsletter, carousel, reel), traffic and surge tools |
| **v1.1** (3–4 weeks after launch, once ~30 notes are approved) | Public library: home, theme pages, Encouragement tab, play-all, play-me-one |
| **Later, not now** | Instagram API, beehiiv API, phone line, more languages |

Until v1.1, `line.histrnger.com/` redirects to `/leave`, keeping the query string (so `/?from=intro` still counts).

## 2. Invariants (each one needs a test)

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

## 3. Stack and architecture

| Part | Choice | Why |
|---|---|---|
| Web app | Next.js (App Router, TypeScript), server-rendered | One codebase for sender pages, playback pages and the switchboard |
| Database | PostgreSQL | Relational data, plus the job queue |
| Jobs | Postgres-backed queue (e.g. pg-boss) | No extra infrastructure |
| Audio worker | Python service: ffmpeg, faster-whisper, Piper | Transcription and TTS self-hosted, so voices never leave the server |
| Image rendering | satori + resvg (Node) | Newsletter image and carousel slides as PNG, from the same fonts |
| Video rendering | ffmpeg in the audio worker | Reel MP4 |
| File storage | S3-compatible object storage in the EU | Audio and rendered assets |
| Hosting | One EU VPS (e.g. Hetzner, Germany or Finland), Docker Compose, Caddy for TLS | Cheap, EU-only, CPU is enough |
| Bot check | Cloudflare Turnstile | |
| LLM | Mistral API (section 8) | EU company |
| Email | One transactional sender, alerts to Kenneth only (counts, never content) | |

Use current stable versions. Self-host all fonts (Archivo variable with width axis, Source Serif 4, Caveat Brush; all OFL). **Don't load Google Fonts from Google's CDN**, because that sends visitors' IPs to Google.

```
browser ──upload──▶ Next.js API ──▶ object storage (raw, encrypted)
                         │
                         └─▶ jobs table ──▶ Python worker
                                              ├─ normalise (ffmpeg)
                                              ├─ transcribe (faster-whisper, word timestamps)
                                              └─ classify (Mistral) ──▶ review queue
Kenneth (switchboard) ──decide──▶ render jobs ──▶ public assets ──▶ /n/<id>, kits, library
```

## 4. Routes

| Path | Who | What |
|---|---|---|
| `/leave` | public | The recorder flow (screens 01–05). Keeps `?from=` |
| `/n/<publicId>` | public | One note's playback page (09) |
| `/d/<token>` | sender | Deletion page: the note's status and a delete button |
| `/privacy` | public | Privacy notice, EN and FR |
| `/` | public | v1: redirect to `/leave`. v1.1: library home |
| `/t/<theme>`, `/encouragement` | public | v1.1 library |
| `/switchboard/*` | admin | Admin, behind auth |

`publicId` is a random 10-character base62 id, never sequential. Deletion tokens are 22 or more random base62 characters (~128 bits). The design shows `histrnger.com/line/…` as the private link; use `line.histrnger.com/d/<token>` instead.

**Source tags:** any public URL may carry `?from=<tag>` (lowercase, `[a-z0-9-]{1,32}`, anything else dropped). Keep it in sessionStorage from landing to submit, and store it on the note as `source_tag`. It's a link tag, not personal data.

## 5. Data model

**notes**

| Field | Type | Notes |
|---|---|---|
| id | uuid | internal |
| public_id | text | for `/n/` |
| delete_token_hash | text | SHA-256 of the token, salted with a server secret |
| status | enum | see section 6 |
| mode | enum `confide`, `encourage` | |
| prompt_id | fk, nullable | null = free note |
| language | enum `en`, `fr`, `other` | detected |
| duration_ms | int | |
| source_tag | text, nullable | |
| consent_store, consent_publish, consent_edit | bool | all three are required to submit |
| consent_text_version | text | which wording they saw |
| voice_choice | enum `own`, `narrator` | |
| wait_choice | enum `asap`, `three_days` | |
| moderator_hold_until | timestamptz, nullable | |
| publish_not_before | timestamptz | `max(submitted + 72h if three_days, hold_until, approved_at)` |
| submitted_at, expires_at | timestamptz | expires = submitted + 30 days, cleared on decision |
| raw_audio_key, raw_transcript_enc | text | encrypted; deleted per section 12 |
| classifier_output | jsonb | section 8 |
| risk | enum `low`, `medium`, `high` | |
| minor_suspected | bool | |
| redacted_transcript | text | master text for everything public |
| redaction_spans | jsonb | `[{start_ms, end_ms, text}]` from word timestamps |
| translation | text, nullable | from the redacted transcript, checked by Kenneth |
| themes | text[] | 1–2 from the fixed list (section 9.4) |
| library_ok | bool | the moderator's decision, separate from consent |
| needs_content_note | bool | |
| published_audio_key | text, nullable | edited own voice or narrator |
| narrator_voice_id | text, nullable | |
| decided_at, decided_by, decision | | `approved`, `not_published`, `risk_confirmed`, `minor` |
| plays | int | library and playback plays; a plain counter |

**Other tables**
- **prompts:** id, week_start, text_en, text_fr, state
- **placements:** id, note_id, channel (`instagram`, `newsletter`, `story`), format (`reel`, `carousel_slide`, `story`, `newsletter_block`), carousel_id, scheduled_for (date), post_url, status (`planned`, `posted`, `takedown_needed`, `taken_down`)
- **carousels:** id, theme, scheduled_for, caption, slide_order (note ids), bio_tag, post_url, status
- **newsletter_issues:** id, send_date, note_id, web_url, status (`draft`, `sent`)
- **markers:** id, label, platform, posted_at, post_url, tag. Posts that aren't notes, such as the intro video
- **deletion_log:** id, at, actor (`sender`, `expiry`, `moderator`), had_placements (text[]), action. **No content**
- **risk_counts:** month, confirmed, false_alarm, minor. Counts only, for the board
- **settings:** line_state (`open`, `busy`, `paused`), pause messages EN and FR, minutes_per_day (60), minutes_per_note_listen (3.5), minutes_per_note_read (1), surge thresholds, retention days
- **admins:** id, role (`owner`, `reviewer`), auth fields. A reviewer can review but can't change settings
- **audit_log:** who decided what and when, by note id. No content

The rate-limit store is separate and short-lived: HMAC(IP, daily-rotating secret), 24-hour TTL.

## 6. Note lifecycle

```
received ─▶ processing ─▶ in_queue ──approve──▶ approved ──(publish_not_before)──▶ live
                │              │                    │
                │              ├─don't publish──▶ deleted
                │              ├─confirm risk───▶ deleted (+1 risk_count)
                │              ├─minor──────────▶ deleted (+1 minor count)
                │              └─30 days, no decision─▶ deleted (expiry)
                └─worker error ─▶ in_queue with risk=high
any state ──sender uses /d/<token>──▶ deleted (+ takedown tasks for posted placements)
```

- **live** means the playback page works, and in v1.1 the note is in the library if `library_ok`. Social and newsletter placement is separate (section 11).
- **Every transition to deleted:** remove raw and published audio, transcripts and the translation, keep the row as a tombstone (id, status, timestamps), write `deletion_log`, and for each placement with status `posted`, set `takedown_needed`.

## 7. Pipeline

1. **Upload** (POST `/api/notes`, multipart):
   - Turnstile token checked.
   - Rate limit: 3 notes per day per HMAC'd IP.
   - Duration 5–62 seconds (60 plus a grace margin).
   - Size under 3 MB.
   - MIME `audio/webm` (Opus) or `audio/mp4` (AAC).
   - All three consents true, plus voice and timing choices present.
   - Returns the deletion token once; it is never retrievable again.
2. **Normalise:** ffmpeg to mono 48 kHz. Keep an encrypted Opus copy as raw.
3. **Transcribe:** faster-whisper with `word_timestamps=True` and the language restricted to en or fr. Low confidence on both means `language = other`; such notes get flagged and can't be published.
4. **Classify** (section 8). Notes flagged for risk or a suspected minor go to the top of the queue.
5. **Review** (switchboard A01). Kenneth accepts or edits the suggested cuts, which become `redaction_spans` plus `redacted_transcript`. He sets themes, destinations and an optional hold, then decides.
6. **Render on approval:**
   - **Own voice:** cut each redaction span (with 30 ms fades), replace it with a soft 440 Hz tone at about −24 dBFS of the same length, run noise reduction (ffmpeg `afftdn`), loudness-normalise to −16 LUFS, and export AAC `.m4a`.
   - **Narrator:** Piper TTS from the redacted transcript in the note's language. Pick a random voice from that language's pool (6–10 voices, permissive licences only). Store `narrator_voice_id`. Same output format.
   - **Translation:** the Mistral draft from the redacted transcript into the other language (EN↔FR). Kenneth checks it before approving. Label it "Translated by Strnger".
7. **Publish at `publish_not_before`** (a job runs every 5 minutes).

## 8. Classifier

**Provider:** Mistral API, a small model, JSON output.

**Two modes, set by `CLASSIFIER_MODE`:**
- `llm`: keyword lists plus Mistral, as described below.
- `keywords`: keyword lists only. Nothing leaves the server, no cuts are suggested, and every note without a keyword hit gets `risk = medium` so nothing looks cleared by a model that didn't run. This mode must work fully on its own.

**Plan rules:**
- `MISTRAL_PLAN=experiment` (free) is for test notes, or for real notes only once Mistral has confirmed in writing that its DPA covers that plan, with "Anonymous improvement data" turned off.
- `MISTRAL_PLAN=scale` (paid) with a signed DPA. Scale-plan data is not used for training.
- The switchboard shows a red warning on A07 while `experiment` is set.

**Input:** the raw transcript, language, mode. **Output, validated against a schema:**

```json
{
  "risk": "low | medium | high",
  "risk_reasons": ["string"],
  "minor_suspected": true,
  "pii_spans": [{"text": "Inès", "type": "name | place | employer | other"}],
  "suggested_themes": ["finding_myself"],
  "advice_detected": false,
  "language": "en | fr | other"
}
```

**Rules:**
- **Keyword lists run first:** EN and FR, maintained in settings, written with the board. Any keyword hit sets risk to at least `high`, whatever the LLM says.
- **The prompt tells the model to over-flag.** It covers self-harm, suicide, harm to others, abuse, and anything that sounds like someone under 18.
- **On failure** (invalid JSON, a timeout over 20 s, an API error): retry once, then set `risk = high` with reason `classifier_failed`.
- **Map `pii_spans` to word timestamps** by text match, to pre-fill the suggested cuts.
- **Test set:** `fixtures/classifier/`, about 40 synthetic notes in EN and FR, labelled. CI runs it against a mock. A manual script runs it against the real API. Target: every risk fixture comes back `high`.

## 9. Sender experience (v1: screens 01–05 and 09, phone and desktop)

### 9.1 Design system

| Token | Value |
|---|---|
| ink | `#2A1E12` |
| brown | `#5A3814` |
| cream | `#F6EFE4` |
| soft cream | `#E8D9C2` |
| panel | `#EFE4D3` |
| alert red | `#A3402A` (admin only) |
| Display | Archivo, width 62, weight 800–900, uppercase |
| Body | Source Serif 4 |
| Handwritten | Caveat Brush, brown, slightly rotated |

**The line is the signature element.** One 2 px ink line crosses every screen edge to edge at the same height: 480–520 px from the top on phone, 520–540 px on desktop. It changes meaning on each screen:
- **01:** a dial tone.
- **02:** it forks into the two modes.
- **03:** it becomes the live waveform.
- **04:** it ties a knot.
- **05:** it threads through the ticket.
- **v1.1 library:** a clothesline.
- **09:** the scrubber.

Build it as one shared component with variants.

**Other rules:**
- Targets at least 44 px. Text contrast at least 4.5:1.
- Respect `prefers-reduced-motion`.
- Real `<button>`, `<a>`, `<label>` elements throughout.

### 9.2 Screens

| Screen | Design files | Behaviour |
|---|---|---|
| 01 Gate | `Main`, `DGate` | Prompt of the week, "This line isn't monitored live", the helpline block, an 18+ checkbox. "Pick up the line" is disabled until the box is ticked. EN/FR toggle |
| 02 Mode | `Mode`, `DMode` | Two choices, *Say what's on your mind* (`confide`) and *Leave a note for a stranger* (`encourage`), with the no-medical-advice line |
| 03 Record | `Record`, `DRecord` | Dark screen. Prompt with an "or say anything" option. **The microphone permission is requested here, not earlier.** Live waveform drawn along the line, where x = elapsed/60 s × width. Auto-stop at 60 s. Start over / Stop / Done. Space bar stops on desktop |
| 04 What now | `Share`, `DShare` | Listen back. **Let it go**: discard and end, with no upload. **Share it**: three consent checkboxes (none pre-ticked), voice choice and timing choice (no defaults), "A person reviews every note before it's shared.", Put it on the line. The button stays disabled until everything is set |
| 05 Private link | `Ticket`, `DTicket` | The deletion link with Copy (and Save as a file on desktop), the choices summary, helplines, links to leave another note or go to the library (v1.1) |
| 09 One note | `Note`, `DNote` | Large quote, play, scrubber line (a toned-out name shows as a soft-cream gap), original or translated text tabs, Tell a stranger something, helplines, Report |
| Deletion | not designed: same style as 05 | Status ("waiting", "shared", "already deleted"), a Delete button with a confirmation. The result is final |

**Recording details:**
- Use `MediaRecorder` with `audio/webm;codecs=opus` when supported, otherwise `audio/mp4`. Process `getUserMedia` audio through an `AnalyserNode` to draw the waveform.
- **In-app browsers:** if the user agent matches Instagram, FBAN/FBAV, TikTok or BytedanceWebview, still try. If `getUserMedia` fails, show an "Open in Safari / Chrome" screen with a copy-link button. Test on real devices before launch.

**Line state** (section 13):
- **paused:** `/leave` shows the pause message and links to the library (v1.1) or the newsletter.
- **busy:** screen 04 adds: "The line is very busy. Your note may take weeks to be heard, and some won't be."

### 9.3 Helpline block (every public page)

"This line isn't monitored live." (gate and record screens) · "Struggling right now? [Find a helpline in your country](https://findahelpline.com)." · "In immediate danger? Call **112** (EU) or your local emergency number." The FR versions use *tu*.

### 9.4 Themes (fixed, 1–2 per note; the slug is the stored value)

| slug | EN | FR |
|---|---|---|
| love | Love | Amour |
| family | Family | Famille |
| belonging | Loneliness & belonging | Solitude & appartenance |
| grief | Loss & grief | Perte & deuil |
| work | Work & purpose | Travail & sens |
| finding_myself | Finding myself | Se trouver |
| in_between | The in-between | L'entre-deux |
| regret | Regret & forgiveness | Regrets & pardon |
| hope | Hope | Espoir |

### 9.5 Language

Use message files (`en.json`, `fr.json`). French uses *tu*. Detect the locale from `Accept-Language`; the toggle overrides it and is remembered in a cookie (strictly necessary). The French consent and privacy texts are `TODO(legal-fr)` placeholders until checked.

**Consent texts (version `2026-10-a`):**
1. Store and process my note. It may say things about my health or my life.
2. Share it without my name on social posts, the newsletter and The Line library, a page on histrnger.com where anyone, anywhere, can listen to notes left by strangers, sorted by theme. It stays there until I delete it with my private link.
3. Let Strnger edit, translate and re-voice it.

**Own-voice warning:** People who know you may recognise it. Once shared, others could record it.

## 10. The switchboard (admin)

**Auth:** password plus TOTP, httpOnly secure session cookies, a 12-hour session, and a login rate limit. Roles are owner and reviewer.

**Shared layout:**
- A 232 px ink sidebar: Overview, Queue, Flagged, Scheduled, Published, Deletions, Traffic, Prompts & settings.
- The **line-state radio** (Open / Open · busy notice / Paused) at the bottom of the sidebar on every screen.
- "Traffic" shows a red SURGE badge when a surge is active.

| Screen | Design file | Must do |
|---|---|---|
| A01 Queue | `Switchboard` | List with flagged notes first, then waiting notes oldest-expiring first; each row has a life bar (days left / 30). Detail: play, waveform with cuts marked, transcript with suggested cuts (accept all, or select text to cut), translation draft (editable), risk, minor, voice and timing. Decision panel: themes (1–2, suggested ones shown), destinations (social, newsletter, library), the library checklist (no self-harm, no medical advice, content note), Hold 3 days, **Approve**, **Don't publish** (deletes now, with a confirmation) |
| A02 Overview | `AOverview` | Waiting, flagged, expiring within 5 days, published this week. Arrived-vs-reviewed chart for 14 days. A wall of life bars. Up next, this week's prompt, and listening time against the weekly target |
| A03 Flagged | `AFlagged` | Why it was flagged (keyword and/or model reason). Transcript first; listening is optional. **Confirm risk · delete now**, or **Not a risk** with a reason (feeds the test set). Monthly counts. A break prompt after 2 heavy notes in a day |
| A04 Scheduled | `AScheduled` | A week grid of channels × days. "Approved, not placed" cards are dragged onto a day. On drop, a popover asks for **Reel**, **Carousel slide** (add to an existing carousel for that theme, or start a new one) or **Story**. Notes still in their 3-day wait are dashed. Link to the newsletter kit |
| A05 Published | `APublished` | "Today: post, then paste the link": a post URL field and Mark posted. A table of notes and their channels, plays and status. Filter: Missing a link |
| A06 Deletions | `ADeletions` | Takedown tasks (open post, mark done) and the deletion log. No content |
| A07 Prompts & settings | `APrompts` | Weekly prompts (EN and FR, warns when FR is missing), classifier status and plan warning, pause messages, rules and thresholds, keyword lists, invite a reviewer |
| A08 Traffic | `ASurge` | Notes per hour for 3 days, with markers. Breakdown by `source_tag`. The funnel (received, blocked by bot check/duplicate/too short, queued, flagged). Capacity: time to clear the queue when listening to everything vs read-first triage, against the 30-day limit. Busy-notice and pause controls. Invite a reviewer |
| A09 Carousel builder | `ACarousel` | Cover slide (generated from the theme), note slides (reorderable, removable, add more approved notes from the same theme), end slide. Caption, bio tag link, Download slides (PNG 1080×1350), Copy caption |
| A10 Newsletter kit | `ANewsletter` | A preview of the "A stranger said this" block at 600 px, then six paste steps, each with copy or download. After sending, paste the web URL and mark the issue sent |
| A11 Mark a post | `AMarkPost` | Label, platform, time, optional post URL. Generates a tag link `line.histrnger.com/?from=<tag>`. Shows on the Traffic chart |

**Reading vs listening:**
- Kenneth can decide any note by reading its transcript. Playback runs at 1×, 1.5× or 2×.
- **Exception: approving an own-voice note requires the audio to have been played to the end once** (enforced server-side through a play-completed event; any speed counts). The published audio is the sender's real voice, and it can carry what a transcript misses: a name Whisper got wrong, another voice in the background, a child.
- Narrator notes can be approved by reading, because their audio is generated from the text he read.
- Don't publish and Confirm risk never require listening.

## 11. Content outputs

Kenneth posts to Instagram and pastes into beehiiv by hand. **There are no API integrations.**

| Output | Spec |
|---|---|
| **Playback page** | `/n/<publicId>`, section 9.2 |
| **Newsletter block image** | PNG 1072×104 (2× of 536×52): a 52 px round brown play button with a cream triangle, a 16 px gap, then 5 px bars on a 10 px pitch, 44 px tall, generated from the note's real loudness envelope; the first third is brown `#5A3814` and the rest `#B9A285`. Must match the Dear Stranger issue #1 card. The kit provides: image, image link `/n/<id>?from=nl-<date>`, quote, meta line (`0:33 · in their own voice, in French · translated by Strnger`, or `· a narrator's voice`), "Listen to the full note" (same link), "Tell a stranger something" (`/leave?from=nl-<date>`) |
| **Carousel** | PNG slides 1080×1350, rendered with satori. Cover: ink background, "3 STRANGERS ON <THEME>". Note slide: soft cream, the theme handwritten, the quote (translated if needed, labelled), meta. End slide: "WHAT'S YOURS? Leave a note for a stranger. Link in bio." Bio tag `car-<mmdd>` |
| **Reel** | MP4 1080×1920, 30 fps: ink background, the published audio, the line as an animated waveform at mid-height, burned-in captions from the redacted transcript's word timestamps (Source Serif 4, cream), a Strnger mark. Rendered by ffmpeg. *If it slips, ship v1 with the audio and an `.srt` file and add the MP4 in v1.1* |
| **Story** | PNG 1080×1920 with the quote, and a link to the note to use in a link sticker |

**Takedowns:**
- When a note is deleted, every posted placement becomes a takedown task. A carousel's task is "remove slide N, or delete the post".
- A newsletter issue's task is "remove from the beehiiv web version". Emails already sent can't be recalled.

## 12. Retention jobs (run hourly)

| Data | Deleted |
|---|---|
| Undecided note | 30 days after submission |
| Raw audio and raw transcript | 30 days after the decision (configurable; the DPIA says at most 30) |
| Published audio, redacted transcript, translation | when the sender deletes |
| Rate-limit entries | after 24 h |
| Reverse-proxy logs | IPs truncated or logs rotated within 7 days |
| Deletion log, audit log, risk counts | kept; they contain no content |

## 13. Line state and surge

**Line state:**
- `open`: normal.
- `busy`: open, with the busy notice on screen 04.
- `paused`: the recorder is closed; public pages stay up.

Kenneth sets it manually. **It never changes by itself.**

**Surge alert** (computed hourly), when:
- notes in the last 24 h exceed 3× the 14-day daily average, **and**
- notes in the last 24 h number at least 30.

On a surge: the Traffic badge, plus an email to Kenneth with counts only.

**Suggest busy notice** when `queue × minutes_per_note ÷ minutes_per_day > 30` (days). It is a suggestion in the UI only.

## 14. Security and privacy

- Encrypt raw audio and transcripts with envelope encryption (a per-file data key wrapped by a master key from the environment). The bucket is private, and public assets go in a separate public bucket.
- CSP with no third-party origins except Turnstile and the Mistral API (server-side only). HSTS.
- Only strictly necessary cookies (language, admin session), so no cookie banner is needed.
- No analytics. Counts come from our own database.
- Admin actions are written to the audit log. Back up the database daily to EU storage, encrypted, kept for 7 days.
- Secrets live in the environment only: `MISTRAL_API_KEY`, `MISTRAL_PLAN`, `TURNSTILE_SECRET`, `MASTER_KEY`, `TOKEN_SALT`, `RATE_LIMIT_SECRET`, `S3_*`, `SMTP_*`.

## 15. Tests

**Unit:** the state machine, `publish_not_before`, the classifier fallback, the keyword override, redaction-span mapping, the surge maths, retention selection.

**End-to-end** (Playwright with Chrome's fake microphone flags):
1. Full flow EN and FR. The submit button stays disabled until every consent and choice is made.
2. **Let it go uploads nothing:** assert no request to `/api/notes`.
3. The 61st second auto-stops the recording.
4. The deletion link removes the playback page, and a posted placement becomes a takedown task.
5. A classifier failure puts the note in Flagged.
6. Approving an own-voice note stays blocked until its audio has been played to the end; a narrator note can be approved without playing.
7. No public route returns raw audio. Fuzz the asset routes with known raw keys.
8. An expired note is gone after the job runs.
9. Paused state closes `/leave`.

**Manual before launch:**
- Real iPhone and Android, inside the Instagram and TikTok in-app browsers.
- A screen-reader pass on 01–05.
- The classifier test set against the real API.

## 16. Milestones

| # | Build | Done when |
|---|---|---|
| M0 | Repo, Docker Compose, fonts, design tokens, the line component, i18n scaffold, test setup. **No server yet: runs in the Claude Code session only** | Screen 01 runs locally in EN and FR; tests run |
| M1 | Sender flow 01–05, upload API, Turnstile, rate limit, encrypted storage, deletion page, **first deploy to an EU staging server** | E2E 1–3 pass; staging is reachable |
| M2 | Worker: normalise, transcribe, classify; the queue | Notes arrive in the queue with transcripts and flags; E2E 5 passes |
| M3 | Switchboard auth, A01, A02, A03, A07, line state | Kenneth can review and decide; E2E 6 and 9 pass |
| M4 | Rendering (redaction tone, Piper, translation), playback page 09, publishing job | Approved notes go live on schedule; E2E 4 and 7 pass |
| M5 | A04, A05, A06, A09, A10: placements, carousel slides, newsletter image, reel, takedowns | One full week can be planned and its assets exported |
| M6 | A08, A11, source tags, surge, retention jobs, backups, hardening | E2E 8 passes; the launch checklist is complete |
| v1.1 | Library 06–08 and D06–D08: theme pages, Encouragement tab, play all, play me one, plays counter, content notes, report | Opens once about 30 notes are approved |

## 17. Decisions log

Rulings made after Version 1. Where an entry differs from an earlier section or a design file, the entry wins.

**18 October 2026 (before M0)**

**Screen 01 French copy (approved by Kenneth, use exactly):**

| EN | FR |
|---|---|
| Leave your voice for a stranger. Up to sixty seconds. No name. | Laisse ta voix à un inconnu. Jusqu'à soixante secondes. Sans nom. |
| this week: what's the in-between you're in right now? | cette semaine : dans quel entre-deux es-tu en ce moment ? |
| the line is open | la ligne est ouverte |
| This line isn't monitored live. | Cette ligne n'est pas surveillée en direct. |
| Struggling right now? Find a helpline in your country. | Ça ne va pas en ce moment ? Trouve une ligne d'écoute dans ton pays. |
| In immediate danger? Call 112 (EU) or your local emergency number. | En danger immédiat ? Appelle le 112 (UE) ou le numéro d'urgence de ton pays. |
| I'm 18 or older. | J'ai 18 ans ou plus. |
| PICK UP THE LINE | DÉCROCHE LA LIGNE |
| Privacy notice | Confidentialité |
| Listen to strangers | Écouter des inconnus |

**French for later screens:** Claude Code drafts it with *tu* and marks each string `TODO(copy-fr)`. Kenneth checks them.

**Wording:** "No name." on the gate is allowed. It is true and doesn't say "anonymous".

**M0 build decisions:**
- "Pick up the line" unlocks when the 18+ box is ticked and does nothing yet in M0; it is wired to screen 02 in M1.
- Fonts are self-hosted from the OFL sources; the design files' Google Fonts links are not used.
- The line sits at exactly 500 px from the top on phone and 540 px on desktop (what every design file uses).
- Desktop layout from 1024 px wide; phone layout below. Short phones scroll; the line keeps its height.
- Screen 01's "dial tone" is static, as drawn (a line with a dot and "the line is open"). No animation, no sound.
- The line is one shared component with variants. Each variant is built in the milestone that adds its screen; M0 builds the dial (01).
- The desktop gate's "Listen to strangers" link is hidden until v1.1.
- `/privacy` is a placeholder page marked `TODO(legal)` until the notice is written.
- "Pick up the line" is a real `<button>` on phone and desktop (the desktop design used a link, which can't be disabled).
- The line-state label on 01 is fixed at "open" until line state exists (M3).
- Docker Compose is written in M0 (web + Postgres); it is only run if Docker is available in the session.

**Design contradictions (the spec wins in every case):**
- **Consent text 2:** use the spec's version (`2026-10-a`, section 9.5), not the shorter wording in `Share`/`DShare`.
- **Surge vs line state:** a surge only raises an alert (badge and email). The line state changes only when Kenneth sets it. `ASurge`'s "turned on by itself" refers to the alert only.
- **A03 Flagged:** the headline is "CHECK THIS FLAG", with the sub-line "If it's a real risk, it's deleted. If not, it goes back to the queue." (replaces "THIS NOTE WON'T BE PUBLISHED.").
- **A01 Approve:** the text under Approve in v1 is "Goes live on its playback page, and to 'Approved, not placed' on the schedule." The library is mentioned only from v1.1.
- **Report (09):** opens a small form with a reason (worrying content / identifies someone / something else) and optional text. No reporter data is stored. Reports are rate-limited per HMAC'd IP, like uploads. One report puts the note at the top of Flagged, tagged "Reported", while it stays live. Three reports hide it automatically until Kenneth decides.
- **Private link (05):** the layout fits a 22+ character token, in monospace, on two lines on phone if needed.
- **A07:** the rate-limit rule is labelled "3 notes a day per connection". The limit stays IP-based (section 7).
- **Alyssa** (named on A03) is the mental-health board lead. Her name is plain text on that screen.

## 18. Launch checklist (not code; tracked here)

- [ ] Classifier decided: Mistral with a DPA in place (free plan only with Mistral's written confirmation), or `CLASSIFIER_MODE=keywords` until then
- [ ] DPIA approved by the board and signed, describing the classifier set-up actually running
- [ ] Board's input on the crisis rule and the keyword lists (needed for the DPIA anyway)
- [ ] EN and FR privacy notice and consent text; French legal text checked
- [ ] Keyword lists from the board loaded
- [ ] Piper voices chosen (licences checked), 6–10 per language
- [ ] First 4 weekly prompts, EN and FR
- [ ] Real-device test in Instagram and TikTok in-app browsers
- [ ] Bio link set to `line.histrnger.com/leave?from=intro` before the intro video
- [ ] Backup reviewer invited
