// Locale list and detection helpers. Deliberately zero-import (no Prisma,
// no next/headers), so "use client" components like LanguageSwitcher can
// import it directly without pulling server-only code into client JS
// (see CLAUDE.md's "use client" import gotcha).

export const LOCALES = ["en", "pl", "es", "de", "fr", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding an explicit choice made on this device via the switcher. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language's name written in that language, as switchers conventionally show it. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  "zh-CN": "简体中文",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Maps one BCP 47 tag to a supported locale, or null. Only Simplified
 * Chinese is translated, so explicitly Traditional tags (zh-TW, zh-HK,
 * zh-Hant) don't match — the next Accept-Language preference, or the
 * default, is a better guess than a script the user may not read.
 */
function matchTag(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("zh")) {
    if (/^zh-(tw|hk|mo)\b/.test(lower) || lower.startsWith("zh-hant")) return null;
    return "zh-CN";
  }
  const base = lower.split("-")[0];
  return LOCALES.find((l) => l === base) ?? null;
}

/** Picks the best supported locale from an Accept-Language header, honoring q-values. */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const match = matchTag(tag);
    if (match) return match;
  }
  return null;
}
