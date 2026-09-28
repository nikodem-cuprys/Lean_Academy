import { useColorScheme } from "react-native";
import { nativeColorTokens, type NativeColorPalette } from "@lean-academy/design-system";

// Same palette as apps/web and prototype/Styleguide.dc.html, converted
// from packages/design-system's oklch tokens (RN can't parse oklch()).
// Follows the system light/dark setting, like the web app.
export function useTheme(): NativeColorPalette {
  return useColorScheme() === "dark" ? nativeColorTokens.dark : nativeColorTokens.light;
}

export const radius = { sm: 10, md: 16, lg: 24, full: 999 } as const;
