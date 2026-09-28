import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { ApiError, apiFetch, type HomeData } from "@/lib/api";
import { radius, useTheme } from "@/lib/theme";
import { PrimaryButton } from "@/components/PrimaryButton";

// Reads /api/mobile/me — the same Streak/XP/DifficultyState rows the
// web's Home reads — and refetches every time this screen regains
// focus, so finishing an exercise (here or on the web) shows up on
// return without a manual refresh.
export default function HomeScreen() {
  const colors = useTheme();
  const { token, signOut } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await apiFetch<HomeData>("/api/mobile/me", { token }));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Expired, or invalidated by a password reset on the web.
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : "Couldn't load your progress.");
    }
  }, [token, signOut]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (token === undefined) return <Centered color={colors.accent} />;
  if (token === null) return <Redirect href="/login" />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = data?.user.name?.split(" ")[0];
  const nBackLevel = data?.nBack?.currentDifficulty ?? 2;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={[styles.greeting, { color: colors.text }]}>
            {firstName ? `Hi, ${firstName}` : "Welcome back"}
          </Text>
          <Pressable accessibilityRole="button" onPress={signOut} hitSlop={12}>
            <Text style={[styles.link, { color: colors.text2 }]}>Sign out</Text>
          </Pressable>
        </View>

        {error ? (
          <Card>
            <Text style={[styles.body, { color: colors.caution }]}>{error}</Text>
            <View style={styles.gap} />
            <PrimaryButton label="Try again" onPress={load} />
          </Card>
        ) : null}

        {!data && !error ? <ActivityIndicator style={styles.loading} color={colors.accent} /> : null}

        {data ? (
          <>
            <View style={styles.statsRow}>
              <Card style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.text3 }]}>Streak</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {data.streak ? `${data.streak.currentStreakDays} ${data.streak.currentStreakDays === 1 ? "day" : "days"}` : "—"}
                </Text>
                <Text style={[styles.statHint, { color: colors.text3 }]}>
                  {data.streak?.trainedToday ? "Trained today" : "Not trained today"}
                </Text>
              </Card>
              <Card style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.text3 }]}>Training Level</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{data.trainingLevel.level}</Text>
                <View style={[styles.xpTrack, { backgroundColor: colors.surface2 }]}>
                  <View
                    style={[
                      styles.xpFill,
                      {
                        backgroundColor: colors.accent,
                        width: `${Math.min(100, (data.trainingLevel.xpIntoLevel / Math.max(1, data.trainingLevel.xpForNextLevel)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </Card>
            </View>

            {data.onboarded ? (
              <Card>
                <View style={styles.tagRow}>
                  <View style={[styles.dot, { backgroundColor: colors.workingMemory }]} />
                  <Text style={[styles.tag, { color: colors.workingMemory }]}>WORKING MEMORY</Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>N-Back</Text>
                <Text style={[styles.body, { color: colors.text2 }]}>
                  You're currently at {nBackLevel}-back. About 1 minute, 20 trials. Difficulty adjusts to how you do,
                  and picks up where you left off on the web.
                </Text>
                <View style={styles.gap} />
                <PrimaryButton
                  label="Start N-Back"
                  color={colors.workingMemory}
                  onPress={() => router.push({ pathname: "/train/n-back", params: { level: String(nBackLevel) } })}
                />
              </Card>
            ) : (
              <Card>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Finish setting up on the web</Text>
                <Text style={[styles.body, { color: colors.text2 }]}>
                  Your starting levels come from the short calibration in onboarding. Complete it on the web once, and
                  your training will be ready here too.
                </Text>
              </Card>
            )}

            <Text style={[styles.footnote, { color: colors.text3 }]}>
              More exercises, reading training and full progress are on the web for now.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

function Centered({ color }: { color: string }) {
  return (
    <View style={[styles.flex, styles.center]}>
      <ActivityIndicator color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  container: { padding: 20, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  greeting: { fontSize: 24, fontWeight: "700" },
  link: { fontSize: 14, fontWeight: "600" },
  loading: { marginTop: 40 },
  statsRow: { flexDirection: "row", gap: 14 },
  stat: { flex: 1 },
  statLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statHint: { fontSize: 12, marginTop: 4 },
  xpTrack: { height: 6, borderRadius: radius.full, marginTop: 10, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: radius.full },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 18 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tag: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  cardTitle: { fontSize: 19, fontWeight: "700", marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
  gap: { height: 16 },
  footnote: { fontSize: 12.5, textAlign: "center", marginTop: 6 },
});
