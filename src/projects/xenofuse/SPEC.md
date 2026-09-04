# Xenofuse

> Defuse a captured alien bomb by cracking its code before the timer hits zero.

Status: **draft spec — not yet built**. This document describes the design; no game code exists yet.

## 1. Pitch

You've salvaged a live alien explosive device. Its detonation code is hidden behind the aliens'
own number/letter/symbol system. A shared countdown ticks for the whole device. Work through
each panel in order, using the clues etched into the casing to decipher the code, and enter it
before time runs out.

## 2. Theme & fantasy

- Salvaged, humming alien hardware — angular casing, glowing glyphic readouts, a terminal/HUD feel.
- The device is unfamiliar but not random: it has an internal logic (its own alphabet, its own
  number base, its own patterns) that the player learns to read over the course of a session.
- Tension comes from a single shared timer that never pauses between panels — cracking panel 2
  costs you the time you'll wish you had on panel 3.

## 3. Core loop

1. A **bomb** spawns with **N sequential stages** (typically 2–4), and one shared countdown timer
   starts for the whole bomb.
2. Each stage shows an **alien code** (a string of symbols/digits/letters in the alien system) and
   **clue(s)** for that stage's puzzle type.
3. The player deciphers the code and submits an answer.
4. Correct → stage is disarmed, next stage's panel is revealed/activated; timer keeps running.
5. Incorrect → a penalty is applied (time deduction and/or a strike), player may retry.
6. **Win**: all stages disarmed before time expires.
   **Lose**: timer reaches zero, or (if strikes are enabled) strikes run out.

## 4. Puzzle families

Stages rotate across three puzzle types so a bomb feels varied. Each type shares the same alien
glyph alphabet (Section 5) so the "alien-ness" is visually consistent even as the logic differs.

### 4.1 Substitution cipher
- The alien glyph set maps 1:1 to letters and/or digits (a cryptogram).
- Clues give a **partial mapping** (e.g. "⟁ = 7", "⌬ = E") or a short worked example
  ("⟁⌬⟁⟟ decodes to a known word/number"), enough to bootstrap the rest by deduction.
- Player fills in the remaining mapping to read off the code.

### 4.2 Base/number conversion
- Alien numerals use a **non-decimal counting system** (e.g. base-6 "Vex" numerals, one glyph per
  digit 0–5, plus place value left-to-right like normal positional notation).
- Clues teach the glyph→digit table and/or a worked conversion example.
- Player converts an alien numeral string into its base-10 defuse code.

### 4.3 Sequence/pattern logic
- A sequence of symbols or numbers follows a rule: constant step, alternating operation,
  positional mirroring/reversal, odd/even split, etc.
- Clues reveal part of the rule (a partial worked step, an annotated example, or a plain-language
  hint like "every other glyph doubles").
- Player deduces the missing/next value(s) that complete the code.

### 4.4 Difficulty scaling knobs (shared across all three)
- Size of the active glyph/number alphabet (fewer distinct symbols = easier).
- Number of unknowns the player must solve for.
- Clue sparsity (how much of the mapping/rule is given up front vs. must be inferred).
- Rule/cipher complexity (e.g. two-step arithmetic vs. one-step; base-4 vs. base-8).

## 5. Alien symbol set

- A fixed, reusable glyph alphabet — the game's "alien font" — used across all puzzle types so
  players build familiarity with it over multiple bombs.
- Needs roughly **20–36 distinct glyphs** to cover the alphabet/digits it stands in for.
- Visual style: angular/geometric marks (not organic letterforms), consistent stroke weight and
  sizing so glyphs read clearly at a glance and are easy to tell apart even under time pressure.
- Design goal: glyphs should look alien, not decorative-random — consistent style is what sells it.

## 6. Clue system

- Each stage has at least **one always-visible clue** sufficient (in principle) to solve it.
- Optionally, **1–2 additional clues** can be revealed on demand, each costing time (see Section 7)
  — a hint-for-time trade rather than a free lookup.
- Clue formats:
  - Partial mapping table (glyph → letter/digit, a few entries).
  - Worked mini-example (a short glyph string with its decoded value shown).
  - Plain-language rule hint (for sequence stages: "the pattern skips by two").

## 7. Timer & tension mechanics

- One countdown timer shared by the whole bomb (not per-stage).
- Wrong answer → time penalty (e.g. −10s) and/or a strike; exact values are tunable (open question,
  Section 12).
- Revealing an optional clue costs time (e.g. −15s), making hints a real trade-off, not free.
- Visual/audio escalation as time runs low (faster pulse, color shift toward red, urgency SFX).
- Optional stretch mechanic: a one-time "freeze" that stops the timer briefly at a steep time cost.

## 8. Stage/bomb structure & difficulty progression

- A bomb has **2–4 stages**, each using one of the three puzzle families; the mix is chosen so a
  bomb rarely repeats the same puzzle type twice in a row.
- As the player clears more bombs in a session, later bombs increase difficulty via the scaling
  knobs in 4.4 (bigger glyph alphabet, sparser clues, more unknowns) rather than by adding more
  stages — keeps individual bombs a bounded length.
- Mirrors the pattern in the existing **Gravity Well** project (`src/projects/gravity-well/`),
  which separates level *definitions* (`levels.ts`) from procedural *generation* (`levelGen.ts`).
  Xenofuse would likely follow the same split for bomb/stage generation.

## 9. Scoring & outcomes

- **Win**: score from time remaining, stages cleared without a wrong answer, and hints not used.
- **Loss**: bomb "detonates" — show the correct answers for review/learning, offer retry with a
  freshly generated bomb (not the same one, to avoid memorization).
- Replayability via **seeded/procedural generation**, following Gravity Well's `rng.ts` pattern —
  supports both endless random play and (optionally, later) shareable seeded challenges.

## 10. UI/UX sketch

- **Bomb casing view**: the overall device, with a row/track of stage indicators showing solved /
  active / locked panels.
- **Active panel**: the current alien code displayed prominently (large glyph string), the
  clue panel beside or below it, and an input area for the player's answer.
- **Clue panel**: always-visible clue shown by default; buttons to reveal optional clues (each
  shows its time cost before confirming).
- **Timer**: persistent, prominent countdown (e.g. top of screen), with escalating visual treatment
  as it nears zero.
- **Input**: a text/number entry for decimal answers; for glyph-based answers, consider an on-screen
  glyph picker so players aren't stuck typing symbols (ties into Section 12's mobile-input question).

## 11. Technical notes for future build (non-binding)

Anticipated module split, mirroring the existing Gravity Well project structure
(`src/projects/gravity-well/`: `GravityWell.tsx`, `physics.ts`, `levelGen.ts`, `levels.ts`,
`scoring.ts`, `rng.ts`):

- `Xenofuse.tsx` — main component / screen state machine (stage progression, timer, win/lose).
- `Xenofuse.css` — styling.
- `cipher.ts` — substitution-cipher generation & validation.
- `numerals.ts` — alien base/number-system conversion logic.
- `sequences.ts` — sequence/pattern-rule generation & validation.
- `bombGen.ts` — assembles a bomb: picks stage count, puzzle-type mix, difficulty knobs.
- `rng.ts` — seeded randomness; reuse Gravity Well's implementation if suitable rather than
  duplicating it.

This is a starting point for the build discussion, not a commitment — subject to change once
implementation begins.

## 12. Open questions for the user (resolve before build)

- Timer length defaults: how long per bomb, and does it scale with stage count/difficulty?
- Strike limit: is there a max-wrong-answers loss condition in addition to the timer, or is the
  timer the only fail state (with only a time penalty per wrong answer)?
- Hint cost: flat time cost per hint, or increasing cost for each hint used in the same stage?
- Symbol entry on mobile/touch: on-screen glyph picker, or type using a mapped keyboard?
- Art depth: flat/minimal glyph rendering (fast to build) vs. a more illustrated bomb casing and
  animated panels (more production work) — how much visual polish is in scope for v1?
