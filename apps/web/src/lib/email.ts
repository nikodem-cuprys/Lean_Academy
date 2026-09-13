import nodemailer from "nodemailer";

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

export async function sendVerificationEmail(email: string, rawToken: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/verify-email?email=${encodeURIComponent(email)}&token=${rawToken}`;

  await sendMail({
    to: email,
    subject: "Verify your LeanAcademy email",
    text: `Confirm your email address: ${url}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to LeanAcademy.</p>
      <p><a href="${url}">Confirm your email address</a> to finish setting up your account.</p>
      <p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, rawToken: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;

  await sendMail({
    to: email,
    subject: "Reset your LeanAcademy password",
    text: `Reset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `
      <p>We received a request to reset your LeanAcademy password.</p>
      <p><a href="${url}">Choose a new password</a>.</p>
      <p>This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password won't change.</p>
    `,
  });
}
