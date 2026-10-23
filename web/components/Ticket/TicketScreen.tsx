"use client";

import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/CopyButton/CopyButton";
import { useFlow } from "@/components/Flow/flow";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import styles from "./Ticket.module.css";

/** Screen 05, from design/Ticket.dc.html (phone) and design/DTicket.dc.html (desktop). */
export function TicketScreen() {
  const t = useTranslations("ticket");
  const flow = useFlow();
  const { deleteUrl, voice, wait } = flow.sent!;
  const shownUrl = deleteUrl.replace(/^https?:\/\//, "");
  const threeDays = wait === "three_days";

  const saveFile = () => {
    const file = new Blob([t("fileText", { url: deleteUrl })], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = t("fileName");
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <h1 className={`${styles.title} display`}>{t("title")}</h1>
        <p className={styles.reviewed}>{t("reviewed")}</p>
        <p className={styles.chose}>
          {t("chose", {
            voice: voice === "own" ? t("voiceOwn") : t("voiceNarrator"),
            wait: threeDays ? t("waitThreeDays") : t("waitAsap"),
          })}{" "}
          <span className={styles.after}>{threeDays ? t("afterThreeDays") : t("afterAsap")}</span>
        </p>
      </div>

      <Line variant="ticket" />

      <div className={styles.bottom}>
        {/* The ticket hangs from the line through its hole, which sits on the line. */}
        <div className={styles.hanger}>
          <section className={styles.ticket} aria-labelledby="private-link">
            <span className={styles.hole} aria-hidden="true" />
            <span className={styles.perforation} aria-hidden="true" />
            <h2 id="private-link" className={`${styles.linkTitle} display`}>
              {t("linkTitle")}
            </h2>
            <p className={styles.url} data-testid="private-link">
              {shownUrl}
            </p>
            <div className={styles.actions}>
              <CopyButton
                text={deleteUrl}
                label={t("copy")}
                copiedLabel={t("copied")}
                className={styles.copy}
                showText
              />
              <button type="button" className={styles.save} onClick={saveFile}>
                {t("save")}
              </button>
            </div>
            <p className={styles.linkNote}>{t("linkNote")}</p>
            <span className={styles.stamp} aria-hidden="true">
              {threeDays ? t("stampThreeDays") : t("stampAsap")}
            </span>
          </section>
          <span className={styles.thread} aria-hidden="true" />
        </div>

        <div className={styles.after05}>
          <HelplineBlock />
          <p className={styles.links}>
            <button type="button" className={styles.again} onClick={flow.again}>
              {t("leaveAnother")}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
