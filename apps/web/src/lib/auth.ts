import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@lean-academy/db";
import { verifyCredentials } from "@/lib/credentials";
import { detectBrowserLocale } from "@/i18n/detect";

// Auth.js config. See docs/security.md: official OAuth/PKCE for Google
// and Facebook (never ask users for their provider password), password
// hashing for the email+password path, and the Account/Identity mapping
// documented in packages/db/prisma/schema.prisma.
//
// Credentials + a database adapter forces JWT sessions (Auth.js does not
// support database sessions for the Credentials provider).

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Google's OIDC discovery document (https://accounts.google.com/.well-known/openid-configuration)
      // advertises authorization_response_iss_parameter_supported: true (RFC 9207), but its real
      // authorization redirect doesn't actually include an `iss` param -- oauth4webapi's response
      // validation takes the discovery doc at its word and throws "response parameter 'iss' (issuer)
      // missing" on every real callback. Supplying these three endpoints explicitly skips OIDC
      // discovery entirely (see @auth/core's callback/signin handlers: discovery only runs when
      // token/userinfo URLs are absent), which is the standard workaround for this class of
      // discovery-vs-actual-response mismatch. These are Google's own long-stable OAuth2 endpoints
      // (unchanged for years), not something Google is expected to rotate.
      authorization: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      token: { url: "https://oauth2.googleapis.com/token" },
      userinfo: { url: "https://openidconnect.googleapis.com/v1/userinfo" },
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (rawCredentials) => verifyCredentials(rawCredentials),
    }),
  ],
  events: {
    // A brand-new OAuth user (Google/Facebook) is created by the adapter,
    // not by /api/auth/register, so this is where they get the language
    // they were already browsing in — the same cookie-then-header choice
    // register uses for email+password signups.
    async createUser({ user }) {
      if (!user.id) return;
      const { cookie, header } = await detectBrowserLocale();
      const locale = cookie ?? header;
      if (locale) {
        await prisma.user.update({ where: { id: user.id }, data: { locale } });
      }
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.locale = typeof token.locale === "string" ? token.locale : null;
      }
      return session;
    },
    // Session invalidation on password reset (docs/security.md), without a
    // server-side session store: reset-password stamps
    // User.passwordChangedAt, and this rejects any token whose `iat`
    // predates it. `session` is only present on a fresh sign-in, when a
    // just-issued token can't yet be stale by definition — skip the check
    // there both to save the query and to avoid a chicken-and-egg lockout
    // right after a reset-then-log-back-in. Every other invocation (Auth.js
    // re-runs this callback, DB read included, on every `auth()` call — see
    // @auth/core's "session" action) reads the real current value, so a
    // stale session is cleared on its very next request after a reset, not
    // merely on its next expiry.
    async jwt({ token, trigger, user: signedInUser }) {
      if (trigger === "signIn" || trigger === "signUp") {
        // The saved UI language rides along in the token (see
        // src/i18n/locale.ts). A just-created OAuth user's row may not
        // have had createUser's locale stamp applied yet when `user` was
        // read, so fall back to what the browser is asking for.
        const { cookie, header } = await detectBrowserLocale();
        token.locale = signedInUser?.locale ?? cookie ?? header ?? null;
        return token;
      }
      if (!token.sub || typeof token.iat !== "number") return token;

      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { passwordChangedAt: true },
      });
      if (
        user?.passwordChangedAt &&
        token.iat * 1000 < user.passwordChangedAt.getTime()
      ) {
        return null;
      }
      return token;
    },
  },
});
