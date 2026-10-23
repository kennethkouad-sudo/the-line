"use client";

import { useState } from "react";
import { useFlow } from "@/components/Flow/flow";
import styles from "./Gate.module.css";

type Props = {
  checkboxLabel: string;
  buttonLabel: string;
};

/** Screen 01: "Pick up the line" stays disabled until the 18+ box is ticked (spec 9.2). */
export function AgeGate({ checkboxLabel, buttonLabel }: Props) {
  const [isAdult, setIsAdult] = useState(false);
  const { go } = useFlow();

  return (
    <>
      <label className={styles.adult}>
        <input type="checkbox" checked={isAdult} onChange={(event) => setIsAdult(event.target.checked)} />
        <span>{checkboxLabel}</span>
      </label>
      <button type="button" className={`${styles.pickUp} display`} disabled={!isAdult} onClick={() => go("mode")}>
        {buttonLabel}
      </button>
    </>
  );
}
