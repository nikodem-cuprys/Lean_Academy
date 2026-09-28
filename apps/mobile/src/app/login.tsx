import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { API_URL, ApiError } from "@/lib/api";
import { radius, useTheme } from "@/lib/theme";
import { PrimaryButton } from "@/components/PrimaryButton";

// Email+password only for now — Google/Facebook on Android need their
// own native OAuth client IDs (see docs/mobile-plan.md), and account
// creation still happens on the web, so a new user's onboarding and
// calibration run there first.
export default function LoginScreen() {
  const colors = useTheme();
  const { token, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Welcome back
          </Text>
          <Text style={[styles.subtitle, { color: colors.text2 }]}>
            Sign in with the same account you use on the web.
          </Text>

          <Text style={[styles.label, { color: colors.text2 }]}>Email</Text>
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
            placeholderTextColor={colors.text3}
            placeholder="you@example.com"
          />

          <Text style={[styles.label, { color: colors.text2 }]}>Password</Text>
          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            accessibilityLabel="Password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.caution }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.spacer} />
          <PrimaryButton
            label="Sign in"
            onPress={submit}
            busy={busy}
            disabled={!email || password.length < 8}
          />
          <Text style={[styles.footnote, { color: colors.text3 }]}>
            New here? Create your account and set up your training on the web first.
          </Text>
          {__DEV__ ? <Text style={[styles.footnote, { color: colors.text3 }]}>Server: {API_URL}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14.5, lineHeight: 21, marginBottom: 32 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 18,
  },
  error: { fontSize: 13.5, marginBottom: 8 },
  spacer: { height: 8 },
  footnote: { fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 16 },
});
