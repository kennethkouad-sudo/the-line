import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DeleteControl } from "@/components/Deletion/DeleteControl";
import { HelplineBlock } from "@/components/HelplineBlock/HelplineBlock";
import { Line } from "@/components/Line/Line";
import { findNoteStatus } from "@/lib/server/notes";
import styles from "@/components/Deletion/Deletion.module.css";
import { deleteNote } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deletion");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * The deletion page (spec 4 and 9.2, invariant 5). The token in the address is the only
 * thing that links a sender to a note; only its salted hash is stored.
 */
export default async function DeletionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("deletion");
  const brand = await getTranslations("brand");
  const status = await findNoteStatus(token);
  const message = status ? t(status) : t("notFound");

  return (
    <main className={styles.page}>
      <div className={`${styles.top} above-the-line`}>
        <Link href="/leave" className={`${styles.wordmark} display`}>
          {brand("title")}
        </Link>
        <h1 className={`${styles.title} display`}>{t("title")}</h1>
        <p className={styles.status} data-testid="note-status" data-status={status ?? "not_found"}>
          {message}
        </p>
        {status && status !== "deleted" && <p className={styles.explain}>{t("explain")}</p>}
      </div>

      <Line variant="ticket" />

      <div className={styles.bottom}>
        {status && status !== "deleted" && <DeleteControl action={deleteNote.bind(null, token)} />}
        <HelplineBlock className={styles.helpline} />
        <Link href="/leave" className={styles.leave}>
          {t("leaveNote")}
        </Link>
      </div>
    </main>
  );
}
