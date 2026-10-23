-- M1: notes (spec section 5), the deletion log, prompts, and the short-lived rate-limit store.
-- Columns used by later milestones are created now and stay empty until then.

CREATE TYPE note_status AS ENUM ('received', 'processing', 'in_queue', 'approved', 'live', 'deleted');
CREATE TYPE note_mode AS ENUM ('confide', 'encourage');
CREATE TYPE note_language AS ENUM ('en', 'fr', 'other');
CREATE TYPE voice_choice AS ENUM ('own', 'narrator');
CREATE TYPE wait_choice AS ENUM ('asap', 'three_days');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE note_decision AS ENUM ('approved', 'not_published', 'risk_confirmed', 'minor');
CREATE TYPE prompt_state AS ENUM ('draft', 'scheduled', 'current', 'past');

-- Filled in by the switchboard from M3. Until then the current prompt is seeded here
-- and its text lives in the message files.
CREATE TABLE prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  text_en text NOT NULL,
  text_fr text NOT NULL,
  state prompt_state NOT NULL DEFAULT 'draft'
);

INSERT INTO prompts (week_start, text_en, text_fr, state) VALUES
  ('2026-10-19', 'what''s the in-between you''re in right now?', 'dans quel entre-deux es-tu en ce moment ?', 'current');

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  delete_token_hash text NOT NULL UNIQUE,
  status note_status NOT NULL DEFAULT 'received',
  mode note_mode NOT NULL,
  prompt_id uuid REFERENCES prompts (id),
  language note_language,
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 5000 AND 62000),
  source_tag text CHECK (source_tag ~ '^[a-z0-9-]{1,32}$'),
  -- Invariant 1 and spec 7: a note can't exist without all three consents.
  consent_store boolean NOT NULL CHECK (consent_store),
  consent_publish boolean NOT NULL CHECK (consent_publish),
  consent_edit boolean NOT NULL CHECK (consent_edit),
  consent_text_version text NOT NULL,
  voice_choice voice_choice NOT NULL,
  wait_choice wait_choice NOT NULL,
  moderator_hold_until timestamptz,
  publish_not_before timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days',
  deleted_at timestamptz,
  raw_audio_key text,
  raw_audio_mime text,
  raw_transcript_enc text,
  classifier_output jsonb,
  risk risk_level,
  minor_suspected boolean,
  redacted_transcript text,
  redaction_spans jsonb,
  translation text,
  themes text[],
  library_ok boolean,
  needs_content_note boolean,
  published_audio_key text,
  narrator_voice_id text,
  decided_at timestamptz,
  decided_by uuid,
  decision note_decision,
  plays integer NOT NULL DEFAULT 0
);

CREATE INDEX notes_status_expires ON notes (status, expires_at);

-- No content, ever (spec 5).
CREATE TABLE deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL CHECK (actor IN ('sender', 'expiry', 'moderator')),
  had_placements text[] NOT NULL DEFAULT '{}',
  action text NOT NULL
);

-- Spec 5: HMAC(IP, daily-rotating secret), kept 24 hours. Never joined to a note.
CREATE TABLE rate_limits (
  key text NOT NULL,
  bucket text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, bucket)
);
