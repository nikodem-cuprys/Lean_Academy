"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    // refetchOnWindowFocus (default true) attaches a visibilitychange
    // listener that fires an extra GET /api/auth/session whenever the
    // tab becomes visible. That can race signIn()'s own internal
    // getProviders()/getCsrfToken() calls — both hit Auth.js's shared
    // route handler, and under next dev's on-demand route compilation
    // (no such delay under next start) the two can resolve out of
    // order, leaving the client holding a CSRF token that no longer
    // matches the cookie a concurrent request just rotated. See
    // CLAUDE.md's "credentials sign-in can spuriously fail under next
    // dev" note — this is the fix for it. The UX cost (a stale session
    // in one tab isn't picked up when you refocus it) is minor enough
    // to accept for what it buys: sign-in is no longer racy.
    <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
  );
}
