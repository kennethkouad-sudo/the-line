"use client";

import { createContext, useContext } from "react";

export type Step = "gate" | "mode" | "record" | "share" | "gone" | "ticket";
export type Mode = "confide" | "encourage";
export type Voice = "own" | "narrator";
export type Wait = "asap" | "three_days";

/** A finished recording. It lives only in this browser tab until the sender shares it. */
export type Recording = {
  blob: Blob;
  mime: string;
  durationMs: number;
  /** Loudness samples (0–1), one every LEVEL_STEP_MS, for drawing the line. */
  levels: number[];
};

export type Sent = { deleteUrl: string; voice: Voice; wait: Wait };

export type Flow = {
  step: Step;
  mode: Mode | null;
  freeNote: boolean;
  recording: Recording | null;
  sent: Sent | null;
  go: (step: Step) => void;
  chooseMode: (mode: Mode) => void;
  setFreeNote: (free: boolean) => void;
  setRecording: (recording: Recording | null) => void;
  /** Discards the recording and ends ("Let it go"). Nothing is sent. */
  letGo: () => void;
  finish: (sent: Sent) => void;
  /** "Leave another note": back to screen 02 with nothing kept. */
  again: () => void;
};

export const FlowContext = createContext<Flow | null>(null);

export function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error("useFlow outside the sender flow");
  return flow;
}

export const LEVEL_STEP_MS = 250;
export const MAX_RECORDING_MS = 60_000;
export const MIN_RECORDING_MS = 5_000;

export function formatTime(ms: number): string {
  const seconds = Math.min(60, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
