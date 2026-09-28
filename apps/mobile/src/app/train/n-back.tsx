import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NBACK_DEFAULT_INITIAL_DIFFICULTY, NBACK_MAX_DIFFICULTY, NBACK_MIN_DIFFICULTY } from "@lean-academy/cognitive-engine";
import { useAuth } from "@/lib/auth-context";
import { ApiError, apiFetch, type ExerciseOutcome } from "@/lib/api";
import { radius, useTheme } from "@/lib/theme";
import { NBackExercise } from "@/components/NBackExercise";
import { PrimaryButton } from "@/components/PrimaryButton";

type Outcome = ExerciseOutcome & { accuracy: number };

// Runs one N-Back exercise, then persists it through the exact same
// three calls the web's TrainingSessionRunner makes — start a
// TrainingSession, post the exercise's Trials (which advances
// DifficultyState and runs achievements/XP/challenge/quest sync), then
// complete the session (streak + session XP). Nothing is scored or
// stored on the device alone, so the web sees this run immediately.
// If saving fails (no connection), the finished run stays in memory
// and can be retried; it isn't silently dropped.

interface SaveProgress {
  sessionId?: string;
  exercisePosted?: boolean;
}

// Resumable: `progress` records each step that already succeeded, so a
// retry after a dropped connection continues from there instead of
// creating a second TrainingSession or posting the same Trials twice.
async function saveRun(token: string, outcome: Outcome, durationSeconds: number, progress: SaveProgress) {
  if (!progress.sessionId) {
    const { id } = await apiFetch<{ id: string }>("/api/training-sessions", { token, method: "POST" });
    progress.sessionId = id;
  }
  const id = progress.sessionId;
  if (!progress.exercisePosted) {
    const { method, startDifficulty, endDifficulty, trials } = outcome;
    await apiFetch(`/api/training-sessions/${id}/exercises`, {
      token,
      method: "POST",
      body: { method, startDifficulty, endDifficulty, trials },
    });
    progress.exercisePosted = true;
  }
  await apiFetch(`/api/training-sessions/${id}/complete`, {
    token,
    method: "POST",
    body: { totalDurationSeconds: durationSeconds },
  });
}

function clampLevel(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n)) return NBACK_DEFAULT_INITIAL_DIFFICULTY;
  return Math.min(NBACK_MAX_DIFFICULTY, Math.max(NBACK_MIN_DIFFICULTY, n));
}

export default function NBackScreen() {
  const colors = useTheme();
  const { token } = useAuth();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const [startedAt] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "failed">("saving");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveProgress = useRef<SaveProgress>({});

  async function persist(result: Outcome, seconds: number) {
    if (!token) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveRun(token, result, seconds, saveProgress.current);
      setSaveState("saved");
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof ApiError ? e.message : "Couldn't save this run.");
    }
  }

  function handleComplete(result: Outcome) {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    setOutcome(result);
    setDurationSeconds(seconds);
    if (result.endDifficulty > result.startDifficulty) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    persist(result, seconds);
  }

  if (!outcome) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <NBackExercise initialDifficulty={clampLevel(level)} onComplete={handleComplete} onExit={() => router.back()} />
      </SafeAreaView>
    );
  }

  const { startDifficulty, endDifficulty, trials } = outcome;
  const accuracyPct = Math.round(outcome.accuracy * 100);
  const scored = trials.filter((t) => !t.wasInterrupted).length;
  const interrupted = trials.length - scored;
  const note =
    endDifficulty > startDifficulty
      ? "You were consistently accurate, so the next run will be one step harder."
      : endDifficulty < startDifficulty
        ? "This level was a stretch, so the next run eases off by one step. That's the system working as intended."
        : `You stayed at a level that's challenging but manageable across ${scored} scored trials.`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.results} testID="results-screen">
        <View style={[styles.check, { backgroundColor: colors.successSoft }]}>
          <Text style={[styles.checkMark, { color: colors.success }]}>✓</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Exercise complete
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>N-Back</Text>

        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: colors.text3 }]}>Accuracy</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{accuracyPct}%</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: colors.text3 }]}>Level</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {startDifficulty} → {endDifficulty}
            </Text>
          </View>
        </View>

        <View style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.note, { color: colors.text2 }]}>{note}</Text>
          {interrupted > 0 ? (
            <Text style={[styles.note, styles.noteGap, { color: colors.text3 }]}>
              {interrupted} {interrupted === 1 ? "trial was" : "trials were"} interrupted (the app left the screen) and
              {interrupted === 1 ? " isn't" : " aren't"} counted toward your score.
            </Text>
          ) : null}
        </View>

        <View style={styles.flex} />

        <Text
          accessibilityLiveRegion="polite"
          style={[styles.saveLine, { color: saveState === "failed" ? colors.caution : colors.text3 }]}
        >
          {saveState === "saving"
            ? "Saving to your account…"
            : saveState === "saved"
              ? "Saved. It's in your progress on the web too."
              : `Not saved: ${saveError}`}
        </Text>
        {saveState === "failed" ? (
          <PrimaryButton label="Try saving again" onPress={() => persist(outcome, durationSeconds)} />
        ) : (
          <PrimaryButton label="Done" busy={saveState === "saving"} onPress={() => router.back()} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  results: { flex: 1, paddingHorizontal: 24, paddingVertical: 28 },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  checkMark: { fontSize: 26, fontWeight: "700" },
  title: { textAlign: "center", fontSize: 23, fontWeight: "700" },
  subtitle: { textAlign: "center", fontSize: 13.5, marginTop: 6, marginBottom: 26 },
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
  },
  statCol: { alignItems: "center" },
  statLabel: { fontSize: 11.5, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "700" },
  divider: { width: 1 },
  noteCard: { borderWidth: 1, borderRadius: radius.lg, padding: 18 },
  note: { fontSize: 13.5, lineHeight: 20 },
  noteGap: { marginTop: 10 },
  saveLine: { textAlign: "center", fontSize: 13, marginBottom: 12 },
});
