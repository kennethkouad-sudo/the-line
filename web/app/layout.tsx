import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SourceTagCapture } from "@/components/SourceTagCapture/SourceTagCapture";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

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
        <SourceTagCapture />
        {children}
      </body>
    </html>
  );
}
