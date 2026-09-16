/**
 * Backward Digit Span — a near-transfer *assessment*, not a trainable
 * exercise (docs/kanban.md's "Near-transfer assessment: Backward Digit
 * Span" card). Deliberately NOT built on RollingWindowAdaptiveEngine:
 * project_prompt.txt's TRAINING VS ASSESSMENT distinction calls for
 * "less frequent measurement" via a standard psychometric procedure,
 * not adaptive practice — so this implements the classic ascending
 * span-staircase method directly: increase span length by one on a
 * correct trial, retry once at the same span on a single failure, and
 * stop after two consecutive failures at one span length.
 *
 * This is an original implementation of the general backward-span
 * paradigm, not a reproduction of the WAIS/WISC Digit Span clinical
 * subtest — out of scope permanently per docs/evidence-review.md's
 * excluded-domains list. Sequences are freshly randomized every run
 * from an injectable `random`, rather than drawn from a fixed,
 * standardized item list — the same "original task, not the clinical
 * subtest" framing already used for verbal-sequencing-v0 in
 * docs/evidence-review.md §4. Real near-transfer evidence for this
 * specific structure (trained WM tasks transferring to backward-span-
 * shaped measures) is documented in docs/evidence-review.md §3/§11
 * (Melby-Lervåg, Redick & Hulme, 2016).
 */

const DIGIT_POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const BACKWARD_DIGIT_SPAN_MIN = 2;
export const BACKWARD_DIGIT_SPAN_MAX = 9;
export const BACKWARD_DIGIT_SPAN_START = 3;

export interface BackwardDigitSpanConfig {
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export interface BackwardDigitSpanTrialOutcome {
  span: number;
  presentedDigits: number[];
  expectedResponse: number[];
  correct: boolean;
  isComplete: boolean;
}

export interface BackwardDigitSpanScore {
  /** The last span length the user recalled correctly (0 if none). */
  finalSpan: number;
  totalCorrect: number;
  totalTrials: number;
  /**
   * Correct/attempted at the terminal span level only — the pair this
   * assessment's confidence interval should be computed over (see
   * packages/psychometrics's calculateProportionConfidenceInterval
   * docstring, which anticipates exactly this use).
   */
  finalSpanCorrect: number;
  finalSpanTrials: number;
}

export class BackwardDigitSpanAssessment {
  private readonly random: () => number;

  private span = BACKWARD_DIGIT_SPAN_START;
  private failureStreakAtSpan = 0;
  private trialsAtCurrentSpan = 0;
  private correctAtCurrentSpan = 0;
  private totalTrials = 0;
  private totalCorrect = 0;
  private lastSuccessfulSpan = 0;
  private complete = false;
  private currentSequence: number[] | null = null;

  constructor(config: BackwardDigitSpanConfig = {}) {
    this.random = config.random ?? Math.random;
  }

  getCurrentSpan(): number {
    return this.span;
  }

  isComplete(): boolean {
    return this.complete;
  }

  /** Generates and holds the next sequence to present, at the current span length. */
  nextTrialDigits(): number[] {
    if (this.complete) {
      throw new Error("nextTrialDigits called after the assessment is already complete");
    }
    if (this.currentSequence) {
      throw new Error("nextTrialDigits called before submitRecall() for the previous trial");
    }
    const unused = [...DIGIT_POOL];
    const sequence: number[] = [];
    for (let i = 0; i < this.span; i++) {
      const index = Math.floor(this.random() * unused.length);
      sequence.push(unused[index]);
      unused.splice(index, 1);
    }
    this.currentSequence = sequence;
    return sequence;
  }

  /**
   * Scores backward recall — the expected response is the presented
   * sequence in reverse order — and advances the staircase.
   */
  submitRecall(userDigits: number[]): BackwardDigitSpanTrialOutcome {
    if (this.complete) {
      throw new Error("submitRecall called after the assessment is already complete");
    }
    if (!this.currentSequence) {
      throw new Error("submitRecall called before nextTrialDigits()");
    }

    const presented = this.currentSequence;
    const expectedResponse = [...presented].reverse();
    const correct =
      userDigits.length === expectedResponse.length &&
      userDigits.every((d, i) => d === expectedResponse[i]);
    const span = this.span;

    this.currentSequence = null;
    this.totalTrials += 1;
    this.trialsAtCurrentSpan += 1;
    if (correct) {
      this.totalCorrect += 1;
      this.correctAtCurrentSpan += 1;
    }

    if (correct) {
      this.lastSuccessfulSpan = span;
      this.failureStreakAtSpan = 0;
      if (span >= BACKWARD_DIGIT_SPAN_MAX) {
        this.complete = true; // ceiling reached
      } else {
        this.span = span + 1;
        this.trialsAtCurrentSpan = 0;
        this.correctAtCurrentSpan = 0;
      }
    } else {
      this.failureStreakAtSpan += 1;
      if (this.failureStreakAtSpan >= 2) {
        this.complete = true; // floor reached: two consecutive failures at this span
      }
      // else: stays at the same span for one retry — trialsAtCurrentSpan/
      // correctAtCurrentSpan already carry both attempts if the retry fails too.
    }

    return { span, presentedDigits: presented, expectedResponse, correct, isComplete: this.complete };
  }

  /** Final score — only valid once isComplete() is true. */
  getScore(): BackwardDigitSpanScore {
    if (!this.complete) {
      throw new Error("getScore called before the assessment is complete");
    }
    return {
      finalSpan: this.lastSuccessfulSpan,
      totalCorrect: this.totalCorrect,
      totalTrials: this.totalTrials,
      finalSpanCorrect: this.correctAtCurrentSpan,
      finalSpanTrials: this.trialsAtCurrentSpan,
    };
  }
}
