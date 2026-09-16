/**
 * Backward Spatial Span — the SPATIAL-domain twin of Backward Digit
 * Span (see backward-digit-span.ts's header comment for the full
 * rationale, which applies here unchanged): a near-transfer
 * *assessment*, not a trainable exercise, deliberately NOT built on
 * RollingWindowAdaptiveEngine. Implements the same fixed
 * ascending-span staircase directly: increase span length by one on a
 * correct trial, retry once at the same span on a single failure, and
 * stop after two consecutive failures at one span length.
 *
 * Genuinely distinct in task and form from the trained
 * visuospatial-sequence-recall-v0 exercise (SpatialSequenceTask),
 * which is *forward* recall — this is *backward* recall (the grid
 * positions must be tapped back in reverse order), the standard way
 * the Corsi block-tapping paradigm is varied to test span capacity
 * rather than just repeating the trained task with a new label. Not a
 * reproduction of the clinical Corsi Block-Tapping Test itself, which
 * remains a standard neuropsychological instrument (same "original
 * task, not the clinical instrument" framing docs/evidence-review.md
 * already uses for the trained spatial-sequence exercise and for
 * Backward Digit Span) — sequences are freshly randomized every run
 * from an injectable `random`. Real near-transfer evidence for
 * backward-span-shaped measures is documented in
 * docs/evidence-review.md §5/§11.
 *
 * Positions are indices into the same 3x3 grid (0-8) as
 * SpatialSequenceTask, capping the max span at the grid size (a
 * sequence can't revisit a cell without repeats, same no-repeat design
 * as Backward Digit Span's digit pool).
 */

const GRID_SIZE = 9;

export const BACKWARD_SPATIAL_SPAN_MIN = 2;
export const BACKWARD_SPATIAL_SPAN_MAX = GRID_SIZE;
export const BACKWARD_SPATIAL_SPAN_START = 3;

export interface BackwardSpatialSpanConfig {
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export interface BackwardSpatialSpanTrialOutcome {
  span: number;
  presentedPositions: number[];
  expectedResponse: number[];
  correct: boolean;
  isComplete: boolean;
}

export interface BackwardSpatialSpanScore {
  /** The last span length the user recalled correctly (0 if none). */
  finalSpan: number;
  totalCorrect: number;
  totalTrials: number;
  /**
   * Correct/attempted at the terminal span level only — the pair this
   * assessment's confidence interval should be computed over (see
   * packages/psychometrics's calculateProportionConfidenceInterval
   * docstring, and BackwardDigitSpanScore's identical field, which
   * anticipates exactly this use).
   */
  finalSpanCorrect: number;
  finalSpanTrials: number;
}

export class BackwardSpatialSpanAssessment {
  private readonly random: () => number;

  private span = BACKWARD_SPATIAL_SPAN_START;
  private failureStreakAtSpan = 0;
  private trialsAtCurrentSpan = 0;
  private correctAtCurrentSpan = 0;
  private totalTrials = 0;
  private totalCorrect = 0;
  private lastSuccessfulSpan = 0;
  private complete = false;
  private currentSequence: number[] | null = null;

  constructor(config: BackwardSpatialSpanConfig = {}) {
    this.random = config.random ?? Math.random;
  }

  getCurrentSpan(): number {
    return this.span;
  }

  isComplete(): boolean {
    return this.complete;
  }

  /** Generates and holds the next sequence of grid positions to present, at the current span length. */
  nextTrialPositions(): number[] {
    if (this.complete) {
      throw new Error("nextTrialPositions called after the assessment is already complete");
    }
    if (this.currentSequence) {
      throw new Error("nextTrialPositions called before submitRecall() for the previous trial");
    }
    const unused = Array.from({ length: GRID_SIZE }, (_, i) => i);
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
  submitRecall(userPositions: number[]): BackwardSpatialSpanTrialOutcome {
    if (this.complete) {
      throw new Error("submitRecall called after the assessment is already complete");
    }
    if (!this.currentSequence) {
      throw new Error("submitRecall called before nextTrialPositions()");
    }

    const presented = this.currentSequence;
    const expectedResponse = [...presented].reverse();
    const correct =
      userPositions.length === expectedResponse.length &&
      userPositions.every((p, i) => p === expectedResponse[i]);
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
      if (span >= BACKWARD_SPATIAL_SPAN_MAX) {
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

    return { span, presentedPositions: presented, expectedResponse, correct, isComplete: this.complete };
  }

  /** Final score — only valid once isComplete() is true. */
  getScore(): BackwardSpatialSpanScore {
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
