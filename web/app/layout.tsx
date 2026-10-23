import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { SourceTagCapture } from "@/components/SourceTagCapture/SourceTagCapture";
import { StagingBar } from "@/components/StagingBar/StagingBar";
import { withoutNotes } from "@/i18n/messages";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // Staging only (decisions log). Read at request time, so one build serves both.
  const isStaging = process.env.APP_ENV === "staging";

  return (
    <html lang={locale}>
      <head>
        <link rel="preload" href="/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link
          rel="preload"
          href="/fonts/source-serif-4-latin-opsz-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body>
        <NextIntlClientProvider messages={withoutNotes(await getMessages())}>
          {isStaging && <StagingBar />}
          <SourceTagCapture />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
