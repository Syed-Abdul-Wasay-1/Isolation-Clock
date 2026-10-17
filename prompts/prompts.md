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

---

## Corrections to earlier drafts

Kept on purpose: the rules ask us to be explicit about behaviour, and an honest log is worth more
than a flattering one.

| Earlier claim | Reality |
|---|---|
| "The heavy graph sweep runs in a **Web Worker**." | Not built. All computation is precomputed in Python; the browser only converts isolation levels to ETI. `src/workers/` is empty. |
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
- **Goal:** <what you were trying to achieve>
- **Prompt:**
  > *"<the actual prompt text>"*
- **Outcome:** <what you got, what you kept, what you changed and why>
-->
