import nodemailer from "nodemailer";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

// Real SMTP delivery — never a console.log stand-in (see docs/kanban.md's
// "nothing here should be faked" acceptance criterion). Locally this
// points at maildev (`pnpm dev:mail`, a real SMTP server + web UI at
// http://localhost:1080 — see CLAUDE.md); in production it points at a
// real transactional-email provider's SMTP endpoint via the same env
// vars, so the sending code never has to change.
function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error(
      "SMTP_HOST is not set. Run `pnpm dev:mail` (maildev) locally and set SMTP_HOST=localhost / SMTP_PORT=1025 in .env, or configure a real SMTP provider."
    );
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });
}

async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? "LeanAcademy <noreply@leanacademy.local>";
  await transport.sendMail({ from, ...options });
}

// `locale` is the recipient's own language (their saved User.locale),
// not necessarily the language of whatever request triggered the send.
function emailLocale(locale: string | null | undefined) {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export async function sendVerificationEmail(email: string, rawToken: string, locale?: string | null) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/verify-email?email=${encodeURIComponent(email)}&token=${rawToken}`;
  const t = await getTranslations({ locale: emailLocale(locale), namespace: "emails.verify" });

  await sendMail({
    to: email,
    subject: t("subject"),
    text: t("text", { url }),
    html: `
      <p>${t("welcome")}</p>
      <p><a href="${url}">${t("confirmLink")}</a>${t("confirmRest")}</p>
      <p>${t("expiry")}</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, rawToken: string, locale?: string | null) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;
  const t = await getTranslations({ locale: emailLocale(locale), namespace: "emails.reset" });

  await sendMail({
    to: email,
    subject: t("subject"),
    text: t("text", { url }),
    html: `
      <p>${t("intro")}</p>
      <p><a href="${url}">${t("link")}</a></p>
      <p>${t("expiry")}</p>
    `,
  });
}
