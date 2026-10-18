"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
