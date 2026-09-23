import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@lean-academy/db";
import { consumeVerificationToken } from "@/lib/tokens";

// No dedicated prototype screen exists for this one (prototype/ only
// covers the auth *form*, not its follow-on confirmation pages) — built
// to match the same tokens/typography as AuthForm.tsx rather than
// inventing a different visual language.
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { email, token } = (await searchParams) as {
    email?: string;
    token?: string;
  };

  const t = await getTranslations("auth.verify");
  const tc = await getTranslations("common");
  const result = !email || !token
    ? ({ ok: false, reason: "invalid" } as const)
    : await consumeVerificationToken(email, token);

  if (result.ok) {
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-6 py-7 text-center">
      <div className="mb-6 font-display text-lg font-bold text-text">
        LeanAcademy
      </div>

      {result.ok ? (
        <>
          <div className="mb-2 font-display text-[22px] font-bold text-text">
            {t("verified")}
          </div>
          <p className="mb-7 text-[14px] text-text-2">
            {t("verifiedBody")}
          </p>
        </>
      ) : (
        <>
          <div className="mb-2 font-display text-[22px] font-bold text-text">
            {result.reason === "expired"
              ? t("expiredTitle")
              : t("invalidTitle")}
          </div>
          <p className="mb-7 text-[14px] text-text-2">
            {result.reason === "expired"
              ? t("expiredBody")
              : t("invalidBody")}
          </p>
        </>
      )}

      <Link
        href="/login"
        className="rounded-full bg-accent px-8 py-3.5 font-body text-[15px] font-bold text-on-accent"
      >
        {tc("goToLogin")}
      </Link>
    </main>
  );
}
