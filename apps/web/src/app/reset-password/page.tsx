import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { email, token } = (await searchParams) as {
    email?: string;
    token?: string;
  };

  if (!email || !token) {
    const t = await getTranslations("auth.reset");
    return (
      <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-6 py-7 text-center">
        <div className="mb-2 font-display text-[22px] font-bold text-text">
          {t("invalidTitle")}
        </div>
        <p className="mb-7 text-[14px] text-text-2">
          {t("invalidBody")}
        </p>
        <Link
          href="/forgot-password"
          className="rounded-full bg-accent px-8 py-3.5 font-body text-[15px] font-bold text-on-accent"
        >
          {t("requestNew")}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <ResetPasswordForm email={email} token={token} />
    </main>
  );
}
