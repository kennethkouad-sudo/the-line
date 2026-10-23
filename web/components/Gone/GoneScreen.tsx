"use client";

import { useTranslations } from "next-intl";
import { useFlow } from "@/components/Flow/flow";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import styles from "./Gone.module.css";

/** After "Let it go" (decisions log). The recording was discarded; nothing was sent. */
export function GoneScreen() {
  const t = useTranslations("letGo");
  const { again } = useFlow();

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <h1 className={styles.gone}>{t("gone")}</h1>
      </div>
      <Line variant="ticket" />
      <div className={styles.bottom}>
        <button type="button" className={styles.again} onClick={again}>
          {t("leaveAnother")}
        </button>
        <HelplineBlock className={styles.helpline} />
      </div>
    </main>
  );
}
