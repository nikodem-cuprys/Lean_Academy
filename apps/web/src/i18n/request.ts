import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "./locale";

// next-intl's per-request config (wired in via next.config.ts's
// createNextIntlPlugin). Messages live in src/messages/<locale>.json;
// en.json is the source every other file is translated from, and
// src/i18n/messages-parity.ts makes `tsc` fail if any locale's key set
// drifts from it.
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // No per-user timezone exists yet (see lib/streak.ts's UTC-day note),
    // so dates keep formatting in the server's own zone — what every
    // server-rendered toLocale*String call did before i18n — and pinning
    // it here keeps SSR and client hydration of the same date identical.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
});
