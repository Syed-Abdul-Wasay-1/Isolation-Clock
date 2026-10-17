---
name: Isolation Clock Model
description: Use when changing or reasoning about the isolation/ETI model, priority scoring, confidence, ranking order, resource matching, or household status. Covers the units, formulas, invariants and the docs that must stay in sync.
---

# Isolation Clock - simulation model

The whole product rests on one idea: rank households by **time until isolation**, not by current
flood depth. If you change anything on this page, check the matching doc in `docs/`
(`methodology.md`, `SCORING.md`, `ALLOCATION.md`, `SIMULATION.md`) in the same change.

## Units that are easy to get wrong

- **Scenario level is a unitless 0-100 relative exposure index. It is not water depth.** Never call
  it "cm", "metres" or "water level" in UI copy or comments.
- **`threshold`** on a road edge is that same 0-100 index. The road is treated as **closed** when
  `scenarioLevel >= threshold`.
- **`isolation_level`** is the highest scenario level at which the household still has a route to a
  shelter or hospital. It is a **widest-path (maximin)** value: the maximum, over routes, of the
  route's **lowest** edge threshold. It is not a shortest-path distance.
- **`rise_rate_default`** (10) is index points per hour and is illustrative, not measured.

## The formulas

```ts
// householdStatus.ts
etiHours = max(0, (isolation_level - scenarioLevel) / riseRateDefault)
status   = scenarioLevel >= isolation_level ? 'isolated'
         : etiHours <= 3                      ? 'urgent'
         : 'safe'
// isolation_level === null -> status 'unknown', etiHours null
```

```ts
// priorityScore.ts
urgency = status === 'isolated' ? 35
        : etiHours === null     ? 0
        : 35 * (1 - min(etiHours, 6) / 6)

total = clamp(urgency + vulnerability, 0, 100)
// vulnerability: age65Plus 12, mobilityLimitation 12, livesAlone 10, medicalNeed 10, noPhone 6
// practical maximum is 85, not 100

confidence = max(0, 1 - 0.2 * missingVulnerabilityFields)
```

## Invariants - do not break these

1. **Missing data never earns points.** A null `age_band` adds 0 vulnerability points and only lowers
   confidence. It must never be treated as "vulnerable".
2. **Confidence is separate from the score.** It must not multiply or reorder the ranking.
3. **Ranking order** is: score desc, then ETI asc (`null` = Infinity), then fewer missing fields,
   then household id. See `compareHouseholdPriority`.
4. **Ranks in the UI are per tab.** The rescue tab and the evacuate tab each number from #1.
5. **Everything recedes nowhere.** Once `scenarioLevel >= isolation_level`, raising the level keeps it
   isolated; lowering it re-opens the route. The status is a pure function of `scenarioLevel`.
6. **`null` isolation_level is not treated as isolated.** It becomes `unknown` and lands in the
   evacuate tab. Current data has no nulls, but code paths exist.

## Resource matching (`resourceMatching.ts`)

- Greedy, priority-first. **Not** an optimal matching; earlier households consume beds.
- Queue 1: `status === 'isolated'` -> boats. Queue 2: everyone else -> vehicles.
- One household per boat/vehicle, bounded by passenger capacity (boat 6, vehicle 5).
- Safe-place choice: nearest of **all** reachable safe places (shelters **and** hospitals) with enough
  **remaining** beds, by **straight-line Haversine** distance — not routed, not travel time. Ties
  break on the safe place id.
- Beds consumed = household size. Missing size -> assume 4 and flag it. Missing capacity -> assume 40
  and flag it.
- **Hospitals are allocatable.** The isolation model already routes a household to whichever safe
  place it can reach, so `matchResources` receives shelters and hospitals; ignoring hospitals made the
  allocation contradict the ranking. `SafePlace.kind` ('shelter' | 'hospital') is stamped at load time
  by `validateStudyData`. Medical-need households get **no** hospital priority — that is a policy call,
  not a model detail. Do not add one without saying so.

## Where the code lives

| Concern | File |
|---|---|
| ETI + status + formatting | `src/simulation/householdStatus.ts` |
| Score, confidence, comparator | `src/simulation/priorityScore.ts` |
| SMS overrides + ranked order | `src/simulation/smsOverrides.ts` |
| SMS check-in / road-block types | `src/simulation/smsCheckins.ts` |
| Boats / vehicles / beds | `src/simulation/resourceMatching.ts` |
| Bottleneck-road grouping | `src/simulation/roadImpact.ts` |
| Hour-by-hour escalation | `src/simulation/escalation.ts` |
| Household / people counts | `src/simulation/population.ts` |
| Straight-line distance | `src/simulation/geo.ts` |
| Composition + playback + tab split | `src/pages/IsolationClockPage.tsx` |
| Tests | `tests/householdStatus.test.ts`, `tests/priorityScore.test.ts`, `tests/resourceMatching.test.ts`, `tests/smsCheckins.test.ts`, `tests/roadImpact.test.ts`, `tests/escalation.test.ts`, `tests/studyDataValidation.test.ts` |
| Spec | `docs/methodology.md`, `docs/SCORING.md`, `docs/ALLOCATION.md`, `docs/SIMULATION.md`, `docs/SMS.md` |

## Workflow for a change here

1. Read the matching doc first; it is the spec, and it wins unless you only bump values.
2. Change the function in `src/simulation/` and the doc together.
3. Update or add a case in `tests/` so the formula stays pinned.
4. Keep the numbers visible in the UI if you add or change a weight - the tool's selling point is
   that a coordinator can see *why*.
5. Verify:

```bash
npx tsc -b      # typecheck
npx oxlint      # lint
npm run build   # production build
npm test        # model test suite (node:test)
```

## Known simplifications worth stating out loud

- Sensitivity bands and offline snapshots were **never built**; the docs no longer claim them.
- `floor_level`, `last_contact_hours` and `data_completeness` are displayed but do **not** affect the
  score or confidence.
- The score screen shows "/ 100" while the practical maximum is 95 (urgency 35 + vulnerability 60).
- A reported road closure **cannot** be re-simulated in the browser — the app ships road geometry and
  thresholds, not the graph. It is an impact preview against the precomputed `bottleneck_road`.
