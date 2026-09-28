import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { NBackTask, type NBackStimulus } from "@lean-academy/cognitive-engine";
import type { ExerciseOutcome, TrialInput } from "@/lib/api";
import { radius, useTheme } from "@/lib/theme";

// Native port of apps/web/src/components/NBackExercise.tsx. The task
// logic (stimulus generation, scoring, adaptive difficulty) is the
// shared NBackTask from packages/cognitive-engine, unchanged; only the
// timing loop and UI are rebuilt for touch:
// - the response registers on press-*in*, not release, so reaction time
//   isn't inflated by how long the finger stays down;
// - interruptions come from AppState (a call, the notification shade,
//   switching apps) instead of the browser's visibilitychange;
// - haptics confirm the tap and signal correct/incorrect;
// - each trial's metadata records the device, per docs/mobile-plan.md,
//   so cross-device reaction-time variance can be analysed rather than
//   silently mixed with web data.
//
// Only the studied STANDARD pace (2500 ms) is offered here — the web's
// optional pace presets are a presentation choice without the same
// research backing, and aren't ported in this first slice.

const TOTAL_TRIALS = 20;
const STIMULUS_MS = 2500;
const FEEDBACK_MS = 650;
const GRID_CELLS = 9;

const DEVICE_CONTEXT = {
  client: "mobile-app",
  platform: Platform.OS,
  osVersion: String(Platform.Version),
  ...(Platform.OS === "android"
    ? {
        deviceModel: (Platform.constants as { Model?: string }).Model,
        deviceBrand: (Platform.constants as { Brand?: string }).Brand,
      }
    : {}),
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

export function NBackExercise({
  initialDifficulty,
  onComplete,
  onExit,
}: {
  initialDifficulty: number;
  onComplete: (outcome: ExerciseOutcome & { accuracy: number }) => void;
  onExit: () => void;
}) {
  const colors = useTheme();
  const [phase, setPhase] = useState<"stimulus" | "feedback">("stimulus");
  const [stimulus, setStimulus] = useState<NBackStimulus | null>(null);
  const [currentN, setCurrentN] = useState(initialDifficulty);
  const [trialNumber, setTrialNumber] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);

  const respondRef = useRef<((said: boolean) => void) | null>(null);
  const activeRef = useRef(AppState.currentState === "active");
  const interruptedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      activeRef.current = state === "active";
      if (state !== "active") interruptedRef.current = true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const task = new NBackTask({ initialDifficulty });
    const startDifficulty = task.getCurrentDifficulty();
    const offsetMs = Date.now() - performance.now();
    const toEpoch = (perfMs: number) => Math.round(offsetMs + perfMs);
    const trials: TrialInput[] = [];

    async function run() {
      setCurrentN(task.getCurrentN());
      for (let i = 0; i < TOTAL_TRIALS; i++) {
        if (controller.signal.aborted) return;

        const stim = task.nextStimulus();
        const difficultyAtTrial = task.getCurrentN();
        setStimulus(stim);
        setTrialNumber(i + 1);
        setFeedback(null);
        setPhase("stimulus");

        interruptedRef.current = !activeRef.current;
        const stimulusStartedAt = performance.now();
        let userSaidMatch = false;
        let reactionTimeMs: number | undefined;

        await new Promise<void>((resolveWait) => {
          let settled = false;
          const finish = (said: boolean) => {
            if (settled) return;
            settled = true;
            userSaidMatch = said;
            if (said) reactionTimeMs = performance.now() - stimulusStartedAt;
            respondRef.current = null;
            clearTimeout(timer);
            resolveWait();
          };
          respondRef.current = finish;
          const timer = setTimeout(() => finish(false), STIMULUS_MS);
          controller.signal.addEventListener("abort", () => finish(false), { once: true });
        });

        if (controller.signal.aborted) return;
        const interrupted = interruptedRef.current;

        if (!interrupted) {
          const outcome = task.recordResponse(userSaidMatch, { timestamp: performance.now(), reactionTimeMs });
          if (outcome.scored) {
            setFeedback({ correct: outcome.correct });
            setCurrentN(task.getCurrentN());
            Haptics.notificationAsync(
              outcome.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});
            trials.push({
              correct: outcome.correct,
              reactionTimeMs,
              stimulusStartedAtMs: toEpoch(stimulusStartedAt),
              respondedAtMs: toEpoch(performance.now()),
              wasInterrupted: false,
              difficultyAtTrial,
              metadata: { position: stim.position, classification: outcome.classification, ...DEVICE_CONTEXT },
            });
          }
        } else if (stim.isScoreable) {
          // Interrupted trials are excluded from scoring but still
          // recorded (flagged), per docs/product-requirements.md's
          // timing-integrity requirement — visible, not deleted.
          trials.push({
            correct: false,
            stimulusStartedAtMs: toEpoch(stimulusStartedAt),
            wasInterrupted: true,
            difficultyAtTrial,
            metadata: { position: stim.position, interrupted: true, ...DEVICE_CONTEXT },
          });
        }

        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      onComplete({
        method: "adaptive-nback-v0",
        startDifficulty,
        endDifficulty: task.getCurrentDifficulty(),
        trials,
        accuracy: task.calculatePerformance().accuracy,
      });
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn() {
    if (!respondRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    respondRef.current(true);
  }

  const instruction =
    stimulus && !stimulus.isScoreable
      ? "Memorize the positions"
      : `Tap when the square matches ${currentN} ${currentN === 1 ? "step" : "steps"} back`;

  return (
    <View style={styles.container} testID="n-back-exercise">
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit exercise" onPress={onExit} hitSlop={14}>
          <Text style={[styles.exit, { color: colors.text3 }]}>✕</Text>
        </Pressable>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface2 }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.workingMemory, width: `${(trialNumber / TOTAL_TRIALS) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.exitSpacer} />
      </View>
      <Text style={[styles.trialCount, { color: colors.text3 }]}>
        Trial {trialNumber} of {TOTAL_TRIALS}
      </Text>

      <View style={styles.tagRow}>
        <View style={[styles.dot, { backgroundColor: colors.workingMemory }]} />
        <Text style={[styles.tag, { color: colors.workingMemory }]}>N-BACK · {currentN}-BACK</Text>
      </View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.instruction, { color: colors.text }]}>
        {instruction}
      </Text>

      <View style={styles.gridArea}>
        <View style={styles.grid} accessibilityLabel="3 by 3 grid">
          {Array.from({ length: GRID_CELLS }, (_, i) => {
            const active = phase === "stimulus" && stimulus?.position === i;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  active
                    ? { backgroundColor: colors.workingMemory, borderColor: colors.workingMemory }
                    : { backgroundColor: colors.surface2, borderColor: colors.border },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.respondArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Match"
          testID="respond-button"
          onPressIn={handlePressIn}
          disabled={phase !== "stimulus"}
          style={({ pressed }) => [
            styles.respond,
            { backgroundColor: feedback?.correct ? colors.success : colors.workingMemory },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <Text style={[styles.respondLabel, { color: colors.onAccent }]}>
            {feedback ? (feedback.correct ? "Got it" : "Missed") : "Match"}
          </Text>
        </Pressable>
        <Text style={[styles.feedbackLine, { color: feedback?.correct ? colors.success : colors.text3 }]}>
          {feedback?.correct
            ? "Correct"
            : phase === "feedback" && stimulus && !stimulus.isScoreable
              ? "Not scored yet"
              : " "}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  exit: { fontSize: 20, width: 24 },
  exitSpacer: { width: 24 },
  progressTrack: { flex: 1, height: 4, borderRadius: radius.full, marginHorizontal: 16, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.full },
  trialCount: { textAlign: "center", fontSize: 12, marginBottom: 24 },
  tagRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tag: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.5 },
  instruction: { textAlign: "center", fontSize: 19, fontWeight: "700", minHeight: 52, paddingHorizontal: 12 },
  gridArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { width: 270, flexDirection: "row", flexWrap: "wrap", gap: 14 },
  cell: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 1.5 },
  respondArea: { alignItems: "center", paddingBottom: 12 },
  respond: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  respondLabel: { fontSize: 15, fontWeight: "700" },
  feedbackLine: { height: 20, marginTop: 12, fontSize: 13, fontWeight: "700" },
});
