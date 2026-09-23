"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_NATIVE_NAMES, type Locale } from "@/i18n/config";

// A real <select> (not a custom dropdown) so keyboard and screen-reader
// support come for free — see accessibility.spec.ts. Each option shows
// its language's own name, so a user who landed in a language they don't
// read can still find theirs.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function handleChange(next: Locale) {
    setSaving(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } finally {
      setSaving(false);
    }
    startTransition(() => router.refresh());
  }

  return (
    <label className={`inline-flex items-center gap-2 text-[12.5px] font-semibold text-text-2 ${className}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        disabled={saving || pending}
        onChange={(e) => handleChange(e.target.value as Locale)}
        className="rounded-md border border-border bg-surface px-2 py-1.5 font-body text-[12.5px] font-semibold text-text focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        data-testid="language-switcher"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NATIVE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
