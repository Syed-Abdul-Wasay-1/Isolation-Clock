# Template 02 - Fix a bug

**Use when:** something is broken, a countdown looks wrong, the map misbehaves, or a number does not
match the docs.

**The most important line is the reproduction.** A vague bug report gets a vague patch.

---

```text
Context: Isolation Clock (see the project primer).

BUG
- What I see: <observed behaviour, with numbers>
- What I expected: <expected behaviour, with numbers>
- When it happens: <scenario level, which tab, which household, which screen>
- Steps to reproduce: <numbered, specific>

WHAT I ALREADY CHECKED
- <e.g. isolation_level for H001 is 14.94, and ETI at level 0 shows 1.5 h - that part is right>

SUSPECT AREA
<file(s), or "unknown - please locate it">

INSTRUCTIONS
1. State the root cause before proposing a fix. Do not guess at a patch.
2. Check the fix against the spec in docs/ (methodology.md, SCORING.md, ALLOCATION.md). If the code
   and the spec disagree, tell me which one looks wrong instead of silently picking one.
3. Give the minimal fix, then say what else could be affected by the same cause.
4. If the bug is actually a documentation error, say so and propose the doc edit instead.
```

---

## Common real causes on this repo

- The scenario level is a **percentile index 0-100**, not centimetres. "Water level" copy is wrong.
- `isolation_level` can be `null` (no modelled route) - current data has none, but code must not
  crash if one appears.
- Missing vulnerability fields must add **zero** points, never points, and only lower confidence.
- Rank shown inside a tab is the position **within that tab**, not the global rank.
- Shelter assignment uses **straight-line** distance, so the map line can cross buildings.

## Then

Add the entry to [`../prompts.md`](../prompts.md). Bug entries are the most valuable ones to log.
