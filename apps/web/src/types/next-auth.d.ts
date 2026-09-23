import type { DefaultSession } from "next-auth";

// User.locale (packages/db's schema) carried through the session JWT (as
// an untyped token field, read back with a typeof check in lib/auth.ts), so
// src/i18n/locale.ts can pick a signed-in user's saved language on a
// device that has no NEXT_LOCALE cookie yet — without a DB read.
declare module "next-auth" {
  interface User {
    locale?: string | null;
  }
  interface Session {
    user: { locale?: string | null } & DefaultSession["user"];
  }
}

