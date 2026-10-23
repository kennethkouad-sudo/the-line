import { useTranslations } from "next-intl";
import styles from "./StagingBar.module.css";

/** Decisions log: a thin bar at the top of every staging page. */
export function StagingBar() {
  const t = useTranslations("staging");
  return (
    <p className={`${styles.bar} display`} data-testid="staging-bar">
      {t("bar")}
    </p>
  );
}
