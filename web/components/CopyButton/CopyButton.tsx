"use client";

import { useRef, useState } from "react";
import styles from "./CopyButton.module.css";

type Props = {
  text: string | (() => string);
  label: string;
  copiedLabel: string;
  className?: string;
  /** If the browser won't copy (some in-app browsers), show the text, selected, to copy by hand. */
  showText?: boolean;
};

export function CopyButton({ text, label, copiedLabel, className, showText = false }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const field = useRef<HTMLInputElement>(null);
  const value = () => (typeof text === "function" ? text() : text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value());
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("manual");
      requestAnimationFrame(() => field.current?.select());
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={copy}>
        {label}
      </button>
      <span className={styles.status} aria-live="polite">
        {state === "copied" ? copiedLabel : ""}
      </span>
      {showText && state === "manual" && (
        <input ref={field} className={styles.manual} readOnly value={value()} aria-label={label} />
      )}
    </>
  );
}
