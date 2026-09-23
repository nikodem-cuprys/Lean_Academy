import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace packages are consumed as TS source, not a pre-built dist/,
  // so Next has to transpile them itself in dev and at build time.
  transpilePackages: [
    "@lean-academy/db",
    "@lean-academy/evidence",
    "@lean-academy/design-system",
    "@lean-academy/shared",
    "@lean-academy/cognitive-engine",
    "@lean-academy/adaptive-engine",
    "@lean-academy/reading-engine",
    "@lean-academy/psychometrics",
  ],
};

export default withNextIntl(nextConfig);
