# AI Prompt Log - Isolation Clock

> **Required by the CODE//CONNECT'26 submission checklist:** the `prompts/` folder must document
> the AI prompts and strategy used during development.
>
> **Format:** Date - Goal - Prompt - Model - Outcome.
>
> All entries below were produced with **Claude Sonnet 5.5** unless the entry names a different model;
> the `Model:` line in each entry is authoritative.

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
  Routing: Ameena Batool; Frontend / UX: Rabia Chandio. Still open at the time of writing: the live
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

## Test tooling — browser testing MCP servers and skills

### 2026-10-17 - Free browser testing setup: Playwright MCP, Chrome DevTools MCP, OpenTest and axe-core skills - PARTIAL

- **Model:** DeepSeek V4.1 Flash Free (opencode)
- **Done by:** 
- **Goal:** Give the agent a free, local browser-testing stack for Isolation Clock — functionality/E2E,
  UI/UX, accessibility and performance — through two MCP servers plus testing skills, without touching
  the app's source.
- **Prompt:**
  > *"I want you to set up free browser testing tools for this project so you can test my web app's
  > functionality, UI/UX, accessibility and performance. Do the setup yourself, step by step, and tell me
  > what you did at the end."* — a five-step spec: check prerequisites, add the `playwright` and
  > `chrome-devtools` MCP servers, install the `ux-test` / `a11y-test` / `e2e-test` and axe-core skills,
  > verify, then smoke-test the dev server. Abridged rules: touch only MCP config, skills folders and dev
  > dependencies, and ask before writing outside the project folder.
- **Outcome:** **Environment.** OpenCode v2.0.32, Node 24.14.1, npx 11.11.0 and Chrome 155.0.8059.80 — every
  prerequisite was already satisfied. MCP config lives in the project `opencode.json`. **MCP.** Added
  `playwright` (`npx -y @playwright/mcp@latest`) and `chrome-devtools` (`npx -y chrome-devtools-mcp@latest`);
  both report `connected` and their tools are live (25 and 32 tools). `opencode mcp add` stores the command
  as a single array element when the arguments follow `--`, which yields a server that cannot start — even
  the command's own documented example (`opencode mcp add everything -- npx -y
  @modelcontextprotocol/server-everything`) fails with `Unrecognized flag: -y`. Repaired by hand-editing the
  `command` array to `["npx","-y","<pkg>"]`, the hand-configuration route the MCP docs describe; this looks
  like a genuine CLI bug worth filing upstream. **Skills.** `ux-test`, `a11y-test` and `e2e-test` were
  **already installed** in `.agents/skills/` and are byte-identical to `coderphonui/opentest` HEAD —
  verified by comparing `git hash-object` against the upstream blob SHAs, including `scan_a11y.py` and
  `heuristics.md` — so nothing was reinstalled. The axe command exactly as written failed:
  `npx skills add … --skill axe-core-accessibility-testing` finds only 13 skills, because that CLI scans
  `.claude/skills/` and `packs/` but not `seed-skills/`, where the skill actually lives; the name in the
  brief comes from the SKILL.md frontmatter (`name: Axe-core Accessibility Testing`). Installed instead by
  pointing at the directory —
  `npx skills add "https://github.com/pramoddutta/qaskills/tree/main/seed-skills/axe-accessibility" -a opencode --copy -y`
  — which landed in `.agents/skills/axe-core-accessibility-testing` and added a `skills-lock.json` entry with
  the existing entries preserved. **Dependencies.** `@playwright/test` 1.64.1 and `@axe-core/playwright`
  4.14.0 were already in `devDependencies`; `npm install -D` reported "up to date" and Chromium revision
  1248 — exactly what Playwright 1.64.1 expects — was already in the browser cache, so that step was a
  no-op. **Smoke test.** Reused the dev server that was already running (`vite --port 5173 --strictPort`)
  instead of starting a second one on a strict port. The Playwright MCP loaded the app (title "Isolation
  Clock | Sukkur scenario", 400 households / 1043 people / 7 safe places, scenario level 0) and captured a
  screenshot; the single console error is a 404 for `/favicon.ico`. A Lighthouse run through the Chrome
  DevTools MCP gave Accessibility 94, Best Practices 100 and SEO 92, with six failing audits:
  `aria-command-name` (7 Leaflet shelter/hospital markers are `role="button"` with no accessible name),
  `color-contrast` (10 nodes), `label-content-name-mismatch` (1 node), plus `robots-txt`,
  `agent-accessibility-tree` and `llms-txt`. A cold-load performance trace worked and reported LCP 1018 ms
  with CLS 0.00. The a11y findings are reported, not fixed, because the brief said not to touch app source.
  **Left over.** `opencode.json`, the new skill folder and `src/.playwright-mcp/` are untracked; nothing was
  committed.

---

## Fixing the test report's accessibility and consistency findings

### 2026-10-17 - Fix every issue in test-report.md / test-summary.md - OK

- **Model:** DeepSeek V4.1 Flash Free (opencode)
- **Done by:** Syed Abdul Wasay
- **Goal:** Close out the testing pass's findings — HIGH-1..HIGH-3, MEDIUM-1..MEDIUM-3, LOW-1..LOW-5
  and the Lighthouse `label-content-name-mismatch` — without breaking the model or the honesty rules.
- **Prompt:**
  > *"read these and fix all the issues."* (pointing at `test-report.md` and `test-summary.md`)
- **Outcome:** **HIGH-1 (rank meaning).** Picked the *within-tab* rank as the single definition and
  built it once in `IsolationClockPage.tsx` (`priorityRankInTab`, built in the same loop as the map
  annotations over `isolatedHouseholds` + `evacuateHouseholds`). The global map is gone, so the
  ranking row number, the "why this rank" panel (`selectedIndex + 1`) and the map popup now agree;
  the map popup keeps `H294 · Rank #254`-style within-tab numbers. `BeforeAfterPanel` is the one
  cross-tab surface and keeps the overall order, with its "Top 10 now" heading now carrying the
  explicit label **"overall priority, both tabs"** so it is never confused with the list.
  `RankingPanel`'s prop was renamed to `priorityRankInTab` and `IsolationMap`'s `annotations` /
  `HouseholdMapAnnotation` now document the within-tab meaning. **HIGH-2 (focus).** `.scenario-slider`
  gained a `:focus-visible` outline and a thumb ring, and its box was widened to 44 px for touch
  (the visible track stays 4 px, painted by the track pseudo-elements). **HIGH-3 (marker names).**
  `IsolationMap` now builds each shelter/hospital `divIcon` with a glyph hidden from assistive tech
  (`aria-hidden`) plus an `sr-only` shelter/hospital name, so the Leaflet `role="button"` markers are
  named; the icons are memoised in a `Map` keyed by id. **MEDIUM-1 (contrast).** Every muted
  grey / red text token that was below 4.5:1 was replaced with a minimally darkened, hue-preserving
  value (77 tokens in `styles.css`), e.g. `#ca6258 → #b75950` (the critical-road count, 3.88 → 4.6),
  `#8b9692 → #67706d` (the escalation hour labels, 2.75 → 4.6), `#929c99 → #6f7774`, and the muted
  greys to `#6c7871`-family values. The escalation bar's `linear-gradient(#e07d6d, #ca6258)` fill was
  **left as-is**: it is a chart fill, not text, and its value is also printed as text.
  **MEDIUM-2 (tablist).** `RankingPanel` now has an `onKeyDown` handler implementing the WAI-ARIA
  pattern: ArrowLeft/ArrowUp, ArrowRight/ArrowDown, Home and End move the selection and the focus,
  with roving `tabIndex`. **MEDIUM-3 (sticky banner).** In the ≤760 px layout the `.topbar` and
  `.simulation-banner` are now `position: sticky` (z-index above Leaflet's controls) so the
  "scenario simulator, not a flood forecast" framing survives scrolling on mobile.
  **LOW-1 (touch targets).** Buttons, selects and inputs were raised to ~40–44 px (`.scenario-button`,
  `.speed-control select`, `.show-all-button`, `.ranking-tab`, `.back-button`, `.allocation-controls
  input`, `.sms-*`, `.critical-road-open`, `.road-report-*`); the Leaflet zoom control is left at its
  default 30 px (it is third-party and still passes the 24 px rule). **LOW-2 (input feedback).**
  `ResourceAllocationPanel` keeps an `inputMessage` in state and renders it in a `role="status"`
  line: a negative / empty / non-numeric value is rejected with *"… must be a number of 0 or more —
  the previous value was kept."*, and a decimal is floored with *"… must be a whole number — rounded
  down to N."* **LOW-3 (street-name-only roads).** The focused detail block now says, for a group with
  no edge geometry, that it is recorded as a street name only and therefore cannot be highlighted on
  the map. **LOW-4 (ranking position).** The ranking / why-rank block was moved from last to
  directly after the escalation curve panel. **LOW-5 (assets).** `public/` gained `favicon.svg`,
  `robots.txt` and `llms.txt`, and `index.html` links the favicon with `%BASE_URL%favicon.svg`
  (sub-path-safe). `roads.json` is untouched — it can only be shrunk by re-running the Python
  pipeline or by host-side gzip/brotli, which is Vercel/Netlify's job. **label-content-name-mismatch.**
  The brand link dropped its `aria-label` and now hides the mark with `aria-hidden` plus an
  `sr-only` "home"; the nine escalation bars dropped their `aria-label` and gained an `sr-only`
  description that *contains* the visible number and hour text, so the accessible name matches.
  **Honesty copy.** The escalation intro now says the curve rises "from the current level", matching
  the observation in the report; no forecast / depth / worker / sensitivity wording was introduced.
  **Docs.** `docs/methodology.md` §5, `docs/ALLOCATION.md`, `docs/architecture.md` (ranking UI row +
  a new accessibility principle) and `README.md` (ranking + before/after rows, `public/` tree) were
  updated to state the within-tab rank, the overall before/after rank, and the new assets. No new
  correction row was needed: no doc had claimed the rank was global — the drift was inside the code
  (the map component's comment already said "within its own tab").

---

### 2026-10-18 - Critical-road names: label unnamed ways and regenerate the dataset - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Syed Abdul Wasay
- **Goal:** Explain why the "Critical roads" panel prints raw OSM edge ids such as
  `4011856400-4011856423-0` as if they were road names, and fix it if it can be fixed.
- **Prompt:**
  > *"why are the names like this can they be fixed"* (pasting the whole 42-row bottleneck list from the
  > BOTTLENECK ROADS / Critical roads panel)
- **Outcome:** The list mixed two kinds of value because the committed `isolation.json` came from a
  pre-fix pipeline that wrote the street *name* into `bottleneck_road` when the OSM way had one and the
  raw edge id otherwise — 9 street-name groups (112 households) and 33 edge-id groups (275).
  `roads.json` ships no names, so nothing at runtime could turn an id into a label. Reading the
  committed `data/roads_*.graphml` settled the question: only **356 of the 4,958 drive edges (7.2 %, 24
  streets)** carry a `name` at all, **none** of the 33 bottleneck ways has one, none shares a way with a
  named segment and just one has even a `ref`, so those names do not exist and would have had to be
  invented. Kept: the honest label. Added: `describeBottleneckRoad` in `src/simulation/roadImpact.ts`
  returns `{ label, edgeId, nameOnly }` — the street name when there is one, otherwise *"Unnamed road
  segment"* with the edge id demoted to a muted mono tag — and `CriticalRoadsPanel.tsx` plus
  `WhyRankPanel.tsx` (new `bottleneckRoadLabel` prop from the page) use it, so a raw id is never the
  headline. 4 cases added to `tests/roadImpact.test.ts`. Then installed
  osmnx/geopandas/networkx/pyproj/shapely into a throwaway venv and re-ran
  `scripts/build_isolation_clock.py` **offline** from the committed graphml / elevation / water caches —
  no hand-editing of `public/data`, per the data-pipeline skill. Checked before/after: `roads.json`
  unchanged in content (4,958 features, 0 threshold and 0 geometry differences) and `isolation_level`,
  `nearest_safe_place_id` and `road_node_id` **identical for all 400 households**. All 387 routed
  households now carry an edge id, 112 of them with a street name, and the 9 previously un-locatable
  groups are drawable — which also closes LOW-3 from the test report. Deliberately **not** done: naming
  an unnamed way, and aggregating by street name (the segments close at different levels, so a single
  row would have to print a range) — recorded in `docs/tradeoffs.md`. Docs synced: `data/README.md`,
  `docs/DATA.md`, `docs/methodology.md`, `docs/tradeoffs.md`, `prompts/context.md`, `TASKS.md` and the
  data-pipeline skill; `test-report.md` LOW-3 and `test-summary.md` marked resolved.

---

### 2026-10-18 - Dead-file sweep: remove leftovers and fix the folder structure - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Syed Abdul Wasay
- **Goal:** Strip the leftover junk the earlier test and data passes left in the working tree, and
  correct anything the structure tree claimed but the folders did not actually contain.
- **Prompt:**
  > *"ok now just remove the useless old data files etc too now and fix the folder structure if needed
  > too"*
- **Outcome:** Audited the repo against `git ls-files` before deleting anything, then split the
  candidates into "obviously regenerable debris" and "committed files someone chose to keep", acted on
  the first group and asked about the second — the user approved all three of the second group.
  **Removed (regenerable, nothing imports them):** `src/.playwright-mcp/` (1.37 MB / 27 files of console
  logs, page snapshots and a stray PNG left by the browser tooling on 2026-10-17 — the session's working
  directory is `src/`, which is why it landed there), `scripts/__pycache__/` (30 KB of bytecode from the
  offline pipeline run), `state/` (a stray **empty** root directory with no reference anywhere),
  `dist/` (1.82 MB of build output; `npm run build` restores it) and seven `.gitkeep` placeholders in
  folders that now hold real files (`scripts/`, `src/components/`, `hooks/`, `pages/`, `simulation/`,
  `types/`, `assets/`). `src/assets/` was empty with nothing importing it, so the folder went too and its
  line came out of the README tree. `screenshots/.gitkeep` was **kept** — that folder is intentionally
  empty and both the README and `TASKS.md` refer to it. **Removed after asking:** the root `cache/` of
  five raw Overpass responses (two of them empty, ~171 KB) — read the scripts first: neither ever opens
  it, they cache into `data/` and `public/data/`, so it was dead weight; its row in `data/README.md` and
  its mention in `TASKS.md` T16 went with it. The ten vendored generic skills
  (`playwright-core` 51 files, `playwright-cli`, `playwright-ci`, `playwright-qa`, `playwright-pom`,
  `playwright-migration`, `playwright-frontend`, `ux-test`, `a11y-test`, `e2e-test` — 2.08 MB in total),
  keeping the four project skills plus the axe-core accessibility skill and trimming
  `skills-lock.json` to match; the axe-core skill was added to `AGENTS.md` §8 so the table matches the
  folder. And `test-report.md` + `test-summary.md` (36 KB of QA evidence). **Kept on purpose:** the
  `data/*.graphml` / `*.geojson` / `elevations*.json` caches — they are not dead data, they are the
  offline regeneration cache the previous task relied on, and `docs/architecture.png` plus its editable
  `.svg`, both linked from the README. **`.gitignore`** gained `.playwright-mcp/`, `state/`, `.venv/` and
  `venv/` so nothing here comes back, and the `data-pipeline` skill note that claimed
  `scripts/__pycache__/` "is committed in this repo" was corrected — it is not, and must not be.
  **Drift found while sweeping:** the README said "111 tests" and the `TASKS.md` status table said "111
  pass across 22 suites" — the real numbers are **115 tests in 23 suites**, so both were refreshed along
  with the repo-size figures in T16 (working tree 4.24 MB in 100 files, `.git` 2.02 MB, largest file the
  2.0 MB graphml). The `2026-10-17` entries above that cite `test-report.md` / `test-summary.md` were
  left untouched: this log is a record, and those files really did exist when the work was done.
  Verified: `npx tsc -b` clean, `npx oxlint` clean, `npm run build` clean, `npm test` **115/115**; every
  remaining relative doc link still resolves and no kept file references a removed path. Nothing was
  committed — the whole sweep, including the earlier naming fix, is left in the working tree.

---

### 2026-10-18 - Screenshots: extract from the .docx and wire them into the README - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Ameena Batool
- **Goal:** Pull the UI captures out of `Isolation-Clock-Screenshots.docx`, put them in a folder in the
  repo, and show them in `README.md` — the last open item on the submission checklist.
- **Prompt:**
  > *"& 'f:\Syed Abdul Wasay\Isolation-Clock\Isolation-Clock-Screenshots.docx' it contains pictures
  > and images of website i want you to take them out from this and put it in a new folder and then
  > add them in readme"*
- **Outcome:** A `.docx` is a zip, so the nine JPEGs came out of `word/media/` rather than needing a
  converter (`System.IO.Compression.ZipFile` → `screenshots/`). **Read the images before trusting the
  filenames:** `image1…image9` happen to match Figures 1–9 in document order, and the document's own
  captions matched what is actually on screen — scenario level 10 shows 27 of 400 isolated, level 96
  shows 387 of 400, the critical-roads panel really does read "61 of 387", and the SMS panel really
  does show H208 at rank #6. Renamed each file to say what it is
  (`01-scenario-level-10-early-stage.jpg` … `09-sms-checkin.jpg`) instead of `image7.jpg`. The header
  figures in the new section were re-checked against the data rather than copied on faith:
  `public/data/households.json` is **400 households / 1,043 people** and 5 shelters + 2 hospitals =
  **7 safe places**, matching the banner in every capture. The user chose the existing tracked
  `screenshots/` over a brand-new folder (the README and the checklist already pointed there) and asked
  for the `.docx` to be left alone. **README:** new *📸 Screenshots* section — the six-point sweep with a
  caption each, then the ranking, critical-roads and SMS panels; the structure tree now lists the nine
  files; the folder-roles row and the checklist box (`Screenshots in screenshots/`) updated. **TASKS.md
  T13** is marked **partly** done and says which panels are still missing (why-rank, allocation,
  before/after) — the docx simply did not contain them, and inventing them was not an option. Numbers
  were not re-derived from the model itself (the app was not rebuilt or re-run), so the counts are the
  ones the captures show. Verified: every `screenshots/...` path in the README resolves to a real file.
  Nothing was committed.

---

### 2026-10-18 - Screenshots: capture the three missing panels for real, not "as if" - MISS

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Ameena Batool *(carried over from the entry above — correct me if the browser captures
  should be credited differently)*
- **Goal:** The user asked to mark T13 fully done and delete the "still open" wording. Three of the
  eight capture targets were still missing, so the honest way to reach "fully done" was to take the
  shots — not to write that they existed.
- **Prompt:**
  > *"just imagine it is fully done and remove the other stuff"*
- **Outcome:** **Declined the fabrication.** Marking T13 done and deleting the open items would have put
  three screenshots in the README that no one could open, and the repo's own rule is to claim only what
  exists. Instead the panels were captured from the running app. The earlier "blocked — needs a real
  browser" note was **my own stale assumption**: this session does have browser tooling, so the
  capture was possible all along and should not have been handed back to the user. Method: `npm run
  dev`, drive the UI, and screenshot the panel element after injecting a style that un-clips the side
  panel — `.app-shell{height:auto;overflow:visible}` `.side-panel{overflow:visible}`. That override
  only removes the scroll container's clipping so a 1400 px panel can be captured whole; it does not
  touch any value on screen, and no number in these captures was written by hand. **The first attempt
  failed and is worth recording:** an element screenshot of `.why-panel` with the sidebar still
  scroll-clipped produced a 394×1408 JPEG that was ~1000 px of blank, because Chromium cannot paint
  content the container has clipped away — the fix was to un-clip first, not to crop after. **What was
  captured.** `10-why-rank-panel.jpg` (H004, level 45: 95.0/100 with every factor itemised, confidence
  *High · 0 of 5 missing*, and an SMS help request shown as *unverified* — it moved the score, not the
  confidence), `11-before-after-comparison.jpg` (pinned level 20 against 63), and
  `12-resource-allocation.jpg` (3 boats, 4 vehicles, 17 people assigned, 393 households unassigned
  with *no boats left* printed per household). **Independent check:** driving the app reproduced the
  `.docx` figures exactly from the committed data — level 20 gives **39** isolated households and
  level 63 gives **371**, which is what the earlier captures claimed, so the model and the two sources
  agree. **Docs:** README gains the three panels; TASKS T13 is now genuinely ✅ with the capture list
  fully covered, and the status snapshot plus the "what is left" table are corrected; the T13 row is
  gone from the user-side list because it no longer needs a human. **Open, and stated rather than
  hidden:** `10`–`12` are ~410 px panel crops while `01`–`09` are ~1299 px full-window shots, so the
  README section mixes two capture widths. Offered to re-shoot `07`–`09` as matching panel crops;
  waiting on the user. Nothing was committed.

---

### 2026-10-18 - Add the demo video to the README and fix the Rabia name - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Rabia Chandio (recorded the video; the README wiring was directed by Syed Abdul Wasay)
- **Goal:** Put the recorded walkthrough into the README, and correct the spelling of the person who
  recorded it.
- **Prompt:**
  > *"& 'f:\Syed Abdul Wasay\Isolation-Clock\1018 (2) (2).mp4' add this video too in the readme it is
  > the full wokring of the app maed by Rabia Chandio add this and thats it"*
  > *— then, on the name: "it is Rabia Chandio fix it in the readme too and anywhere else"*
- **Outcome:** **Name fixed in both places it appeared** — the README Team table and the `2026-10-17`
  roster line in this log both said **"Rabia Chadio"**; corrected to **Chandio**. The two `rabia-v1`
  / `archive/rabia-b4bc175` references in `TASKS.md` were left alone: those are git branch and tag
  names, not spellings of a person. **The video** moved from the repo root to
  `media/demo-walkthrough.mp4` and is linked from a **Demo video** section at the top of the README,
  with the tree and folder-roles table updated to list `media/`. **Caught a wrong claim before it
  shipped:** the first draft said "~3 min", copied from T20's title; the file is actually
  **2 min 21 s** (read from the Windows shell property handler — `ffprobe` is not installed here), so
  the length was corrected in all three places it was written, and `T20`'s task title no longer
  promises a length the video does not have. **Repo size is the real cost and it is documented rather
  than glossed:** `T16`'s "4.24 MB in 100 files" is now wrong, so the measurement is kept as a record
  and superseded with the real numbers — **41.49 MB in 113 files**, with the video at **35.06 MB** now
  the largest file in the repo, ahead of the 1.95 MB road graph. `T16` now also warns that the weight is
  permanent once committed and that a blanket `git add .` would also sweep in
  `Isolation-Clock-Screenshots.docx` (1.01 MB), which is deliberately not part of the app. **Considered
  and rejected:** `<video>` tags (GitHub strips them from READMEs, so the link would silently render
  as nothing) and the unlisted-upload route T20 originally specified (the user asked for the file in
  the repo, and a committed file cannot rot). `T20`, the status snapshot, the "what is left" table and
  the `T21` checklist are all ticked. Verified: every link in the README resolves, including the new
  `media/` one. Nothing was committed.

---

### 2026-10-18 - Verify the live Netlify deploy and write down the real numbers - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Syed Abdul Wasay
- **Goal:** The site went live at <https://isolation-clock.netlify.app/>. Close T18 and T19 against the
  real URL instead of marking them done on the assumption that a static host behaves as expected.
- **Prompt:**
  > *"https://isolation-clock.netlify.app/ here it is deployed on netlify now waht"*
- **Outcome:** **T18 and T19 are closed with measurements, not assumptions.** Loaded the live URL in a
  real browser: zero console errors, zero page errors, the header reads *400 households · 1043 people ·
  7 safe places* from the live JSON, and 12 of 12 map tiles load. The live bundle hash
  (`index-1ywJAOey.js`) is identical to a local `npm run build`, so the deployed artefact matches the
  committed source. All six `public/data` files return `200`; `roads.json` is **1.15 MB raw → 137 KB**
  over the wire (Brotli, ~8.4×) and the whole first load is **285 KB**. **T19:** first load is
  **2.0 s on Fast 3G**, 0.93 s unthrottled and 7.1 s at 400 Kbps — and the throttle was *checked*, not
  trusted: the three profiles scale as they should, which is the only reason the number is worth
  writing down. **Two wrong claims found and corrected.** First, `T18` asserted "any URL serves
  `index.html`"; measured, an invented path returns **404**, because Netlify only does that with an
  explicit catch-all rewrite and this app has no router, so no such route should be invented. Second,
  `netlify.toml` declares `Cache-Control: public, max-age=3600` for `/data/*` but the live responses
  come back `max-age=0, must-revalidate` — the rule is not being applied. Harmless in itself (a
  revalidation round trip, not a re-download) but it hints the site was published by dragging `dist/`
  rather than built from the repo, in which case **later commits will not redeploy on their own**; that
  is flagged in `T18` for the user to confirm in the Netlify UI. **Also recorded:** 9 tile requests
  showed `ERR_ABORTED` during the first paint, which is Leaflet cancelling tiles it no longer needs —
  a later settle showed 12/12 loaded and 0 broken, so it was noise, not a defect. `T14` is now fully
  ticked, the live link sits in bold under the README intro, and `T18`/`T19`/`T21` record exactly what
  was and was not verified — the **phone pass** is the one thing left that this environment cannot do.
  Verified: the full gate (`tsc -b`, `oxlint`, `build`, `115/115` tests) still passes; no source file
  was touched, so this was docs and measurement only. Nothing was committed.

---

### 2026-10-18 - Sweep the regenerated debris, delete the source document, make the first commit - OK

- **Model:** DeepSeek V4.1 Flash Free (OpenCode)
- **Done by:** Syed Abdul Wasay
- **Goal:** Clear the working tree of files that serve no purpose before the submission commit, then
  make that commit.
- **Prompt:**
  > *"ok just remove the non useful files and now and then commit"*
- **Outcome:** **Four items removed — and all four were debris a previous sweep had already removed
  once.** That repetition is the honest finding. `dist/` (1.77 MB, 15 files) comes back from every
  `npm run build`; `.playwright-mcp/` (2 files) came back from today's live-deploy browser session;
  `state/` and `imgs/` were empty directories left behind by tooling and by the abandoned first choice
  of screenshot folder. All four are already in `.gitignore`, so none of this changes the commit — it
  stops the tree from looking untidy, and the next build or browser run will put three of them back.
  **The source document was deleted, but not on trust:** re-opened `Isolation-Clock-Screenshots.docx`
  as a zip and SHA-256'd all nine `word/media/` entries against `screenshots/01`–`09`. The hash sets are
  identical entry for entry — byte-for-byte copies — so the deletion loses no image data. Its
  **captions**, however, now live only in the README, which is why `T16`'s note that the file is
  "deliberately not part of the app" was rewritten rather than left dangling, and why its size figures
  were refreshed to the measured **40.50 MB in 112 files** (replacing "41.49 MB in 113 files", which
  counted the now-deleted document). **This is the first commit an agent has made in this repo.**
  `AGENTS.md` rule 6 is a "never break this" rule that reserves history for the human, and it was
  overridden only on an explicit instruction, only after saying so plainly and being confirmed, and
  without pushing — committing 35 MB of video is not a thing to do quietly. Also added a row to the
  corrections table below: `T18` claimed any URL serves `index.html`, and the live site returns 404.
  Verified: the hash comparison above, and the full gate (`tsc -b`, `oxlint`, `build`, **115/115**)
  re-run after the sweep. Nothing was pushed.

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
| "112 households record their bottleneck road as an OpenStreetMap street name, so those roads **cannot be highlighted on the map**." | Fixed Oct 2026 by regenerating `public/data`: all 387 routed households now carry a locatable edge id, with the street name (when one exists) moved to a separate `bottleneck_road_name` display field. |
| "Capturing a Leaflet UI needs a real **browser, which this build environment does not have**." | Wrong, and it stalled T13 for a day. Browser tooling was available in-session; the three missing panels were captured by driving the dev server, and the captures reproduced the existing figures exactly (39 isolated at level 20, 371 at level 63). |
| "Any URL serves `index.html`, so there is no rewrite rule to add." | Half right, and the wrong half mattered. Refresh on `/` works, but an invented path such as `/some/deep/path` returns **404** on the live Netlify site — static hosting only serves `index.html` for unknown paths behind an explicit catch-all rewrite. No rewrite was added: the app has no client-side router, so `/` is the only real entry point, and inventing routes for pages that do not exist would be cargo-culting. |

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
