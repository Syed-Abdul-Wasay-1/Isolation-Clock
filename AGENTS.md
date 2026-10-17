# AGENTS.md — Isolation Clock

> **Read this file first, before touching any code.** It is loaded automatically at the start of every
> session and describes what this repo is, the rules you must not break, and how to verify your work.

---

## 1. What this project is

**Isolation Clock** — a frontend-only flood **scenario simulator** for Sukkur, Sindh, Pakistan, built
for the **CODE//CONNECT'26 Vibe Coding Hackathon** (Problem A — Disaster Response).

It does **not** rank by current flood depth. It ranks households by **time until isolation (ETI)**:
how long before every road out of a household is closed and it can no longer be reached by road.

- Households are **synthetic**. Buildings, roads and amenities come from real OpenStreetMap data.
- The scenario level is a **relative 0–100 exposure index, not water depth in cm or metres.**
- This is a **decision-support aid, not a forecast and not dispatch.**

## 2. Golden rules (never break these)

1. **Honesty framing.** Never imply the app is a flood forecast. Never call the scenario level
   "cm", "metres" or a water depth. Keep the phrase *"scenario simulator, not a forecast"*.
2. **Never claim a feature the code does not have.** In particular there is **no Web Worker**, **no
   offline snapshots / service worker**, and **no sensitivity band**. There is no `src/routing/` or
   `src/workers/` folder either — the placeholders were deleted, because routing runs offline in
   `scripts/`. If a doc says otherwise, fix the doc.
3. **Don't invent numbers.** Read every figure from `public/data/*.json` or the code.
4. **Change the model, then the docs.** If you change a weight, formula, file shape or unit, update
   the matching doc under `docs/` and say which one you changed.
5. **Log every substantive AI interaction** in `prompts/prompts.md` (see §7).
6. **The user owns git.** Never run `git commit`, `git push`, `git merge`, `git rebase` or any other
   history-changing command. Make your changes in the working tree and stop there — the user reviews
   and commits them.

## 3. Read order before you code

1. This file.
2. `TASKS.md` — what is left to do and who owns which part.
3. `prompts/context.md` — the one-page model primer (units, formulas, file shapes).
4. The spec that matches your task:
   - `docs/SIMULATION.md` — road thresholds / exposure index
   - `docs/SCORING.md` — priority score + confidence
   - `docs/ALLOCATION.md` — boat / vehicle / bed assignment
   - `docs/methodology.md` — ETI and ranking end to end
   - `docs/architecture.md` — components and data flow
4. The relevant skill under `.agents/skills/` (see §8).

## 4. Commands

```bash
npm install        # install once
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # tsc -b && vite build  -> dist/
npm run preview    # serve the production build
npm run lint       # oxlint
npm test           # type-check tests + run the node:test suite in tests/
```

- **Verification gate:** before you call a task done, run `npx tsc -b`, `npx oxlint`,
  `npm run build` and `npm test`. All four must pass. Report what you could not verify.
- **Tests** live in `tests/` and use Node's built-in runner (`node:test`, no dependencies). They cover
  everything in `src/simulation/` (ETI/status, priority scoring and confidence, resource matching, SMS
  overrides and the offline queue, bottleneck-road grouping, the escalation curve, household/people
  counting) plus the pure data validation in `src/hooks/studyDataValidation.ts`. Add a case there
  whenever you change the model.
  **Value imports between modules in `src/simulation/` must use an explicit `.ts` extension**, because
  the tests import those files directly with `node --test`. Type-only imports may omit it.
- **Data regeneration is optional** and needs Python (osmnx / networkx / geopandas). The generated
  JSON is committed, so the app runs without it. If you do regenerate, use the skill
  `.agents/skills/data-pipeline/` and leave the regenerated `public/data/*.json` in the working tree
  for the user to review and commit.

## 5. Architecture map

| Path | Responsibility |
|---|---|
| `scripts/generate_data.py` | Offline: OSM buildings/amenities → synthetic households, shelters, hospitals. |
| `scripts/build_isolation_clock.py` | Offline: elevation + water distance → exposure thresholds → widest-path isolation levels. |
| `public/data/*.json` | The five static files the app fetches: households, shelters, hospitals, roads, isolation (+ meta). |
| `src/hooks/useStudyData.ts` | Fetches the JSON; delegates validation to the pure `src/hooks/studyDataValidation.ts` and builds the isolation lookup. |
| `src/simulation/householdStatus.ts` | ETI + status (`safe` / `urgent` / `isolated` / `unknown`). |
| `src/simulation/priorityScore.ts` | Priority score, confidence, comparator. |
| `src/simulation/smsOverrides.ts` | Applies SMS overrides and returns the ranked order; applies message batches. |
| `src/simulation/smsCheckins.ts` | SMS override / check-in / road-block types and their pure helpers. |
| `src/simulation/resourceMatching.ts` | Greedy boat/vehicle/bed assignment across shelters and hospitals. |
| `src/simulation/roadImpact.ts` | Bottleneck-road grouping and nearest-road lookup. An impact preview — never a re-route. |
| `src/simulation/escalation.ts` | Household/people counts per hour ahead. |
| `src/simulation/population.ts` | Household and people counting. |
| `src/simulation/geo.ts` | Straight-line distance. |
| `src/components/` | `IsolationMap`, `RankingPanel`, `WhyRankPanel`, `ResourceAllocationPanel`, `EscalationCurvePanel`, `CriticalRoadsPanel`, `SmsCheckinPanel`, `BeforeAfterPanel`. |
| `src/pages/IsolationClockPage.tsx` | Page state, playback, focus, ranking composition. |

## 6. Model invariants (units and formulas)

Do not change these meanings without flagging it and updating the docs:

- **Scenario level**: unitless 0–100 relative exposure index. A road is closed when
  `scenarioLevel >= threshold`.
- **`isolation_level`** (per household, precomputed): the highest level at which a route to a safe
  place still exists — a **widest-path (maximin)** value, i.e. the maximum over routes of the route's
  lowest edge threshold. Not a shortest-path distance.
- **ETI hours** = `max(0, (isolation_level − scenarioLevel) / riseRateDefault)`, with
  `riseRateDefault = 10` (illustrative, not measured).
- **Status**: `isolated` when `scenarioLevel >= isolation_level`; `urgent` when ETI ≤ 3 h; else
  `safe`; `unknown` when `isolation_level` is null.
- **Priority score** = urgency (max 35) + vulnerability (age 65+ 12, lives alone 10, mobility 12,
  medical need 10, no phone 6, SMS help request 10; max 60). Practical max is 95, displayed out of 100.
- **Confidence** is **completeness only**, separate from the score:
  `max(0, 1 − 0.2 × (missing vulnerability fields))`. Missing fields add **zero** points and only
  lower confidence. Applied SMS check-ins are **unverified**: they never raise confidence and are
  reported separately as `unverifiedReportCount`.
- **Ranking order**: score desc, ETI asc, fewer missing fields, household id.
- **Resource matching** is greedy: isolated → boats, others → vehicles; closest safe place — shelter
  or hospital — with enough beds by **straight-line Haversine** distance; beds consumed by household
  size. Medical-need households get no special priority: that is a policy call, not a model detail. It
  is a suggestion, **not dispatch**.

## 7. Prompt log etiquette (required for submission)

`prompts/` is on the hackathon checklist. For **every substantive AI interaction**, add an entry to
`prompts/prompts.md` in the existing format:

```
### YYYY-MM-DD - <short label> - OK | MISS | PARTIAL

- **Model:** <the tool/model actually used>
- **Done by:** <the person who directed the work — ask them, never guess>
- **Goal:** <what you were trying to achieve>
- **Prompt:**
  > *"<the actual prompt text>"*
- **Outcome:** <what you got, what you kept, what you changed and why>
```

- **The `Model:` field must name the tool that was actually used.** Do not fabricate it.
- **Tasks are not pre-assigned to anyone.** Never write an owner into `TASKS.md` and never assume
  one. When you finish a task, **ask the user who did the work**, then record that name in
  `Done by:`. If they do not answer, leave it blank — never invent a name.
- Record the **misses** too — they are the most useful entries. Never delete the
  "Corrections to earlier drafts" table; add to it if you find more drift.
- Reusable prompts live in `prompts/templates/`; the project primer is `prompts/context.md`.

## 8. Available skills

Load the matching skill before working in its area:

| Skill | Use when |
|---|---|
| `.agents/skills/isolation-clock-model/` | Changing the model, scoring, confidence, ranking or allocation. |
| `.agents/skills/data-pipeline/` | Regenerating or debugging the Python pipeline / `public/data`. |
| `.agents/skills/frontend-ui/` | Editing the React/Leaflet UI or `styles.css`. |
| `.agents/skills/hackathon-submission/` | Preparing or checking the submission artifacts. |

## 9. Code conventions

- **Style:** single quotes, **no semicolons**, 2-space indent, trailing commas, small typed
  functions. Match the file you are editing.
- **TypeScript is strict** (`"strict": true` is set in all three tsconfigs). No `any`; prefer explicit
  narrow types. Lint with `oxlint`.
- **React:** function components, hooks for state; keep the page component thin and put logic in
  `src/simulation/`.
- **Accessibility:** interactive controls need accessible labels / roles.
- **Data paths:** fetch with `import.meta.env.BASE_URL` so the app also works when deployed under a
  sub-path.

## 10. Submission constraints

- Static deploy only (**Vercel / Netlify**: build `npm run build`, output `dist/`).
- Required: public repo with visible history, a live link, `prompts/prompts.md`, runnable README,
  architecture diagram + trade-offs.
- **Deadline: 18 Oct 22:00 PKT** — freeze scope early.

## 11. Definition of done

A task is done only when:

1. The change is implemented and consistent with the surrounding style.
2. `npx tsc -b`, `npx oxlint`, `npm run build` and `npm test` all pass.
3. Every affected doc under `docs/`, `README.md` or `data/README.md` is updated, and no doc claims a
   feature that does not exist.
4. A new entry is added to `prompts/prompts.md`, with `Done by:` naming the person who did the
   work — ask them, do not guess.
5. You have told the user how you verified the change, and what you could not verify.
6. You have **not** committed or pushed anything — the changes are left in the working tree for the
   user to review and commit themselves.
