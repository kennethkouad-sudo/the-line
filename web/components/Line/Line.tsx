import styles from "./Line.module.css";

/**
 * The signature element (spec 9.1): one 2 px ink line, edge to edge, at the same
 * height on every screen. Each screen gives it a different meaning.
 *
 * Variants arrive with their screens: fork (02), waveform (03), knot (04),
 * ticket (05) in M1, scrubber (09) in M4, clothesline in v1.1.
 */
export type LineVariant = "dial";

type Props = {
  variant: LineVariant;
  /** Handwritten text under the right end of the line, e.g. "the line is open". */
  status?: string;
};

export function Line({ variant, status }: Props) {
  return (
    <div className={styles.line} data-testid="the-line" data-variant={variant}>
      <span className={styles.stroke} aria-hidden="true" />
      {variant === "dial" && <span className={styles.dot} aria-hidden="true" />}
      {status && <p className={styles.status}>{status}</p>}
    </div>
  );
}
