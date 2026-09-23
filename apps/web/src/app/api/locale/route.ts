import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/config";

const schema = z.object({ locale: z.enum(LOCALES) });

// Saves a language-switcher choice: always as the NEXT_LOCALE cookie
// (works signed out, and wins on this device — see src/i18n/locale.ts),
// and on the User row too when signed in, so it follows the account to
// other devices and transactional emails go out in it.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported locale." }, { status: 400 });
  }
  const { locale } = parsed.data;

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
