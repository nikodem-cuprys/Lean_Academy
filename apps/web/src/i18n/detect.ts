import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, matchAcceptLanguage, type Locale } from "./config";

/**
 * The locale this request's browser asks for — the NEXT_LOCALE cookie,
 * else Accept-Language — without consulting the session. Split out from
 * locale.ts so lib/auth.ts can use it (e.g. to stamp a brand-new OAuth
 * user's locale) without a circular import back through auth().
 */
export async function detectBrowserLocale(): Promise<{ cookie: Locale | null; header: Locale | null }> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  return {
    cookie: isLocale(cookieValue) ? cookieValue : null,
    header: matchAcceptLanguage((await headers()).get("accept-language")),
  };
}
