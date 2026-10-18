import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import styles from "./privacy.module.css";

// TODO(legal): placeholder until the EN and FR privacy notices are written and checked.
export default async function PrivacyPage() {
  const t = await getTranslations();

  return (
    <main className={styles.page}>
      <Link href="/leave" className={`${styles.wordmark} display`}>
        {t("brand.wordmark")}
      </Link>
      <h1 className={`${styles.title} display`}>{t("privacy.title")}</h1>
      <p>{t("privacy.body")}</p>
      <HelplineBlock className={styles.helpline} />
    </main>
  );
}
