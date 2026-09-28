import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { radius, useTheme } from "@/lib/theme";

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  color,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  color?: string;
}) {
  const colors = useTheme();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color ?? colors.accent, opacity: inactive ? 0.6 : 1 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[styles.label, { color: colors.onAccent }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: { fontSize: 15, fontWeight: "700" },
});
