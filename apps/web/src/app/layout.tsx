import type { Metadata } from "next";
import { Sora, Manrope, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";

// latin-ext covers Polish (ą, ę, ł, ś, ż…) and the rarer French/Spanish/
// German glyphs. None of these families has CJK glyphs, so Simplified
// Chinese falls through to the platform's own CJK font via `fallback`
// (repeated inline per font — next/font only accepts literal options).

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  fallback: ["PingFang SC", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  fallback: ["PingFang SC", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-num",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  fallback: ["PingFang SC", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: "LeanAcademy",
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${sora.variable} ${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-body">
        {/* Inherits locale + messages from src/i18n/request.ts. */}
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
