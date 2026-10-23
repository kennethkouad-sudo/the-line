"use client";

import { useTranslations } from "next-intl";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import { CopyButton } from "@/components/CopyButton/CopyButton";
import styles from "./MicBlocked.module.css";

/**
 * Spec 9.2: the microphone can't be reached (denied, missing, or an in-app browser such
 * as Instagram's or TikTok's). Copy approved in the decisions log.
 */
export function MicBlocked() {
  const t = useTranslations("micBlocked");

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <h1 className={`${styles.title} display`}>{t("title")}</h1>
        <p className={styles.body}>{t("body")}</p>
      </div>
      <Line variant="ticket" />
      <div className={styles.bottom}>
        <CopyButton
          text={() => window.location.href}
          label={t("copy")}
          copiedLabel={t("copied")}
          className={styles.copy}
          showText
        />
        <HelplineBlock showNotMonitored className={styles.helpline} />
      </div>
    </main>
  );
}
