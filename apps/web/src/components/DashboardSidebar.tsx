import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Desktop-only left nav (see apps/web/src/app/page.tsx's responsive
// rebuild) — adapted from prototype/HomeDesktop.dc.html's sidebar, with
// one honest correction: the mockup's "Profile" item doesn't correspond
// to any real route in this app (no /profile page exists, checked), so
// it's replaced with the real screens that actually exist —
// Achievements, Quests & Challenges, and Customize exercises — rather
// than linking to a page that isn't there. No theme toggle either: the
// real app follows system preference only (see CLAUDE.md's Design
// tokens section), unlike the prototype's own per-screen review toggle.
//
// A standalone component (not folded into page.tsx) because
// prototype/ExerciseDesktop.dc.html and prototype/ProgressDesktop.dc.html
// show the same sidebar shell on other screens — this is scoped to the
// Home dashboard for now (that's what was asked for), but built so a
// future Progress/Exercise desktop pass can reuse it directly instead
// of re-deriving the same nav.

const HOME_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const CHART_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const FLASK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 3h6v4l3 8a2 2 0 01-1.9 2.7H7.9A2 2 0 016 14.9L9 7V3z" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const TROPHY_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);
const TARGET_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const SETTINGS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M19.4 13.5a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19.5a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4.5a2 2 0 110-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4.5a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1h.09a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const SLIDERS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const NAV_ITEMS = [
  { href: "/", labelKey: "home", icon: HOME_ICON },
  { href: "/progress", labelKey: "progress", icon: CHART_ICON },
  { href: "/science", labelKey: "science", icon: FLASK_ICON },
  { href: "/achievements", labelKey: "achievements", icon: TROPHY_ICON },
  { href: "/challenges", labelKey: "challenges", icon: TARGET_ICON },
  { href: "/advanced", labelKey: "advanced", icon: SLIDERS_ICON },
  { href: "/settings/exercises", labelKey: "customize", icon: SETTINGS_ICON },
] as const;

export function DashboardSidebar({ active }: { active: string }) {
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("main")}
      className="flex w-[232px] flex-shrink-0 flex-col border-r border-border px-4 py-6"
    >
      <div className="mb-8 px-2.5 font-display text-lg font-bold text-text">LeanAcademy</div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold"
                style={
                  isActive
                    ? { background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
                    : { color: "var(--color-text-2)" }
                }
              >
                {item.icon}
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <LanguageSwitcher className="mt-auto px-2.5 pt-6" />
    </nav>
  );
}
