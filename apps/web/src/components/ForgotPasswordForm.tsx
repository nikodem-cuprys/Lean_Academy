"use client";

import { useState, type FormEvent } from "react";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-3 font-body text-[14.5px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always shown, regardless of the response — see the route's
      // comment on why it never reveals whether the account exists.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center px-6 py-7 text-center">
        <div className="mb-2 font-display text-[22px] font-bold text-text">
          Check your email
        </div>
        <p className="text-[14px] text-text-2">
          If an account exists for <strong className="text-text">{email}</strong>,
          we&rsquo;ve sent a link to reset your password. It expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-9 font-display text-lg font-bold text-text">
        LeanAcademy
      </div>
      <div className="mb-1.5 font-display text-[23px] font-bold text-text">
        Reset your password
      </div>
      <div className="mb-7 text-[13.5px] text-text-2">
        Enter your email and we&rsquo;ll send you a link to reset it.
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          className={inputClass}
          placeholder="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-accent py-3.5 font-body text-[15px] font-bold text-on-accent disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
