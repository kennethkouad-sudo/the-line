"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, useFlow, type Voice, type Wait } from "@/components/Flow/flow";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import { wavePath } from "@/components/Record/wave";
import { CONSENT_TEXT_VERSION } from "@/lib/consent";
import { SOURCE_TAG_STORAGE_KEY } from "@/lib/sourceTag";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import styles from "./Share.module.css";

const CONSENTS = ["consentStore", "consentPublish", "consentEdit"] as const;
const FIELD = { consentStore: "consent_store", consentPublish: "consent_publish", consentEdit: "consent_edit" };

const ERROR_MESSAGE: Record<string, string> = {
  bot_check: "error_bot_check",
  rate_limited: "error_rate_limited",
  too_short: "error_too_short",
  too_long: "error_recording",
  too_large: "error_recording",
  bad_type: "error_recording",
};

function readSourceTag(): string | null {
  try {
    return sessionStorage.getItem(SOURCE_TAG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Screen 04, from design/Share.dc.html (phone) and design/DShare.dc.html (desktop). */
export function ShareScreen({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const t = useTranslations("share");
  const locale = useLocale();
  const flow = useFlow();
  const recording = flow.recording!;

  const [sharing, setSharing] = useState(false);
  const [consents, setConsents] = useState({ consentStore: false, consentPublish: false, consentEdit: false });
  const [voice, setVoice] = useState<Voice | null>(null);
  const [wait, setWait] = useState<Wait | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  // Spec 9.2: the button stays disabled until everything is set. Nothing is pre-ticked.
  const ready = Object.values(consents).every(Boolean) && !!voice && !!wait && !!botToken && !sending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSending(true);
    setError(null);

    const body = new FormData();
    const extension = recording.mime.includes("mp4") ? "m4a" : "webm";
    body.append("audio", recording.blob, `note.${extension}`);
    body.append("duration_ms", String(Math.round(recording.durationMs)));
    body.append("mode", flow.mode ?? "confide");
    body.append("prompt", flow.freeNote ? "free" : "weekly");
    for (const consent of CONSENTS) body.append(FIELD[consent], "yes");
    body.append("consent_text_version", CONSENT_TEXT_VERSION);
    body.append("voice", voice!);
    body.append("wait", wait!);
    body.append("cf-turnstile-response", botToken!);
    const tag = readSourceTag();
    if (tag) body.append("source_tag", tag);

    try {
      const response = await fetch("/api/notes", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { deleteUrl?: string; error?: string };
      if (response.ok && result.deleteUrl) {
        flow.finish({ deleteUrl: result.deleteUrl, voice: voice!, wait: wait! });
        return;
      }
      setError(ERROR_MESSAGE[result.error ?? ""] ?? "error_other");
    } catch {
      setError("error_other");
    }
    // A bot-check token works once: get a fresh one for the next try.
    turnstile.current?.reset();
    setSending(false);
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <ListenBack />

        <h1 className={`${styles.title} display`}>{t("title")}</h1>

        <div className={styles.choices}>
          <button type="button" className={styles.choice} onClick={flow.letGo}>
            <span className={`${styles.choiceTitle} display`}>{t("letGoTitle")}</span>
            <span className={styles.choiceBody}>{t("letGoBody")}</span>
          </button>
          <button
            type="button"
            className={styles.choice}
            aria-pressed={sharing}
            aria-controls={sharing ? "share-form" : undefined}
            onClick={() => setSharing(true)}
          >
            <span className={`${styles.choiceTitle} display`}>{t("shareTitle")}</span>
            <span className={styles.choiceBody}>{t("shareBody")}</span>
          </button>
        </div>
      </div>

      <Line variant="knot" status={t("tieItOn")} />

      <div className={styles.bottom}>
        <p className={`${styles.reviewed} ${styles.reviewedDesktop}`}>{t("reviewed")}</p>

        {sharing && (
          <form id="share-form" className={styles.panel} onSubmit={submit} aria-labelledby="consent-title">
            <h2 id="consent-title" className={styles.panelTitle}>
              {t("consentTitle")}
            </h2>

            {CONSENTS.map((consent) => (
              <label key={consent} className={styles.consent}>
                <input
                  type="checkbox"
                  checked={consents[consent]}
                  onChange={(event) => setConsents({ ...consents, [consent]: event.target.checked })}
                />
                <span>{t(consent)}</span>
              </label>
            ))}

            <fieldset className={styles.group}>
              <legend className="display">{t("voiceTitle")}</legend>
              <div className={styles.voiceOptions}>
                {(["own", "narrator"] as const).map((option) => (
                  <label key={option} className={styles.option}>
                    <input type="radio" name="voice" checked={voice === option} onChange={() => setVoice(option)} />
                    <span>
                      {t.rich(option === "own" ? "voiceOwn" : "voiceNarrator", {
                        strong: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className="display">{t("whenTitle")}</legend>
              <div className={styles.whenOptions}>
                {(["asap", "three_days"] as const).map((option) => (
                  <label key={option} className={styles.option}>
                    <input type="radio" name="wait" checked={wait === option} onChange={() => setWait(option)} />
                    <span>{t(option === "asap" ? "whenAsap" : "whenThreeDays")}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className={`${styles.reviewed} ${styles.reviewedPhone}`}>{t("reviewed")}</p>

            {turnstileSiteKey && (
              <Turnstile ref={turnstile} siteKey={turnstileSiteKey} language={locale} onToken={setBotToken} />
            )}

            <p className={styles.error} role="alert">
              {error ? t(error) : ""}
            </p>

            <button type="submit" className={`${styles.submit} display`} disabled={!ready} aria-busy={sending}>
              {sending ? t("sending") : t("submit")}
            </button>
          </form>
        )}

        <HelplineBlock className={styles.helpline} />
      </div>
    </main>
  );
}

/** Listen back, with the recording's own line (designs Share and DShare). */
function ListenBack() {
  const t = useTranslations("share");
  const { recording } = useFlow();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const url = useMemo(() => URL.createObjectURL(recording!.blob), [recording]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const levels = recording!.levels;
  const path = wavePath(levels, (i) => (levels.length > 1 ? (i / (levels.length - 1)) * 400 : 0), 15, 12);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) element.play().catch(() => setPlaying(false));
    else element.pause();
  };

  return (
    <div className={styles.player}>
      <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? t("pause") : t("listen")}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          {playing ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4 2.5v11l9-5.5z" />}
        </svg>
      </button>
      <svg className={styles.mini} viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <span className={`${styles.duration} display`}>{formatTime(recording!.durationMs)}</span>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
