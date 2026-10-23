"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { formatTime, LEVEL_STEP_MS, MAX_RECORDING_MS, MIN_RECORDING_MS, useFlow } from "@/components/Flow/flow";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import { MicBlocked } from "./MicBlocked";
import { useRecorder } from "./useRecorder";
import { wavePath } from "./wave";
import styles from "./Record.module.css";

const WIDTH = 1000; // the line's drawing width: 60 seconds edge to edge
const TICKS = [1, 2, 3, 4, 5]; // 0:10 … 0:50 (desktop)

const isInteractive = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest("button, a, input, textarea, select, [contenteditable]");

/** Screen 03, from design/Record.dc.html (phone) and design/DRecord.dc.html (desktop). */
export function RecordScreen() {
  const t = useTranslations();
  const flow = useFlow();
  const { state, elapsedMs, levels, start, stop, reset } = useRecorder(flow.recording, flow.setRecording);

  // Decisions log: on desktop the space bar starts and stops (focused buttons keep their own Space).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat || isInteractive(event.target)) return;
      event.preventDefault();
      if (state === "idle") start();
      else if (state === "recording") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, start, stop]);

  if (state === "blocked") return <MicBlocked />;

  const recording = state === "recording";
  const hasRecording = state === "stopped" && !!flow.recording;
  const tooShort = hasRecording && flow.recording!.durationMs < MIN_RECORDING_MS;
  const tip = Math.min(1, elapsedMs / MAX_RECORDING_MS);
  const prompt = flow.mode === "encourage" ? t("mode.encouragePrompt") : t("prompt.current");
  const path = wavePath(levels, (i) => ((i * LEVEL_STEP_MS) / MAX_RECORDING_MS) * WIDTH, 60, 44);

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <h1 className={`${styles.modeLabel} display`}>
          {flow.mode === "encourage" ? t("mode.encourageTitle") : t("mode.confideTitle")}
        </h1>
        <p className={styles.prompt} data-set-aside={flow.freeNote || undefined}>
          {prompt}
        </p>
        <button
          type="button"
          className={styles.sayAnything}
          aria-pressed={flow.freeNote}
          onClick={() => flow.setFreeNote(!flow.freeNote)}
        >
          {t("record.sayAnything")}
        </button>
      </div>

      <Line variant="waveform">
        <svg
          className={styles.wave}
          viewBox={`0 0 ${WIDTH} 120`}
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="waveform"
        >
          <line className={styles.ahead} x1={tip * WIDTH} y1="60" x2={WIDTH} y2="60" />
          <path className={styles.trace} d={path} />
        </svg>
        <span className={styles.halo} style={{ left: `${tip * 100}%` }} aria-hidden="true" />
        <span className={styles.tip} style={{ left: `${tip * 100}%` }} aria-hidden="true" />
        <span
          className={`${styles.timer} display`}
          style={{ left: `clamp(36px, ${tip * 100}%, calc(100% - 36px))` }}
          role="timer"
          aria-label={t("record.elapsed", { elapsed: formatTime(elapsedMs) })}
        >
          {formatTime(elapsedMs)}
        </span>
        {TICKS.map((tick) => (
          <span key={tick} className={styles.tick} style={{ left: `${(tick / 6) * 100}%` }} aria-hidden="true">
            0:{tick}0
          </span>
        ))}
        <span className={`${styles.max} display`} aria-hidden="true">
          {t("record.max")}
        </span>
      </Line>

      <div className={styles.bottom}>
        <p className={`${styles.hint} ${styles.phoneOnly}`}>{t("record.hint")}</p>
        <p className={`${styles.hint} ${styles.desktopOnly}`}>{t("record.hintDesktop")}</p>

        <div className={styles.controls}>
          <button type="button" className={styles.startOver} onClick={reset} disabled={!recording && !hasRecording}>
            {t("record.startOver")}
          </button>

          {recording ? (
            <button type="button" className={styles.stop} onClick={stop} aria-label={t("record.stop")}>
              <span className={styles.square} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={styles.start} onClick={start} disabled={state !== "idle"}>
              {t("record.start")}
            </button>
          )}

          <button
            type="button"
            className={styles.done}
            disabled={!hasRecording || tooShort}
            onClick={() => flow.go("share")}
          >
            {t("record.done")}
          </button>
        </div>

        <p className={styles.tooShort} aria-live="polite">
          {tooShort ? t("record.tooShort") : ""}
        </p>

        <p className={`${styles.staysHere} ${styles.phoneOnly}`}>{t("record.staysHere")}</p>
        <p className={`${styles.staysHere} ${styles.desktopOnly}`}>{t("record.staysHereDesktop")}</p>

        <HelplineBlock small showNotMonitored className={styles.helpline} />
      </div>
    </main>
  );
}
