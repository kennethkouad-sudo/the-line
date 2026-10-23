"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import styles from "./Deletion.module.css";

type Props = { action: () => Promise<{ ok: boolean }> };

/** Spec 9.2: a Delete button with a confirmation. The result is final. */
export function DeleteControl({ action }: Props) {
  const t = useTranslations("deletion");
  const [stage, setStage] = useState<"ask" | "confirm" | "done" | "error">("ask");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const confirm = () =>
    startTransition(async () => {
      const result = await action();
      setStage(result.ok ? "done" : "error");
      // The page above then shows the note's new status: deleted.
      if (result.ok) router.refresh();
    });

  if (stage === "done") {
    return (
      <p className={styles.done} role="status">
        {t("done")}
      </p>
    );
  }

  if (stage === "ask") {
    return (
      <button type="button" className={`${styles.delete} display`} onClick={() => setStage("confirm")}>
        {t("delete")}
      </button>
    );
  }

  return (
    <div className={styles.confirmBox} role="group" aria-labelledby="confirm-question">
      <p id="confirm-question" className={styles.question}>
        {t("confirm")}
      </p>
      {stage === "error" && (
        <p className={styles.error} role="alert">
          {t("error")}
        </p>
      )}
      <div className={styles.confirmActions}>
        <button type="button" className={styles.yes} onClick={confirm} disabled={pending} aria-busy={pending}>
          {t("confirmYes")}
        </button>
        <button type="button" className={styles.no} onClick={() => setStage("ask")} disabled={pending}>
          {t("confirmNo")}
        </button>
      </div>
    </div>
  );
}
