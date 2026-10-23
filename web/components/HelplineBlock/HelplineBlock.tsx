import { useTranslations } from "next-intl";
import styles from "./HelplineBlock.module.css";

type Props = {
  /** "This line isn't monitored live." is shown on the gate and record screens (spec 9.3). */
  showNotMonitored?: boolean;
  /** Small, cream on ink: the dark recording screen (decisions log). */
  small?: boolean;
  className?: string;
};

/** Spec 9.3: shown on every sender and public page (invariant 9). */
export function HelplineBlock({ showNotMonitored = false, small = false, className }: Props) {
  const t = useTranslations("helpline");

  return (
    <div
      className={[styles.block, small && styles.small, className].filter(Boolean).join(" ")}
      data-testid="helpline-block"
    >
      {showNotMonitored && <p className={styles.notMonitored}>{t("notMonitored")}</p>}
      <p>
        {t.rich("struggling", {
          link: (chunks) => <a href="https://findahelpline.com">{chunks}</a>,
        })}
      </p>
      <p>{t.rich("danger", { strong: (chunks) => <strong>{chunks}</strong> })}</p>
    </div>
  );
}
