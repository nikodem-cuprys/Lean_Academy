"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Mode = "login" | "signup";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-3 font-body text-[14.5px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent";

/**
 * signIn() can spuriously fail under `next dev` (never seen under
 * `next start`) when some other Auth.js request elsewhere in the app —
 * typically a React Strict Mode double-invoked effect, dev-only — races
 * the CSRF cookie signIn() itself just fetched. See CLAUDE.md's
 * "credentials sign-in can spuriously fail under next dev" note. One
 * short-delayed retry resolves it; a genuine wrong-password failure
 * just fails the same way again, so this never masks a real error.
 */
async function signInWithCsrfRaceRetry(credentials: {
  email: string;
  password: string;
}) {
  const first = await signIn("credentials", { ...credentials, redirect: false });
  if (!first?.error) return first;
  await new Promise((resolve) => setTimeout(resolve, 250));
  return signIn("credentials", { ...credentials, redirect: false });
}

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    router.push(`/${next}`);
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setError(null);
    await signIn(provider, { redirectTo: "/" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (signup) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || undefined, email, password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(readableError(body) ?? tc("somethingWentWrong"));
          return;
        }
      }

      const result = await signInWithCsrfRaceRetry({ email, password });

      if (result?.error) {
        setError(
          signup
            ? t("autoSignInFailed")
            : t("incorrectCredentials")
        );
        return;
      }

      // A full page load, not router.push: signing in can change the UI
      // language (the account's saved User.locale — see src/i18n/locale.ts),
      // and a client-side navigation keeps the root layout — its
      // <html lang> and NextIntlClientProvider messages — from this
      // signed-out page, so client components would stay in the old
      // language until the next reload.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload is the point (see above)
      window.location.assign("/");
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-9 flex items-center justify-between gap-3">
        <div className="font-display text-lg font-bold text-text">LeanAcademy</div>
        <LanguageSwitcher />
      </div>

      <div className="mb-7 flex border-b border-border">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`flex-1 border-b-[2.5px] py-2.5 text-center font-body text-sm font-bold ${
            !signup
              ? "border-accent text-text"
              : "border-transparent text-text-3"
          }`}
        >
          {t("logIn")}
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`flex-1 border-b-[2.5px] py-2.5 text-center font-body text-sm font-bold ${
            signup
              ? "border-accent text-text"
              : "border-transparent text-text-3"
          }`}
        >
          {t("signUp")}
        </button>
      </div>

      <h1 className="mb-1.5 font-display text-[23px] font-bold text-text">
        {signup ? t("createTitle") : t("welcomeBack")}
      </h1>
      <div className="mb-7 text-[13.5px] text-text-2">
        {signup
          ? t("createSubtitle")
          : t("loginSubtitle")}
      </div>

      <div className="mb-5.5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-surface py-3.5 font-body text-[14.5px] font-semibold text-text"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.85-.08-1.66-.22-2.44H12v4.62h6.46c-.28 1.5-1.13 2.78-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.1C3.24 21.3 7.28 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.31A7.2 7.2 0 014.9 12c0-.8.14-1.58.38-2.31v-3.1H1.27A11.96 11.96 0 000 12c0 1.93.46 3.76 1.27 5.41l4.01-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.27 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z"
            />
          </svg>
          {t("continueGoogle")}
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("facebook")}
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-surface py-3.5 font-body text-[14.5px] font-semibold text-text"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#1877F2"
              d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"
            />
          </svg>
          {t("continueFacebook")}
        </button>
      </div>

      <div className="mb-5.5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="text-xs text-text-3">{t("or")}</div>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {signup && (
          <input
            className={inputClass}
            placeholder={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          className={inputClass}
          placeholder={tc("email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className={inputClass}
          placeholder={t("password")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={signup ? "new-password" : "current-password"}
        />

        {error && (
          <div
            role="alert"
            className="rounded-md bg-caution-soft px-3.5 py-2.5 text-[13px] font-medium text-caution"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-accent py-3.5 font-body text-[15px] font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting
            ? tc("pleaseWait")
            : signup
              ? t("createAccount")
              : t("logIn")}
        </button>
      </form>

      {!signup && (
        <Link
          href="/forgot-password"
          className="mt-4 block text-center text-[13px] font-semibold text-accent"
        >
          {t("forgotPassword")}
        </Link>
      )}

      <div className="mt-4.5 text-center text-xs leading-relaxed text-text-3">
        {t("terms")}
      </div>
    </div>
  );
}

// The API routes already translate their own messages (see
// src/app/api/auth/register/route.ts), so these are shown verbatim.
function readableError(body: unknown): string | null {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    (body as { error?: { fieldErrors?: Record<string, string[]> } }).error
      ?.fieldErrors
  ) {
    const fieldErrors = (
      body as { error: { fieldErrors: Record<string, string[]> } }
    ).error.fieldErrors;
    const firstMessage = Object.values(fieldErrors).flat()[0];
    if (firstMessage) return firstMessage;
  }
  return null;
}
