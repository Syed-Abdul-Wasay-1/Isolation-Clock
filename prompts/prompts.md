# AI Prompt Log - Isolation Clock

> **Required by the CODE//CONNECT'26 submission checklist:** the `prompts/` folder must document
> the AI prompts and strategy used during development.
>
> **Format:** Date - Goal - Prompt - Model - Outcome.
>
> All entries below were produced with **Claude Sonnet 5.5**.

## Strategy

**How we directed the AI:**

1. **Contract first.** We fixed the data shape (`households.json`, `roads.json`,
   `isolation.json`) and the meaning of "isolation level" *before* prompting for UI or logic, so the
   AI filled in a known contract instead of inventing an architecture.
2. **One concern per prompt.** Data generation, the road/isolation model, the scoring, the
   allocation and the UI were prompted and reviewed separately.
3. **Ask for the trade-off, not just the answer.** Prompts like *"what does this model not
   capture?"* produced `../docs/risks.md` and `../docs/tradeoffs.md`.
4. **Force honesty.** We required the copy to say *"scenario simulator, not a flood forecast"* and to
   label assumptions (straight-line distance, illustrative weights) in the UI itself.
5. **Verify against our own spec.** Every generated result was checked against
   `../docs/methodology.md`, `../docs/SCORING.md` and `../docs/ALLOCATION.md`; where the AI disagreed
   with the spec, the spec won.
6. **Log the misses.** Prompts where the AI was wrong (inventing features, dropping failures
   silently) are kept below, because they are the most useful entries.

**Division of labour.** AI: scaffolding, boilerplate, refactors, docs, debugging, first-pass
algorithms. Humans: problem framing, the isolation/ETI definition, the exposure heuristic, ranking
weights, resource rules, UX and the pitch.

**Reusable prompts.** The prompts we re-used for day-to-day work live in
[`templates/`](templates/) with a project primer in [`context.md`](context.md).

---

## Entries

### 2026-10-17 - Repo foundation and folder structure - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Agree a clean repo layout for a geospatial hackathon project with docs and a required
  `prompts/` folder.
- **Prompt:**
  > *"Give me a folder structure for a geospatial hackathon project. It has a hydrology simulation,
  > road-network routing with a time-to-isolation calculation, synthetic household data, docs, and a
  > required `prompts/` folder. Include a README, .gitignore and a LICENSE."*
- **Outcome:** Produced the tree now in `../README.md`. The folder names (`simulation/`, `routing/`,
  `workers/`) describe the *intended* end state; two of them stayed empty because we later moved the
  heavy work offline into `scripts/`. See "Corrections" below.

### 2026-10-17 - Frontend-only constraint - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Decide how to ship the app given only static hosting (Vercel / Netlify) and no backend.
- **Prompt:**
  > *"We have no backend hosting - only Vercel and Netlify, which serve static frontends. How should
  > we architect a geospatial app that computes shortest paths and simulates rising water, so it
  > runs entirely in the browser?"*
- **Outcome:** Adopted a client-side design: **Vite + React + TypeScript**, data **precomputed
  offline** into JSON in `public/data/`. The heavy graph work ended up in **Python**, not in the
  browser - see the correction entry. Captured in `../docs/architecture.md` and
  `../docs/tradeoffs.md`.

### 2026-10-17 - Study area and synthetic population - commit `357ccbd`, `fc07049`

- **Model:** Claude Sonnet 5.5
- **Goal:** A reproducible synthetic population with plausible vulnerability distributions, placed
  on real map features.
- **Prompt:**
  > *"Write a Python script that pulls OpenStreetMap buildings and amenities for a bounding box in
  > Sukkur, Sindh, places 400 synthetic households on jittered building centroids, samples realistic
  > age / mobility / phone / medical attributes, deliberately blanks some fields to simulate messy
  > field data, and writes households.json plus shelters.json and hospitals.json. Use a fixed seed."*
- **Outcome:** `scripts/generate_data.py`. It uses osmnx with a local GeoJSON cache, a fixed seed
  (`20261017`), and blanks roughly 15% of records (`age_band` is null for 29 of 400 households).
  We started on a Hala bounding box, then switched the study area to Sukkur (`357ccbd`).

### 2026-10-17 - Hydrology honesty check - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Decide whether coarse elevation data can be trusted for urban street flooding.
- **Prompt:**
  > *"Is roughly 30 m elevation data good enough to model which urban streets flood from drains and
  > rainfall? What should a two-day prototype do instead?"*
- **Outcome:** Confirmed it is too coarse for urban micro-topography. We stopped short of a
  hydrodynamic model and instead built a **relative exposure index** (elevation + distance to mapped
  water) turned into a 0-100 percentile scenario index. Documented in `../docs/assumptions.md` and
  `../docs/SIMULATION.md`.

### 2026-10-17 - Road graph and exposure thresholds - commit `3c21818`

- **Model:** Claude Sonnet 5.5
- **Goal:** Turn the OSM drive graph into a per-edge "scenario threshold" the browser can colour.
- **Prompt:**
  > *"Given an OSMnx driving graph and per-node elevations, normalise elevation and distance to the
  > nearest water feature, combine them into a node exposure score, convert it to a percentile rank
  > across the whole network, and give each edge a 0-100 threshold. Explain what the number does and
  > does not mean."*
- **Outcome:** `scripts/build_isolation_clock.py` part A. Elevation comes from OpenTopoData/SRTM
  (`elevation_source: "opentopodata"`, 1,908 nodes) with a synthetic surface fallback. Exposure is
  `0.6 * elevation + 0.4 * water distance`, percentile-scaled, and each edge threshold is
  `100 * min(exposure[u], exposure[v])`. We documented explicitly that this is **not a water depth**.

### 2026-10-17 - Isolation levels via widest path - commit `2120bce`

- **Model:** Claude Sonnet 5.5
- **Goal:** Define, rigorously and efficiently, the point at which a household loses its last route.
- **Prompt:**
  > *"A household stays reachable while any path to a safe place exists where every edge is still
  > open. Water only rises, so once a household is isolated it stays isolated. Given per-edge
  > thresholds, give an efficient way to compute, for every household, the highest level at which it
  > is still reachable, plus the safe place and the bottleneck edge on that best route."*
- **Outcome:** A reverse **widest-path (maximin) search** from every shelter and hospital. A node's
  value is the maximum, over routes, of the route's lowest edge threshold; ties break on path length
  then safe-place id. This is exactly "the last surviving route closes", which is the core of ETI.
  The AI called this "shortest path" in its first draft; we corrected the wording to widest path
  because we care about the weakest link, not the shortest distance.

### 2026-10-17 - Browser model wiring - commit `ca645a5`

- **Model:** Claude Sonnet 5.5
- **Goal:** Turn the precomputed isolation level into a live countdown as the user moves a slider.
- **Prompt:**
  > *"In the React app, given a household's isolation_level and a scenario level 0-100 and a rise
  > rate of 10 index points per hour, compute ETI = max(0, (isolation_level - scenarioLevel) /
  > riseRate). Classify as isolated, urgent (<= 3 h) or safe. Format the ETI for display."*
- **Outcome:** `src/simulation/householdStatus.ts`. The rise rate was wrong in the first draft of
  the data file and was fixed in the same commit; `docs/SIMULATION.md` now records it as an
  illustrative setting, not a measured rate.

### 2026-10-17 - Explainable priority score - commit `13310c6`

- **Model:** Claude Sonnet 5.5
- **Goal:** A transparent score blending urgency with vulnerability, plus a confidence value.
- **Prompt:**
  > *"Combine urgency (up to 35 points, from ETI) with vulnerability (age 65+, lives alone, mobility
  > limitation, medical need, no phone; up to 50 points) into a 0-100 score. Report confidence
  > separately from how many vulnerability fields are missing. Missing values must add zero points,
  > never points. Keep every weight visible to the user."*
- **Outcome:** `src/simulation/priorityScore.ts`, documented in `../docs/SCORING.md`. We accepted
  that the practical maximum is 85, not 100, and that confidence never changes the score.

### 2026-10-17 - Resource matching - commit `56dbb38`

- **Model:** Claude Sonnet 5.5
- **Goal:** Assign boats, vehicles and shelter beds in priority order without pretending to solve
  dispatch.
- **Prompt:**
  > *"Greedily walk the ranked households. Already-isolated households get boats, the rest get
  > vehicles. Each resource carries one household up to a passenger capacity. Assign the closest
  > shelter with enough remaining beds by straight-line distance. Record why a household could not be
  > assigned. Be explicit that this is not a globally optimal matching."*
- **Outcome:** `src/simulation/resourceMatching.ts`, documented in `../docs/ALLOCATION.md`. It uses
  one household per boat/vehicle and Haversine distance, not routed travel time.

### 2026-10-17 - Bad-data behaviour (AI first proposed hiding missing data) - MISS

- **Model:** Claude Sonnet 5.5
- **Goal:** Define behaviour when a household has no elevation or no modelled route.
- **Prompt:**
  > *"What should a flood prioritisation tool do when a household has no elevation data or no
  > modelled route?"*
- **Outcome:** The AI initially suggested **excluding** incomplete households. **We rejected that** -
  the people most likely to be missing from data are the people most at risk. Final rule: keep them
  visible, add no fabricated points, and lower confidence only. In the shipped data every household
  has a computable route, but the code paths and UI copy handle the null case.

### 2026-10-17 - Before/after comparison and playback - commit `3e357a0`

- **Model:** Claude Sonnet 5.5
- **Goal:** Let a coordinator pin a moment and compare it with a later one.
- **Prompt:**
  > *"Add a play control that sweeps the scenario level from the current value to 100 over about 20
  > seconds with a 1x/2x speed toggle, and a 'pin this moment' action that snapshots the ranking,
  > isolated count and resource assignments so we can show rank movement, newly isolated households
  > and assignment changes."*
- **Outcome:** `BeforeAfterPanel.tsx` plus the playback state in `IsolationClockPage.tsx`.

### 2026-10-17 - Branch review and porting the useful parts of `origin/rabia` - commit `629acba`

- **Model:** Claude Sonnet 5.5
- **Goal:** Decide whether an earlier teammate branch (`origin/rabia`, built before the study-area
  switch) should be merged, and salvage anything useful.
- **Prompt:**
  > *"Compare this feature branch against main: what did it add, is anything still useful, and can it
  > be merged cleanly? List only the ideas worth porting and say why the rest is obsolete."*
- **Outcome:** The branch is an early prototype that predates ETI, scoring and allocation; merging it
  would conflict and duplicate components. We ported four small wins by hand instead: deploy-safe
  data paths (`import.meta.env.BASE_URL`), map `fitBounds`, map popups showing rank/status/ETI/
  assignment/reasons, and per-record validation of shelter and hospital data. We did **not** adopt
  its vulnerability weights, because `docs/SCORING.md` defines ours.

### 2026-10-17 - docs, prompt log and agent skills

- **Model:** Claude Sonnet 5.5
- **Goal:** Make the documentation and AI workflow honest and reusable before submission.
- **Prompt:**
  > *"Read the existing docs and this conversation. Rewrite the prompt log so it matches what the
  > code actually does, flag anything the docs claim that was never built, and add reusable prompt
  > templates plus repo skills an AI assistant can load."*
- **Outcome:** This rewritten log, the reusable prompts in [`templates/`](templates/), and the
  skills under `../.agents/skills/`. The main correction: earlier docs described a Web Worker ETI
  sweep, offline snapshots and a sensitivity band that were **never implemented**.

### 2026-10-17 - Final verification and team roster - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Confirm the repo is submission-ready, and record who worked on what.
- **Prompt:**
  > *"Check the whole repo end to end - branch, commits, build, lint, prompts, docs - and tell me if
  > everything is done. Then fill the README Team table from the commit history."*
- **Outcome:** Verified: `wasay` in sync with `origin/wasay`, clean tree, all commits authored by the
  team account, `tsc -b` / `oxlint` / `vite build` all pass, and every entry above carries a Model
  field. Filled the Team table from the commit history - Lead: Syed Abdul Wasay; Simulation and
  Routing: Ameena Batool; Frontend / UX: Rabia Chadio. Still open at the time of writing: the live
  deploy link, `docs/architecture.png`, the doc drift listed below, and the demo video.

### 2026-10-17 - Fix doc drift and add AGENTS.md agent instructions - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Make the docs describe only what ships, and give an AI agent persistent instructions it
  reads before every task.
- **Prompt:**
  > *"Fix the doc drift in architecture.md, assumptions.md, risks.md, tradeoffs.md and methodology.md,
  > and add a file an agent always reads before it starts - containing everything an agent has to do."*
- **Outcome:** Removed every claim of a Web Worker, offline snapshots, a sensitivity band and a
  0.30 m road tolerance from `architecture.md`, `assumptions.md`, `risks.md`, `tradeoffs.md`,
  `methodology.md`, `README.md`, `data/README.md`, `public/data/README.md` and `scripts/README.md`;
  they now describe the shipped system (Python precompute + client-side ETI, relative 0-100 index).
  Added `AGENTS.md` at the repo root - the file OpenCode loads automatically before a prompt - with
  the project summary, golden rules, read order, commands, model invariants, prompt-log etiquette,
  skills, conventions, submission constraints and the definition of done. Also corrected the wrong
  file names in `public/data/README.md` and refreshed the hackathon-submission skill so it no longer
  reports the drift as open.

### 2026-10-17 - Review the new Rabia commit and add a model test suite - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** Decide whether the newly pushed `origin/rabia` commit is worth porting, then do the most
  valuable follow-up.
- **Prompt:**
  > *"Rabia added new stuff in her branch - check and tell if it's needed. Do whatever is best."*
- **Outcome:** Reviewed `b4bc175` ("Add flood routing, ETI, uncertainty and offline support") and
  rejected it: it adds an in-browser Dijkstra routing engine over absolute metres, confidence bands,
  a service worker, offline snapshots and a second road graph, all on the **pre-Sukkur (Hala)**
  history - each piece either duplicates or contradicts the shipped model, so nothing was ported.
  The one worthwhile idea was her `tests/routing.test.mjs` (we had no tests). Added `tests/` with 45
  cases across ETI/status, priority scoring/confidence and resource matching, run with Node's
  built-in `node:test` runner (zero new dependencies) plus a `tsconfig.test.json` so `npm test`
  type-checks them. One source change was required: `householdStatus.ts` now imports
  `./priorityScore.ts` with the extension so Node can resolve it (TypeScript already allows
  `.ts` imports here).

### 2026-10-17 - Create the remaining-work task file for three people - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** After merging `wasay` into `main`, capture everything still outstanding as a single,
  properly organised task file split across the three team members.
- **Prompt:**
  > *"I changed to main branch. Can you create me a task file with all the stuff we have to do now,
  > mentioned properly - first do deep research, then create it. There are three people working on
  > this code."*
- **Outcome:** Researched the event brief (`docs/event-brief.md`: deadline 18 Oct 22:00 PKT, judging
  weights, submission checklist), audited the repo for real gaps (no deploy config, missing
  `docs/architecture.png`, empty `screenshots/`, no demo video, stale `ameena` branch, empty
  placeholder folders, committed `cache/`) and checked every relative doc link before writing.
  Created `TASKS.md`: a status snapshot, an owner table that keeps each person inside their own files
  (`README.md`-style roles: Lead, Simulation & Routing, Frontend / UX), P0-P3 priority tags, and
  14 tasks with steps and "done when" criteria plus a T-1-day timing plan. Linked it from `AGENTS.md`
  (read order) and the README project tree.

### 2026-10-17 - Review the merged SMS feature and repair what it drifted - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** A teammate's SMS check-in simulator had been merged into `main`. Review what landed,
  confirm it still builds, and repair anything it broke.
- **Prompt:**
  > *"Ameena merged her branch - check and tell me what she did."* and then *"ok add all or fix
  > all."*
- **Outcome:** Read the whole merge (SMS check-in simulator, a new `needs_help` weight, numeric
  household sorting, ranking sort / show-all controls) and ran the four gates in a throwaway
  worktree, which caught a **failing test**: the confidence band compared against `0.4`, but
  `1 - 3 x 0.2` is `0.3999999999999999` in IEEE-754, so a three-field gap banded Low instead of
  Medium. Fixed with a tolerance. Also fixed the drift the merge left behind: the maximum score was
  still described as 50/85 in `AGENTS.md`, `docs/methodology.md` and `prompts/context.md` (now
  60/95), and every household was flagged "Needs help: Not reported" because the new field is absent
  from the data in almost every row. Separated the conflated confidence value: it now measures
  **completeness only**, and an unverified SMS check-in no longer raises it - reports are returned
  as `unverifiedReportCount` and shown as a separate verification signal. Indexed the new
  `docs/SMS.md` and added four tests for the SMS scoring. Gates: `tsc`, `oxlint`, `build` and
  49/49 tests pass. No commit was made.

### 2026-10-17 - Rewrite TASKS.md as a single ordered run - OK

- **Model:** Claude Sonnet 5.5
- **Goal:** The task file had drifted and was organised by theme, so it did not say what to do first.
  Rewrite it as one ordered list: product work first, submission last.
- **Prompt:**
  > *"fix task md in it properly tell what to do like start from the first one to the last one
  > submission are the last i want to add all the new stuff and then after adding all the new stuff
  > then i do submission."*
- **Outcome:** Replaced `TASKS.md` with a strict T1–T22 sequence in six parts — Part 1 product work
  (close the loop on road-block reports, critical-roads panel, escalation curve, people-not-households,
  the missing SMS and data-loader tests, map performance, docs sync), Part 2 artifacts, Part 3 repo
  hygiene, Part 4 deploy, Part 5 video, Part 6 submission last. Added a status snapshot corrected to
  `5f9b5d7` / 49 tests, a budget and cut list, a "done when" per task, and a post-deadline backlog.
  (The per-task owners that version carried were removed the same day at the user's request — tasks
  are not pre-assigned; see `AGENTS.md` section 7.) Kept the honesty constraints explicit: the road-close task is specified as an
  *impact preview* built from the precomputed `bottleneck_road` and must not claim the ETI changed,
  unless the stretch option ships the road graph and recomputes it properly. Also flagged that the
  app cannot recompute isolation client-side today because only edge geometries and thresholds are
  shipped, not the graph. Doc-only change; no code or model touched.

### 2026-10-17 - Drop pre-assigned task owners; ask who did the work - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Stop assigning owners to tasks up front. The person who did a piece of work should be
  recorded when it is finished, not guessed in advance.
- **Prompt:**
  > *"dont mention owner remove the owner whenever does the work using ai the ai should ask who did
  > it and then mention thier name thats it"*
- **Outcome:** Removed every `**Owner:**` line and the "Who does what" table from `TASKS.md`, and
  replaced them with a blank `**Done by:**` on each of T1–T22 plus a rule in "How to use this file":
  the AI asks who did the work and records the name, and never writes an owner itself. Made the same
  rule persistent in `AGENTS.md` — a new bullet in section 7, and the entry format now carries
  `Done by:`, with section 11's definition of done updated to match. Carried the field through
  `prompts/README.md` and the copy-paste template at the foot of `prompts.md`. The instruction is
  live immediately: the assistant asked before writing this entry. Doc-only change; no code or model
  touched.

---

## Part 1 — fixing the product (T1–T11)

**The prompt that drove all of Part 1** (one instruction, then the assistant worked `TASKS.md`
top-to-bottom without further prompting):

> *"ok do all the tasks which are remaining 1 by 1"*

Each entry below is one task from `TASKS.md`. They share that prompt and the standing
`AGENTS.md` / `TASKS.md` reading; where a task needed a decision the assistant asked, the answer is
noted in the outcome rather than invented as a prompt.

### 2026-10-17 - T1 road-blocked SMS reports: impact preview - PARTIAL

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Stop an SMS `3` ("road blocked") being a dead end. Make reporting a blocked road visibly
  show who it cuts off, without pretending to re-run the model.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T1, option A.
- **Outcome:** Shipped option A, the honest one. `RoadBlockReport` gained an `edgeId`; a report
  defaults to the reporting household's own `bottleneck_road` when that value is a real edge id and to
  `null` otherwise (the named street cannot be located in `roads.json`, so guessing would be
  fabrication). `src/simulation/roadImpact.ts` gained `getRoadDependants` and `findNearbyRoadEdges`;
  `src/simulation/smsOverrides.ts` was extracted from the page so the logic is testable. The SMS panel
  now shows a per-report edge `<select>` of the nearest segments, the dependant count, and a highlight
  toggle. Reports with a known edge join a derived `previewClosedEdgeIds` set and render as dashed
  purple "Reported blocked (unverified)". Nothing re-routes: no `isolation_level` and no ETI moves,
  and the UI and `docs/SMS.md` say so.
  **Partial** only in that option B (ship the road graph and recompute widest-path in the browser) was
  deliberately not built; that is now in the post-deadline backlog with its reason. `src/routing/`
  — whose whole purpose was option B — was deleted under T10 rather than left as an empty promise.

### 2026-10-17 - T2 critical-roads panel - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Answer "which single road, if it fails, isolates the most people?" in the app, from data
  already shipped.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T2.
- **Outcome:** New `src/components/CriticalRoadsPanel.tsx` (top 8, expandable) over
  `describeBottleneckRoadGroups` in `src/simulation/roadImpact.ts`, sorted by households with people
  shown alongside. Rows carry a threshold tag, and a "street name only · no edge geometry" tag when
  the value cannot be located. Households already isolated at the current level are counted
  separately. Clicking a row focuses the road on the map and highlights its dependants; a nested
  **"Open top household"** button selects the highest-ranked dependant instead of the task's original
  "scroll the ranking" wording, so one click does one thing. Documented as an *impact preview* — the
  shipped data records the bottleneck of the best route only, so a group is "households whose best
  modelled route uses this road", not a proven closure set.

### 2026-10-17 - T3 escalation curve - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Make the clock read as a clock — "at +3 h, N households / M people are cut off" without
  moving the slider.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T3.
- **Outcome:** New pure `src/simulation/escalation.ts` (`getEscalationCurve`, `ESCALATION_HOURS` =
  0,1,2,3,4,6,8,10) and a clickable bar-per-hour `EscalationCurvePanel.tsx`. Level at hour `h` is
  `min(100, level + riseRate × h)`; a household counts once `isolation_level ≤` that level; households
  and people are both reported. Clicking an hour jumps the scenario slider there. The panel states
  that the rise rate is the illustrative `rise_rate_default`, not a measured flood rate. Verified
  against the real data: from level 40 the curve runs 240 hh / 635 people at +0 h to all 400 hh /
  1,043 people by +6 h, and hour 0 matches the set the ranking calls isolated.

### 2026-10-17 - T4 count people, not just households - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** A household of six is not a household of one; every headline total should say people too.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T4.
- **Outcome:** New `src/simulation/population.ts` (`countPeople`, `formatPeopleCount`,
  `formatHouseholdsAndPeople`). People counts now appear in the ranking header and intro, the
  allocation totals (grid widened to four columns), the before/after panel (a new `isolatedPeople`
  field on the pinned snapshot), the two road panels, the map summary and the README. A household with
  a missing or invalid `household_size` is counted as a household and **excluded** from the people
  total — never silently assumed to be one person — and the UI reports how many such households there
  are. It is zero in the shipped data.

### 2026-10-17 - T5 tests for the SMS module - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** `smsCheckins.ts` was the one simulation module with no tests.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T5.
- **Outcome:** New `tests/smsCheckins.test.ts`, 13 cases: a `2` sets `needs_help` and marks the status
  unverified; a `4` fills a *missing* medical need but never overwrites a known one; a `3` adds a
  report and changes no household field; a `3` whose recorded bottleneck is not a known edge gets
  `edgeId: null`; `reportedFields` marks exactly the fields the check-ins supplied; free text records a
  check-in without touching a field; a queued batch replayed in order equals sending each message
  live; and an unknown household throws. Writing these exposed and fixed a real bug — a check-in could
  clobber a *known* `medical_need` while the UI claimed it only filled gaps.

### 2026-10-17 - T6 tests for data loading - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** The loader's failure paths were untested, and the loader itself was untestable because
  validation lived inside a React hook.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T6.
- **Outcome:** Extracted the whole validation into a pure `src/hooks/studyDataValidation.ts`
  (`validateStudyData`, `INVALID_STRUCTURE_MESSAGE`) and rewrote `useStudyData.ts` to fetch `unknown`
  and delegate, so the hook is now only I/O. New `tests/studyDataValidation.test.ts`, 8 cases, covers a
  file that is not an object, a missing collection array, a shelter with no usable id, a non-finite and
  a non-positive rise rate, and the first household whose isolation record is missing. No DOM needed.

### 2026-10-17 - T7 tests for the new Part 1 functions - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** The pure functions added in T1–T3 needed the same coverage as the older model code.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T7.
- **Outcome:** `tests/roadImpact.test.ts` (grouping, people counts, ordered dependants, safe-place
  sums, ties, null bottleneck, an edge nobody depends on → empty rather than an error, display-name
  handling) and `tests/escalation.test.ts` (monotone, hour 0 equals the currently-isolated set, cap at
  100, null `isolation_level` never counted, unknown household size not counted as one person, a
  non-positive rise rate holding the curve flat). Both use the shared `tests/helpers.ts`.
  Suite went 49 → 111 tests.

### 2026-10-17 - T8 stop re-rendering every road segment per tick - PARTIAL

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** The map re-rendered ~4,958 road polylines on every playback tick — visible jank on a 20 s
  sweep.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T8.
- **Outcome:** `IsolationMap.tsx` now groups roads by style with `buildRoadClusters` and draws a
  handful of `<Polyline>` layers (open / scenario-closed / reported-blocked / focused) instead of one
  layer per segment — ~4,958 elements per render down to ~4, with identical colours and the SVG
  renderer kept. Measured in Node against the shipped dataset: one full classification pass over all
  4,958 segments costs ≈0.15 ms, so the per-tick *computation* was never the problem; the element and
  layer count was. **Partial, honestly:** the task said to profile with React DevTools first and the
  build environment has no browser, so no frame timings were captured. That is recorded in
  `docs/tradeoffs.md` and left as a real check on the deployed URL in T19 rather than papered over with
  a made-up number.

### 2026-10-17 - T9 optional model upgrades: hospital allocation only - PARTIAL

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Take only the T9 upgrades that can be done without inventing anything, and consciously
  leave the rest with reasons.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T9.
- **Outcome:** Shipped **hospital allocation**. `matchResources` now takes every reachable safe place
  — shelters *and* hospitals — because the isolation model already routes households to both, so
  allocation that ignored hospitals contradicted the ranking. `SafePlace.kind` is stamped at load time
  by `validateStudyData`; `docs/ALLOCATION.md` updated; tests added. Real effect: bed capacity available
  to the allocator rises from 775 to 1,255. Deliberately **not** implemented: medical-need priority for
  a hospital bed (a policy decision the model should not make silently — the UI shows the destination
  type and nothing more), route-based allocation distance and a per-road rise rate (both blocked on
  data the app does not ship / does not have), and the sensitivity band (which `AGENTS.md` §2 asserts
  does not exist). All four are in the post-deadline backlog.

### 2026-10-17 - T10 delete the empty placeholder folders - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** `src/routing/` and `src/workers/` held only `.gitkeep`. No folder should exist that the
  docs cannot explain.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T10.
- **Outcome:** T1 shipped option A, not B, so neither folder had become real — both were deleted, along
  with the "Reserved, unused folders" note in `docs/architecture.md` and the corresponding rows in the
  README structure tree and folder table. Replaced by an explicit statement in both files: there is no
  Web Worker and no in-browser routing, because the graph work runs offline in `scripts/` and the
  browser only reads precomputed results. `AGENTS.md` §2 stays true.

### 2026-10-17 - T11 docs sync for Part 1 - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** No doc may contradict the shipped code, and every Part 1 task needs a prompt-log entry.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T11.
- **Outcome:** Updated `docs/methodology.md` (new §6: the escalation curve, the critical-roads impact
  preview, and people counts), `docs/SIMULATION.md` (a road-block report changes no threshold, level or
  ETI), `docs/ALLOCATION.md` (hospitals as destinations, plus the explicit "we do not invent medical
  priority"), `docs/SMS.md` (the `3` path drives a preview), `docs/architecture.md` (new diagram, new
  components table, new data flow, no empty folders), `docs/tradeoffs.md` (new decisions and new
  limitations), `docs/README.md`, `README.md` (a new "What's in the app" table, refreshed structure
  tree and totals), `data/README.md` (`bottleneck_road` can be a street name — 112 of 400 households)
  and `prompts/context.md`. `SCORING.md` and `assumptions.md` needed no change: Part 1 did not touch
  the score or add an assumption.
  Two pieces of drift were found while grepping and fixed at the source rather than in the wording:
  `tsconfig.*.json` never set `strict` even though `AGENTS.md` and `prompts/context.md` both claimed
  strict TypeScript — `"strict": true` was added to all three configs and `tsc -b` passes cleanly, so
  the claim is now true instead of the docs being weakened to match; and
  `scripts/__pycache__/generate_data.cpython-315.pyc` was committed — stale bytecode for a Python
  version not used here — so it was deleted and `__pycache__/` plus `*.pyc` added to `.gitignore`.

---

## Part 2–4 — the diagram, hygiene and the deploy config

### 2026-10-17 - T12 architecture diagram, T16 repo size, T18 deploy config - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** Syed Abdul Wasay
- **Goal:** Land the presentation and hygiene artifacts that do not need an account or a browser.
- **Prompt:**
  > *"ok do all the tasks which are remaining 1 by 1"* — `TASKS.md` T12, T16 and the config half of T18.
- **Outcome:** **T12.** The system diagram is authored as a hand-written, diffable
  `docs/architecture.svg` (offline pipeline → shipped JSON → hooks → pure simulation → components →
  page → UI, with the honest framing that the browser only reads precomputed results) and rasterised to
  a 2× `docs/architecture.png`. Both are committed, the README embeds the PNG, and both "still to be
  rendered" notes are gone. **T16.** Measured the repo: working tree under 4 MB, `.git` 1.1 MB, largest
  file `public/data/roads.json` at 1.15 MB, nothing needing Git LFS. `data/README.md` gained a table
  naming every committed input file with its size, so the ~2.0 MB `.graphml` and the `cache/*.json`
  files are explained rather than surprising. A stray tracked `public/data/.gitkeep` was removed now
  that the folder has real contents. **T18 (config only).** Committed `vercel.json` and `netlify.toml`
  with equivalent settings — build `npm run build`, output `dist/`, no serverless functions — so either
  host works with no dashboard configuration. The deploy itself needs an account and is left to the
  user, as are the screenshots (T13), the branch tidy (T15), the live perf check (T19), the video
  (T20) and the submission (T21/T22).

---

## Corrections to earlier drafts

Kept on purpose: the rules ask us to be explicit about behaviour, and an honest log is worth more
than a flattering one.

| Earlier claim | Reality |
|---|---|
| "The heavy graph sweep runs in a **Web Worker**." | Not built. All computation is precomputed in Python; the browser only converts isolation levels to ETI. The empty `src/workers/` placeholder was later deleted. |
| "Precomputed **offline snapshots** at +10/+20/+30 cm." | Not built. The app recomputes from `isolation.json` in the browser at any level. |
| "Every ranking shows a **sensitivity band** / stays-top-10 flag." | Not built. Confidence is shown, but there is no ±margin re-run. |
| "**Python was dropped entirely.**" | Wrong. Python (`scripts/`) generates every file in `public/data/`. |
| "Road tolerance is about **0.30 m**." | Not implemented. There is no depth tolerance; thresholds are a 0-100 relative exposure percentile. |
| "**We do not assign vehicles** - allocation stays human." | Partly outdated. `resourceMatching.ts` now makes a greedy boat/vehicle/bed suggestion; the docs note it is not dispatch. |

---

<!--
TEMPLATE - copy for each new entry. Use OK / MISS / PARTIAL for the outcome marker.

### YYYY-MM-DD - <short label> - OK

- **Model:** Claude Sonnet 5.5
- **Done by:** <the person who did the work - ask, never guess>
- **Goal:** <what you were trying to achieve>
- **Prompt:**
  > *"<the actual prompt text>"*
- **Outcome:** <what you got, what you kept, what you changed and why>
-->
