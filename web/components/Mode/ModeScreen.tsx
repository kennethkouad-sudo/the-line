"use client";

import { useTranslations } from "next-intl";
import { useFlow } from "@/components/Flow/flow";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import styles from "./Mode.module.css";

/** Screen 02, from design/Mode.dc.html (phone) and design/DMode.dc.html (desktop). */
export function ModeScreen() {
  const t = useTranslations();
  const { chooseMode, go } = useFlow();

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <nav className={styles.nav}>
          <button type="button" className={styles.back} onClick={() => go("gate")}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span className={styles.backLabel}>{t("mode.back")}</span>
          </button>
          <span className={`${styles.wordmark} display`}>{t("brand.title")}</span>
        </nav>

        <h1 className={`${styles.title} display`}>{t("mode.title")}</h1>

        <button type="button" className={`${styles.card} ${styles.confide}`} onClick={() => chooseMode("confide")}>
          <span className={`${styles.cardTitle} display`}>{t("mode.confideTitle")}</span>
          <span className={styles.cardBody}>{t("mode.confideBody")}</span>
          <span className={styles.cardPrompt}>{t("prompt.current")}</span>
        </button>
      </div>

      <Line variant="fork" />

      <div className={styles.bottom}>
        <button type="button" className={`${styles.card} ${styles.encourage}`} onClick={() => chooseMode("encourage")}>
          <span className={`${styles.cardTitle} display`}>{t("mode.encourageTitle")}</span>
          <span className={styles.cardBody}>{t("mode.encourageBody")}</span>
          <span className={styles.cardPrompt}>{t("mode.encouragePrompt")}</span>
        </button>

        <p className={`${styles.note} ${styles.freeNote}`}>{t("mode.freeNote")}</p>
        <p className={`${styles.note} ${styles.medicalNote}`}>{t("mode.medicalNote")}</p>

        <HelplineBlock className={styles.helpline} />
      </div>
    </main>
  );
}
