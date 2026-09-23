import type en from "../messages/en.json";
import type { Locale } from "./config";

// Types every t("...") key against en.json, so a typo'd or removed key
// fails `pnpm typecheck` rather than rendering the raw key at runtime.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
