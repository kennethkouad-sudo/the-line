import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locales";
import styles from "./LanguageToggle.module.css";

/** EN/FR toggle. A plain form, so it works before JavaScript loads. */
export async function LanguageToggle() {
  const current = await getLocale();
  const t = await getTranslations("language");

  return (
    <form action={setLocale}>
      <div className={styles.toggle} role="group" aria-label={t("groupLabel")}>
        {locales.map((locale) => (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            lang={locale}
            aria-pressed={locale === current}
            className={styles.option}
          >
            <span className={styles.pill}>{locale.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </form>
  );
}
