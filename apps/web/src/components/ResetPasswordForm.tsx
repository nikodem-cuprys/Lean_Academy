"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-3 font-body text-[14.5px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent";

export function ResetPasswordForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const t = useTranslations("auth.reset");
  const tc = useTranslations("common");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : tc("somethingWentWrong"));
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center px-6 py-7 text-center">
        <div className="mb-2 font-display text-[22px] font-bold text-text">
          {t("updated")}
        </div>
        <p className="text-[14px] text-text-2">{t("redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-9 font-display text-lg font-bold text-text">
        LeanAcademy
      </div>
      <div className="mb-1.5 font-display text-[23px] font-bold text-text">
        {t("title")}
      </div>
      <div className="mb-7 text-[13.5px] text-text-2">
        {t("forEmail", { email })}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          className={inputClass}
          placeholder={t("newPassword")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className={inputClass}
          placeholder={t("confirmPassword")}
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
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
          className="mt-2 w-full rounded-full bg-accent py-3.5 font-body text-[15px] font-bold text-on-accent disabled:opacity-60"
        >
          {submitting ? t("saving") : t("save")}
        </button>
      </form>
    </div>
  );
}
