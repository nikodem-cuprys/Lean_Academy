// Compile-time check that every locale file has exactly en.json's key
// set — a missing or extra key fails `pnpm typecheck` instead of
// surfacing as a raw key string in the UI at runtime. Never imported at
// runtime; it exists only for tsc.
import en from "../messages/en.json";
import pl from "../messages/pl.json";
import es from "../messages/es.json";
import de from "../messages/de.json";
import fr from "../messages/fr.json";
import zhCN from "../messages/zh-CN.json";

type Messages = typeof en;

export const localeMessages = {
  en,
  pl: pl satisfies Messages,
  es: es satisfies Messages,
  de: de satisfies Messages,
  fr: fr satisfies Messages,
  "zh-CN": zhCN satisfies Messages,
};

// `satisfies` catches missing keys; this catches extra ones.
type NoExtraKeys<T, Base> = T extends object
  ? Base extends object
    ? { [K in keyof T]: K extends keyof Base ? NoExtraKeys<T[K], Base[K]> : never }
    : T
  : T;
export const noExtraKeys: {
  [L in keyof typeof localeMessages]: NoExtraKeys<(typeof localeMessages)[L], Messages>;
} = localeMessages;
