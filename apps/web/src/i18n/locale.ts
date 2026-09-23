import { auth } from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { detectBrowserLocale } from "./detect";

/**
 * The locale for the current request, in priority order:
 *
 * 1. the NEXT_LOCALE cookie — an explicit choice made on this device via
 *    the language switcher;
 * 2. the signed-in user's saved User.locale (carried in the session JWT),
 *    so a choice made on one device follows the account to a new one;
 * 3. the browser's Accept-Language header;
 * 4. English.
 *
 * No locale-prefixed URLs (/pl/..., /de/...) — every route stays where it
 * is, so no link, redirect or e2e spec has to know about locales.
 */
export async function getRequestLocale(): Promise<Locale> {
  const { cookie, header } = await detectBrowserLocale();
  if (cookie) return cookie;

  const session = await auth();
  if (isLocale(session?.user?.locale)) return session.user.locale;

  return header ?? DEFAULT_LOCALE;
}
