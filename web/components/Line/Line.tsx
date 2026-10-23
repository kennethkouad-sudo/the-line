import styles from "./Line.module.css";

/**
 * The signature element (spec 9.1): one 2 px ink line, edge to edge, at the same
 * height on every screen. Each screen gives it a different meaning.
 *
 * dial (01), fork (02), waveform (03, drawn live by the recorder as children),
 * knot (04), ticket (05). Scrubber (09) arrives in M4, clothesline in v1.1.
 */
export type LineVariant = "dial" | "fork" | "waveform" | "knot" | "ticket";

type Props = {
  variant: LineVariant;
  /** Handwritten text by the line, e.g. "the line is open" (01) or "tie it on" (04). */
  status?: string;
  /** Drawn over the line, centred on it. The waveform variant uses this. */
  children?: React.ReactNode;
};

export function Line({ variant, status, children }: Props) {
  return (
    <div className={`${styles.line} ${styles[variant]}`} data-testid="the-line" data-variant={variant}>
      {variant !== "waveform" && variant !== "knot" && <span className={styles.stroke} aria-hidden="true" />}
      {variant === "dial" && <span className={styles.dot} aria-hidden="true" />}
      {variant === "fork" && <Fork />}
      {variant === "knot" && <Knot />}
      {status && <p className={styles.status}>{status}</p>}
      {children}
    </div>
  );
}

/** 02: on phone the line splits to reach both cards, then joins again (design Mode). */
function Fork() {
  return (
    <>
      <svg className={styles.forkLeft} aria-hidden="true" width="70" height="460" viewBox="0 0 70 460">
        <path d="M0 230 H34 C52 230 52 120 70 120" />
        <path d="M34 230 C52 230 52 340 70 340" />
        <circle cx="34" cy="230" r="4.5" />
      </svg>
      <svg className={styles.forkRight} aria-hidden="true" width="24" height="460" viewBox="0 0 24 460">
        <path d="M0 120 C14 120 14 230 24 230" />
        <path d="M0 340 C14 340 14 230 24 230" />
      </svg>
    </>
  );
}

/** 04: the line ties a knot (designs Share and DShare). */
function Knot() {
  return (
    <span className={styles.knotRow} aria-hidden="true">
      <span className={styles.knotBefore} />
      <svg className={styles.knotPhone} width="54" height="60" viewBox="0 0 54 60">
        <path d="M0 30 C10 30 16 10 26 10 C38 10 38 30 24 34 C14 37 14 26 28 26 C38 26 44 30 54 30" />
      </svg>
      <svg className={styles.knotDesktop} width="62" height="60" viewBox="0 0 62 60">
        <path d="M0 30 C12 30 18 10 30 10 C44 10 44 30 28 34 C16 37 16 26 32 26 C44 26 50 30 62 30" />
      </svg>
      <span className={styles.knotAfter} />
    </span>
  );
}
