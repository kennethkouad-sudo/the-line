import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { LanguageToggle } from "@/components/LanguageToggle/LanguageToggle";
import { Line } from "@/components/Line/Line";
import { LIBRARY_ENABLED } from "@/lib/features";
import { AgeGate } from "./AgeGate";
import styles from "./Gate.module.css";

/** Screen 01: the gate. */
export async function Gate() {
  const t = await getTranslations();
  const [first, ...rest] = t("brand.title").split(" ");

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <header className={styles.header}>
          <span className={`${styles.wordmark} display`}>{t("brand.wordmark")}</span>
          {LIBRARY_ENABLED && (
            <Link href="/" className={styles.listen}>
              {t("gate.listenLink")}
            </Link>
          )}
          <LanguageToggle />
        </header>

        <h1 className={`${styles.title} display`}>
          <span>{first}</span> <span>{rest.join(" ")}</span>
        </h1>

        <div className={styles.intro}>
          <p className={styles.tagline}>{t("gate.tagline")}</p>
          {/* TODO(M3): the prompt of the week comes from the prompts table. */}
          <p className={`${styles.prompt} handwritten`}>{t("gate.promptOfWeek", { prompt: t("prompt.current") })}</p>
        </div>
      </div>

      {/* TODO(M3): the status follows the line state; it is always "open" until then. */}
      <Line variant="dial" status={t("gate.lineOpen")} />

      <div className={styles.bottom}>
        <HelplineBlock showNotMonitored className={styles.helpline} />

        <div className={styles.action}>
          <AgeGate checkboxLabel={t("gate.adultCheckbox")} buttonLabel={t("gate.pickUp")} />
          <p className={styles.hint}>
            {t("gate.desktopHint")} <Link href="/privacy">{t("gate.privacyLink")}</Link>
          </p>
        </div>

        <Link href="/privacy" className={styles.privacy}>
          {t("gate.privacyLink")}
        </Link>
      </div>
    </main>
  );
}
