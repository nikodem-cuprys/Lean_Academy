# Evidence Review

_Last reviewed: 2026-09-13. This document is the narrative companion to [`data/evidence-registry.json`](../data/evidence-registry.json), which is the machine-readable source the production exercise catalog actually reads from. If you change one, update the other._

## How to read this document

For each candidate training method we record:

- **What it is** — the paradigm, in plain terms.
- **Evidence quality** — rated on the scale below.
- **Trained-task improvement / near transfer / far transfer** — kept strictly separate per the project's scientific-honesty rule. See `docs/product-requirements.md` for why this separation is non-negotiable.
- **Studied population**
- **Limitations**
- **Citations**
- **Production decision** — approved for the catalog, or not (and why).

### Evidence scale

| Level | Meaning |
|---|---|
| Strong | Several high-quality studies/reviews with reasonably consistent results. |
| Moderate | Credible positive evidence exists, but effects may be modest or inconsistent. |
| Limited | Evidence exists but has substantial uncertainty. |
| Experimental | Interesting research exists but efficacy has not been established. |
| Unsupported | Do not use as cognitive training. |

### Ground rule that shaped every decision below

The single most load-bearing finding across this entire field, repeated by every meta-analysis we reviewed, is: **training reliably improves the trained task and closely related (near-transfer) tasks; it does not reliably produce far transfer to general intelligence, IQ, or unrelated everyday outcomes.** This is not a niche finding — it's the field's consensus, summarized clearly in Simons et al. (2016)'s review for the Association for Psychological Science and reaffirmed by newer meta-analyses through 2025. Every module below, and every piece of progress copy the product ever shows, has to respect that distinction. See `SCIENTIFIC PROGRESS LANGUAGE` in `project_prompt.txt` and the "Scientific Honesty" rules it sets out.

---

## 1. Working-memory updating — Adaptive N-Back

**What it is:** The user sees a stream of stimuli (positions, letters, sounds) and must indicate whenever the current stimulus matches the one from _N_ steps back. _N_ adapts to performance (dual n-back, single n-back variants).

**Evidence quality: Moderate.** A 2017 multi-level meta-analysis (Soveri et al.) and the definitive Melby-Lervåg, Redick & Hulme (2016) meta-analytic review both find consistent trained-task and near-transfer gains, but no convincing far transfer to fluid intelligence or general ability. A 2024 second-order meta-analysis (Syed et al., covering only RCT-based reviews) reaches the same conclusion. Simons et al. (2016)'s broad review of the commercial brain-training industry reached an even more skeptical bottom line on real-world benefit.

- **Trained-task improvement:** Supported.
- **Near transfer:** Moderate — improves other n-back variants and structurally similar WM tasks.
- **Far transfer:** Not established.
- **Population:** Primarily healthy young adults; some older-adult studies show similar patterns (and a comprehensive 2019 meta-analysis found no enhancement of older adults' broader cognitive skills specifically).
- **Limitations:** Many source studies lack double-blind design or pre-registration; near-transfer outcome measures are sometimes structurally close enough to the trained task to inflate apparent effects.
- **Citations:**
  - Soveri, Antfolk, Karlsson, Salo & Laine (2017). *Working memory training revisited: A multi-level meta-analysis of n-back training studies.* Psychonomic Bulletin & Review. https://link.springer.com/article/10.3758/s13423-016-1217-0
  - Melby-Lervåg, Redick & Hulme (2016). *Working Memory Training Does Not Improve Performance on Measures of Intelligence or Other Measures of "Far Transfer".* Perspectives on Psychological Science. https://journals.sagepub.com/doi/10.1177/1745691616635612
  - Simons, Boot, Charness, Gathercole, Chabris, Hambrick & Stine-Morrow (2016). *Do "Brain-Training" Programs Work?* Psychological Science in the Public Interest, 17(3), 103–186. https://journals.sagepub.com/doi/abs/10.1177/1529100616661983

**Production decision: Approved.** Registry id `adaptive-nback-v0`. Flagship WM-updating exercise. Copy may claim improvement on this and similar tasks; must never claim intelligence or everyday-functioning gains.

## 2. Working-memory updating — Running Memory / Keep-Track

**What it is:** A continuous stream of items requires the user to keep updating and reporting the most recent _k_ items, or to track category-specific items (keep-track paradigm), exercising the same updating mechanism as n-back from a different angle.

**Evidence quality: Limited.** This paradigm shares its theoretical mechanism with n-back updating and inherits support from that broader literature, but has meaningfully fewer dedicated training RCTs of its own, and task parameters are not standardized across the field.

**Production decision: Approved**, but positioned as a secondary updating-practice variant (registry id `running-memory-keep-track-v0`), not as independently validated to the same degree as n-back.

## 3. Working-memory span — Complex Span (operation-span-inspired)

**What it is:** Users alternate between a simple processing step (e.g. verifying a simple equation) and remembering a growing sequence of to-be-recalled items — the classic complex-span structure, without reproducing any protected clinical instrument (e.g. we do not reproduce OSPAN or WAIS subtests; this is an original implementation of the open paradigm).

**Evidence quality: Moderate.** Melby-Lervåg & Hulme's meta-analyses find substantial near transfer specifically when trained and untrained tasks share a serial-recall / complex-span / backward-span structure, but no reliable far transfer to reasoning, intelligence, or Stroop-type measures.

**Production decision: Approved.** Registry id `complex-span-v0`.

## 4. Verbal working memory — Letter/Digit Sequencing & Reordering

**What it is:** Users hold and mentally reorder sequences of letters or digits (e.g. sort ascending, or report in reverse order). Treated as a verbal-domain instance of the complex-span/serial-recall literature above rather than a separately validated paradigm.

**Evidence quality: Moderate** (inherited from the complex-span/serial-recall literature). **Production decision: Approved.** Registry id `verbal-sequencing-v0`. Note: this is an original task, not a reproduction of the Digit Span clinical subtest.

## 5. Visuospatial working memory — Spatial Sequence Recall (Corsi-inspired)

**What it is:** Users watch and then reproduce a sequence of spatial locations lighting up on a grid/board — the well-established Corsi block-tapping paradigm, reimplemented as an original digital task (not the clinical Corsi instrument itself, which remains a standard neuropsychological tool).

**Evidence quality: Moderate.** The Corsi paradigm is one of the most established visuospatial WM measures in the literature. Training studies (including a 2025 ADHD study using adaptive dual n-back) show near-transfer gains on related spatial-span outcomes, with far transfer remaining inconsistent — the same pattern seen across the whole WM-training literature.

- **Citations:**
  - PMC11305427 (2024), *Inter-individual variability... in a digital Corsi task.* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11305427/
  - PMC12468938 (2025), *Boosting Working Memory in ADHD: Adaptive Dual N-Back Training Enhances WAIS-IV Performance, but Yields Mixed Corsi Outcomes.* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12468938/

**Production decision: Approved.** Registry id `visuospatial-sequence-recall-v0`.

## 6. Cognitive control — Flanker / Go-No-Go Interference Training

**What it is:** Users respond to a target while ignoring conflicting flanking stimuli (Flanker), or must withhold responses to rare no-go stimuli (Go-No-Go) — classic interference-control and response-inhibition paradigms.

**Evidence quality: Limited.** A 2023 RCT found limited evidence of transfer even to nearby tasks following online inhibition training. Separately, a well-cited validity study found that Flanker/Simon/spatial-Stroop interference scores have inadequate concurrent and convergent validity as individual-differences measures — meaning even measuring "cognitive control ability" reliably with these tasks is contested, let alone training it.

- **Citations:**
  - PMC10637678 (2023), *Can cognitive training capitalise on near transfer effects? Limited evidence of transfer following online inhibition training in a randomised-controlled trial.* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10637678/
  - Rey-Mermet et al., *Interference scores have inadequate concurrent and convergent validity: Should we stop using the flanker, Simon, and spatial Stroop tasks?* Cognitive Research: Principles and Implications. https://link.springer.com/article/10.1186/s41235-020-0207-y

**Production decision: NOT approved for MVP.** Registry id `inhibition-flanker-gonogo-v0`, `productionApproved: false`. Evidence for transfer is too thin, and the underlying measurement validity is itself contested — shipping this risks implying a "focus/attention improvement" claim the literature doesn't support. Revisit in a later phase only with a strictly within-task, no-transfer-implied framing, per the spec's "only include when evidence justifies the intended claim" rule for cognitive-control tasks. Stop-Signal and task-switching paradigms were reviewed alongside Flanker/Go-No-Go and share the same limited-transfer profile — not separately catalogued as their own modules for the same reason.

## 7. Memory strategy — Method of Loci (Memory Palace)

**What it is:** Users learn to encode list/sequence material by mentally placing items along a familiar spatial route ("memory palace") and retrieving them by mentally walking the route.

**Evidence quality: Moderate**, with an important nuance. A 2025 systematic review and meta-analysis (British Journal of Psychology) found a large, consistent effect on immediate and durable serial/free recall versus rehearsal — including in participants who had never used the technique before — but rated the underlying evidence quality as **low-to-very-low** due to risk-of-bias issues in the source studies. The direction and size of the effect is unusually consistent for this field; the rigor of individual studies is the caveat.

- **Trained-task improvement:** Supported — large effect vs. rehearsal, including in mnemonics-naive users.
- **Near transfer:** Supported for other list/sequence recall tasks compatible with spatial-imagery encoding.
- **Far transfer:** Not established for memory tasks that don't suit spatial/imagery encoding (e.g. abstract fact recall).
- **Citation:** Ondřej et al. (2025). *The method of loci in the context of psychological research: A systematic review and meta-analysis.* British Journal of Psychology. https://bpspsychub.onlinelibrary.wiley.com/doi/full/10.1111/bjop.12799

**Production decision: Approved.** Registry id `memory-strategy-method-of-loci-v0`. This is the spec's "evidence-supported memory strategy" category — framed explicitly as *teaching a real technique*, not as a passive memory-boosting drill.

## 8. Reading efficiency — Paced / Adaptive Reading

**What it is:** A visual pace guide gradually increases reading speed while the user reads normally; comprehension questions follow every passage; pace only increases while comprehension holds.

**Evidence quality: Moderate**, and it comes with the field's most important constraint: **speed and comprehension trade off, and the gains are real but modest, not dramatic.** A 2023 RCT (Klimovich et al., Journal of Research in Reading) found paced-reading + metacognitive training produced a real but modest ~35 WPM gain with no comprehension cost — not a doubling of speed, which is what most commercial "speed reading" claims imply and what the research does not support.

The hard physiological constraint behind this: the **perceptual span** — the region of text from which a reader extracts usable information per fixation — is normally about 3–4 letters to the left and 14–15 letters to the right of fixation (Rayner, Slattery & Bélanger, 2011). This bounds how much speed can plausibly increase without either skipping information or sacrificing comprehension. Faster readers do have somewhat larger perceptual spans than slower readers, which is consistent with *training* being able to move this metric somewhat — just not without limit.

**Comprehension floor for the Reading Efficiency Score: 0.70.** This is a distinct question from the Klimovich RCT above — that study establishes the realistic *size* of a comprehension-preserving WPM gain, not a specific pass/fail comprehension threshold. For the threshold itself, this review adopts Betts' (1946) Informal Reading Inventory criteria for "instructional level" reading: roughly 95% word-recognition accuracy paired with roughly 70% comprehension is the long-established convention in reading-assessment literature for the boundary below which a reader is considered to be struggling with a text ("frustration level"), rather than reading it adequately. It's a much older and more basic convention than the speed-reading RCT literature above, but it's the right kind of source for this specific number — a comprehension pass/fail line — and it keeps the floor from being picked arbitrarily. Implemented in `packages/reading-engine/src/reading-efficiency-score.ts`.

- **Citations:**
  - Klimovich et al. (2023). *Does speed-reading training work, and if so, why?* Journal of Research in Reading. https://onlinelibrary.wiley.com/doi/full/10.1111/1467-9817.12417
  - Rayner, Slattery & Bélanger (2011). *Eye movements, the perceptual span, and reading speed.* Psychonomic Bulletin & Review. https://pmc.ncbi.nlm.nih.gov/articles/PMC3075059/
  - Betts, E. A. (1946). *Foundations of Reading Instruction.* American Book Company. (Origin of the Informal Reading Inventory's instructional/frustration-level criteria; summarized in reading-education secondary sources, e.g. https://study.com/learn/lesson/informal-reading-inventory-test-uses.html)

**Production decision: Approved — the flagship reading module.** Registry id `reading-paced-adaptive-v0`. Every WPM figure the product ever shows must be paired with a comprehension figure; see the Reading Efficiency Score formula in `docs/product-requirements.md`.

## 9. Reading efficiency — Text Chunking Practice

**What it is:** Practice processing meaningful multi-word groups instead of treating every word as an isolated fixation target — presented as a technique within paced-reading training, not a standalone claim.

**Evidence quality: Limited.** There are few dedicated RCTs isolating chunking practice as its own intervention; support is largely inferred from the perceptual-span and eye-movement literature above rather than direct chunking-training outcome studies.

**Production decision: Approved as a supplementary technique**, registry id `reading-chunking-v0` — but copy must explicitly state this does not eliminate normal eye movements or fixations (per the spec's explicit instruction not to overclaim here).

## 10. Reading "speed" — Single-Word RSVP ("flash word") Reading

**What it is:** Words are flashed one at a time in a fixed location (as popularized by apps like Spritz), eliminating eye movements entirely, with vendors claiming 80%+ comprehension at 600+ WPM.

**Evidence quality: Unsupported at the WPM levels commonly marketed.** Research on the perceptual and cognitive "speed limits" of reading (PMC4835101) indicates comprehension degrades well before these speeds under controlled conditions, and the high-comprehension claims at very high WPM are vendor self-reports rather than independently replicated results. Removing eye movements also removes regressions — the re-fixations readers normally use to catch and correct comprehension errors — which is a plausible mechanism for why extreme RSVP speeds don't hold up under real testing.

**Production decision: Explicitly NOT approved.** Registry id `rsvp-single-word-v0`, `productionApproved: false`. This is precisely the "common speed-reading myth" the product brief instructs us not to implement just because it's popular.

## 11. Near-transfer assessment — Backward Digit Span

**What it is:** Phase 6's first near-transfer *assessment* (not a trainable exercise, and not gated through the production training catalog in `data/evidence-registry.json` — see `packages/evidence`'s catalog gate, which only governs trainable modules). A fixed ascending-span staircase: the user hears/sees a digit sequence and must report it in reverse order, with the sequence lengthening on success and the test stopping after two consecutive failures at one length — the standard psychometric span-testing method, not the rolling-window adaptive engine built for repeated practice (`project_prompt.txt`'s TRAINING VS ASSESSMENT distinction: assessment is "less frequent measurement," not adaptive training).

**Why this counts as a genuine near-transfer measure, not a repeat of the trained task:** it is a different task and form than the trained N-Back and Complex Span exercises (a fixed-procedure assessment vs. adaptive practice tasks), while sharing the backward-span structure that §3's Melby-Lervåg & Hulme meta-analytic finding already establishes real near-transfer for: "substantial near transfer specifically when trained and untrained tasks share a serial-recall / complex-span / backward-span structure." No new citation search was needed for this decision — it's the direct, intended use of that already-reviewed finding, not a new evidence claim.

**Explicitly not a reproduction of the WAIS/WISC Digit Span clinical subtest** — out of scope permanently per the excluded-domains list below. This is an original implementation of the general backward-span paradigm: sequences are freshly randomized on every run (`packages/cognitive-engine`'s `BackwardDigitSpanAssessment`) rather than drawn from a fixed, standardized item list, the same "original task, not the clinical instrument" framing already used for §4's `verbal-sequencing-v0`.

**Claim limits:** results are reported as a near-transfer working-memory-span measure only — never as IQ, general intelligence, or an everyday-memory claim. A score from a handful of staircase trials at one span length carries real uncertainty, which is why it is always shown with a real confidence interval (`packages/psychometrics`'s `calculateProportionConfidenceInterval`, computed over the terminal span level's own trials) rather than a bare number.

**Production decision:** Not a catalog module (no `data/evidence-registry.json` entry, no `productionApproved` flag) — it is an assessment surfaced from `/assessments/backward-digit-span` and linked from Progress's "Similar tasks" tab, not a trainable exercise in the catalog `packages/evidence` gates.

---

## Domains reviewed and deliberately excluded from this version

- **Stop-Signal Task, Task Switching** — reviewed alongside Flanker/Go-No-Go in section 6; same limited-transfer profile, same decision (not approved for MVP).
- **Extreme-speed RSVP / "read a novel in an hour" techniques** — see section 10.
- **Any task reproducing a protected clinical assessment verbatim** (e.g. WAIS/WISC Digit Span, standardized OSPAN) — out of scope permanently, not just for MVP; the product uses original implementations inspired by open paradigms instead (per `project_prompt.txt`'s explicit instruction).

## Next research pass (tracked, not yet done)

- Formal literature search on **task-switching training** as its own paradigm (currently bundled with the Flanker/Go-No-Go decision above; deserves its own dedicated pass before any Phase 3+ inclusion).
- Deeper dive on **skimming/scanning training** and **reading flexibility** (matching pace strategy to reading purpose) — the spec calls for these as reading-training candidates; initial search focused on paced/RSVP/chunking first since those carry the most myth-risk.
- Confirm whether any 2026 replications of the n-back/complex-span far-transfer null result have shifted the consensus (the "asymmetry of working memory training transfer" review surfaced in search results but wasn't deeply reviewed this pass).
