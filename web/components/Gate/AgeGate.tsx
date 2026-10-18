"use client";

import { useState } from "react";
import styles from "./Gate.module.css";

type Props = {
  checkboxLabel: string;
  buttonLabel: string;
};

/** Screen 01: "Pick up the line" stays disabled until the 18+ box is ticked (spec 9.2). */
export function AgeGate({ checkboxLabel, buttonLabel }: Props) {
  const [isAdult, setIsAdult] = useState(false);

  return (
    <>
      <label className={styles.adult}>
        <input type="checkbox" checked={isAdult} onChange={(event) => setIsAdult(event.target.checked)} />
        <span>{checkboxLabel}</span>
      </label>
      {/* TODO(M1): wire this to screen 02 (Mode). In M0 it unlocks but does nothing yet. */}
      <button type="button" className={`${styles.pickUp} display`} disabled={!isAdult}>
        {buttonLabel}
      </button>
    </>
  );
}
