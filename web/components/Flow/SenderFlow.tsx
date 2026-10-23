"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoneScreen } from "@/components/Gone/GoneScreen";
import { ModeScreen } from "@/components/Mode/ModeScreen";
import { RecordScreen } from "@/components/Record/RecordScreen";
import { ShareScreen } from "@/components/Share/ShareScreen";
import { TicketScreen } from "@/components/Ticket/TicketScreen";
import { FlowContext, type Flow, type Mode, type Recording, type Sent, type Step } from "./flow";

type Props = {
  /** Screen 01, rendered on the server. */
  gate: React.ReactNode;
  turnstileSiteKey: string | null;
};

/** Screens the browser's Back button can return to. The others can't be revisited. */
const REVISITABLE: Step[] = ["gate", "mode", "record", "share"];

/**
 * The recorder flow, screens 01–05 (spec 9.2), on the one /leave page. The recording
 * stays in this tab's memory; it is only sent when the sender shares it (invariant 1).
 */
export function SenderFlow({ gate, turnstileSiteKey }: Props) {
  const [step, setStep] = useState<Step>("gate");
  const [mode, setMode] = useState<Mode | null>(null);
  const [freeNote, setFreeNote] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const go = useCallback((next: Step) => {
    setStep(next);
    if (REVISITABLE.includes(next)) window.history.pushState({ step: next }, "");
    else window.history.replaceState({ step: next }, "");
    window.scrollTo(0, 0);
  }, []);

  // The browser's Back button moves between screens instead of leaving the page.
  useEffect(() => {
    window.history.replaceState({ step: "gate" }, "");
    const onPop = (event: PopStateEvent) => {
      const target = (event.state?.step as Step | undefined) ?? "gate";
      setStep((current) => {
        if (current === "ticket" || current === "gone") return current;
        if (target === "share" && !recordingRef.current) return "record";
        return REVISITABLE.includes(target) ? target : "gate";
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const flow = useMemo<Flow>(
    () => ({
      step,
      mode,
      freeNote,
      recording,
      sent,
      go,
      chooseMode: (next) => {
        setMode(next);
        setFreeNote(false);
        setRecording(null);
        go("record");
      },
      setFreeNote,
      setRecording,
      letGo: () => {
        setRecording(null);
        go("gone");
      },
      finish: (result) => {
        setRecording(null);
        setSent(result);
        go("ticket");
      },
      again: () => {
        setRecording(null);
        setSent(null);
        setMode(null);
        go("mode");
      },
    }),
    [step, mode, freeNote, recording, sent, go],
  );

  return (
    <FlowContext.Provider value={flow}>
      {step === "gate" && gate}
      {step === "mode" && <ModeScreen />}
      {step === "record" && <RecordScreen />}
      {step === "share" && (recording ? <ShareScreen turnstileSiteKey={turnstileSiteKey} /> : <RecordScreen />)}
      {step === "gone" && <GoneScreen />}
      {step === "ticket" && <TicketScreen />}
    </FlowContext.Provider>
  );
}
