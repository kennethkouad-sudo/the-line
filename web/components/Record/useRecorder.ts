"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_STEP_MS, MAX_RECORDING_MS, type Recording } from "@/components/Flow/flow";

export type RecorderState = "idle" | "starting" | "recording" | "stopped" | "blocked";

/** Spec 9.2: Opus in WebM where supported (Chrome, Firefox, Android), otherwise MP4 (Safari). */
function pickMime(): string | undefined {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

/**
 * Records up to 60 seconds from the microphone, and samples its loudness to draw the line.
 * The microphone is only requested when start() is called (spec 9.2), and released on stop.
 * Nothing is uploaded here.
 */
export function useRecorder(initial: Recording | null, onRecorded: (recording: Recording | null) => void) {
  const [state, setState] = useState<RecorderState>(initial ? "stopped" : "idle");
  const [elapsedMs, setElapsedMs] = useState(initial?.durationMs ?? 0);
  const [levels, setLevels] = useState<number[]>(initial?.levels ?? []);

  const live = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    audio: AudioContext;
    frame: number;
    timer: ReturnType<typeof setTimeout>;
    startedAt: number;
    levels: number[];
    chunks: Blob[];
  } | null>(null);

  // The 60-second timer calls the latest stop().
  const stopRef = useRef<() => void>(() => {});

  const release = useCallback(() => {
    const session = live.current;
    if (!session) return;
    cancelAnimationFrame(session.frame);
    clearTimeout(session.timer);
    session.stream.getTracks().forEach((track) => track.stop());
    session.audio.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    const session = live.current;
    if (!session || session.recorder.state === "inactive") return;
    const durationMs = Math.min(MAX_RECORDING_MS, performance.now() - session.startedAt);
    setElapsedMs(durationMs);
    session.recorder.addEventListener(
      "stop",
      () => {
        const { chunks } = session;
        const mime = session.recorder.mimeType || chunks[0]?.type || "audio/webm";
        onRecorded({ blob: new Blob(chunks, { type: mime }), mime, durationMs, levels: [...session.levels] });
      },
      { once: true },
    );
    session.recorder.stop();
    release();
    setState("stopped");
  }, [onRecorded, release]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("blocked");
      return;
    }
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, no microphone, or an in-app browser that doesn't allow it (spec 9.2).
      setState("blocked");
      return;
    }

    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.addEventListener("dataavailable", (event) => event.data.size && chunks.push(event.data));
    // One piece, not timed chunks: Safari's MP4 plays back more reliably that way.
    recorder.start();

    const startedAt = performance.now();
    const session = {
      recorder,
      stream,
      audio,
      frame: 0,
      timer: setTimeout(() => stopRef.current(), MAX_RECORDING_MS),
      startedAt,
      levels: [] as number[],
      chunks,
    };
    live.current = session;

    // Loudness, one value every LEVEL_STEP_MS, taking the peak within each step.
    const tick = () => {
      const now = Math.min(MAX_RECORDING_MS, performance.now() - startedAt);
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = Math.min(1, Math.sqrt(Math.sqrt(sum / samples.length)) * 1.6);
      const index = Math.floor(now / LEVEL_STEP_MS);
      while (session.levels.length <= index) session.levels.push(0);
      session.levels[index] = Math.max(session.levels[index], level);
      setElapsedMs(now);
      setLevels(session.levels.slice());
      session.frame = requestAnimationFrame(tick);
    };
    session.frame = requestAnimationFrame(tick);
    setLevels([]);
    setState("recording");
  }, [state]);

  const reset = useCallback(() => {
    if (live.current?.recorder.state !== "inactive") live.current?.recorder.stop();
    release();
    live.current = null;
    setElapsedMs(0);
    setLevels([]);
    setState("idle");
    onRecorded(null);
  }, [onRecorded, release]);

  // Leaving the screen mid-recording releases the microphone.
  useEffect(() => release, [release]);

  return { state, elapsedMs, levels, start, stop, reset };
}
