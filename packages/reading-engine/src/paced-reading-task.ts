import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type Difficulty,
  type PerformanceMetrics,
} from "@lean-academy/adaptive-engine";
import { READING_PASSAGES, type Passage } from "./passages";

/**
 * Paced / adaptive reading — the "reading-paced-adaptive-v0" module in
 * data/evidence-registry.json. A passage is shown with a visual pace
 * guide; the reader answers one comprehension question afterward.
 * "Comprehension holds" (the question answered correctly) is the
 * signal fed to the adaptive engine — matching project_prompt.txt's
 * "Difficulty adapts only when comprehension remains adequate," and
 * the same pattern NBackTask/ComplexSpanTask/SpatialSequenceTask use:
 * this class owns the difficulty -> real-parameter mapping (here,
 * target words-per-minute), the adaptive engine only moves an opaque
 * number.
 *
 * The WPM ladder's range (180-340) and starting point (220, a typical
 * comfortable adult silent-reading pace) are product defaults, not a
 * literature-derived figure the way the comprehension floor is — see
 * reading-efficiency-score.ts for that one.
 */

const WPM_LADDER = [180, 200, 220, 240, 260, 280, 300, 320, 340];

export const READING_MIN_DIFFICULTY = 1;
export const READING_MAX_DIFFICULTY = WPM_LADDER.length;
export const READING_DEFAULT_INITIAL_DIFFICULTY = 3; // 220 WPM

export interface ComprehensionAccuracy {
  correct: number;
  total: number;
}

export interface PassageResultInput {
  answeredCorrectly: boolean;
  /** performance.now()-based elapsed reading time for this passage. */
  elapsedMs: number;
  timestamp: number;
}

export interface PassageOutcome {
  correct: boolean;
  actualWpm: number;
  updatedDifficulty: Difficulty;
}

export interface PacedReadingTaskConfig {
  initialDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  maxDifficulty?: Difficulty;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export class PacedReadingTask {
  private readonly adaptiveEngine: RollingWindowAdaptiveEngine;
  private readonly random: () => number;

  private usedPassageIds: string[] = [];
  private currentPassage: Passage | null = null;
  private comprehensionTally: ComprehensionAccuracy = { correct: 0, total: 0 };
  private wpmSamples: number[] = [];

  constructor(config: PacedReadingTaskConfig = {}) {
    this.random = config.random ?? Math.random;
    this.adaptiveEngine = new RollingWindowAdaptiveEngine({
      initialDifficulty: config.initialDifficulty ?? READING_DEFAULT_INITIAL_DIFFICULTY,
      minDifficulty: config.minDifficulty ?? READING_MIN_DIFFICULTY,
      maxDifficulty: config.maxDifficulty ?? READING_MAX_DIFFICULTY,
      ...DEFAULT_ROLLING_WINDOW_CONFIG,
    });
  }

  getCurrentDifficulty(): Difficulty {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  /** Target WPM is difficulty mapped through the ladder — see file header. */
  getCurrentTargetWpm(): number {
    return WPM_LADDER[this.adaptiveEngine.getCurrentDifficulty() - 1];
  }

  calculatePerformance(): PerformanceMetrics {
    return this.adaptiveEngine.calculatePerformance();
  }

  getComprehensionAccuracy(): ComprehensionAccuracy {
    return { ...this.comprehensionTally };
  }

  /** Mean actual WPM (from recorded passage reading times), 0 if none yet. */
  getAverageWpm(): number {
    if (this.wpmSamples.length === 0) return 0;
    return this.wpmSamples.reduce((sum, wpm) => sum + wpm, 0) / this.wpmSamples.length;
  }

  /**
   * Returns the next passage to read, cycling through the pool without
   * repeats until every passage has been used once, then starting a
   * fresh cycle — same no-immediate-repeat convention as
   * ComplexSpanTask's letter pool.
   */
  nextPassage(): Passage {
    const unused = READING_PASSAGES.filter((p) => !this.usedPassageIds.includes(p.id));
    if (unused.length === 0) {
      this.usedPassageIds = [];
    }
    const pool = this.usedPassageIds.length === 0 ? READING_PASSAGES : unused;
    const passage = pool[Math.floor(this.random() * pool.length)];
    this.usedPassageIds.push(passage.id);
    this.currentPassage = passage;
    return passage;
  }

  /**
   * Scores the just-read passage's comprehension question, records the
   * outcome to the adaptive engine, and tallies actual reading speed.
   *
   * @param input.elapsedMs performance.now()-based reading duration
   *   supplied by the caller — this class does no timing of its own,
   *   same as NBackTask.recordResponse / ComplexSpanTask.submitRecall.
   */
  recordPassageResult(input: PassageResultInput): PassageOutcome {
    if (!this.currentPassage) {
      throw new Error("recordPassageResult called before any nextPassage()");
    }
    const actualWpm = input.elapsedMs > 0 ? (this.currentPassage.wordCount / input.elapsedMs) * 60_000 : 0;
    this.wpmSamples.push(actualWpm);
    this.comprehensionTally = {
      correct: this.comprehensionTally.correct + (input.answeredCorrectly ? 1 : 0),
      total: this.comprehensionTally.total + 1,
    };
    this.currentPassage = null;

    this.adaptiveEngine.recordTrial({ correct: input.answeredCorrectly, timestamp: input.timestamp });
    const updatedDifficulty = this.adaptiveEngine.recommendNextDifficulty();

    return { correct: input.answeredCorrectly, actualWpm, updatedDifficulty };
  }
}
