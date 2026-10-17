# TASKS.md — Isolation Clock · remaining work, in order

> **The single source of truth for what is left to do.** Work top to bottom. Submission is **last**.
> Read [`AGENTS.md`](AGENTS.md) first — it has the ground rules, the model invariants and the
> verification gate.
>
> **Deadline: 18 Oct 2026, 22:00 PKT.** Late submissions are not evaluated.

## How to use this file

- Tasks are numbered **T1 … T22 in the order to do them**. Do not skip ahead to the submission
  tasks; the product work comes first.
- Tick boxes as you go and keep the [status snapshot](#status-snapshot) current.
- **No task is pre-assigned to anyone.** Do not write an owner. When a task is finished, the AI
  **asks who did the work** and records that name in the task's `Done by:` line and in the matching
  `prompts.md` entry. It never guesses a name.
- **Every code task (T1–T11) is only done when all five of these are true:**
  1. The change is implemented in the surrounding style.
  2. `npx tsc -b`, `npx oxlint`, `npm run build` and `npm test` all pass.
  3. Every affected doc under `docs/` (and `README.md` / `data/README.md`) is updated, and no doc
     claims a feature that does not exist.
  4. A new entry is added to `prompts/prompts.md`, with `Done by:` naming the person who did the
     work — ask them, do not guess.
  5. Nothing is committed or pushed by an agent — the user reviews the working tree and commits.

## Status snapshot (as of 17 Oct 2026)

| Area | State |
|---|---|
| Branch | `main`, ahead of `origin/main` — Part 1 changes are **in the working tree, uncommitted** |
| Build / lint / types | ✅ `tsc -b`, `oxlint`, `npm run build` all pass — now with `strict: true` |
| Tests | ✅ **111 pass** across 22 suites (was 49) — SMS, data loading, road impact and escalation are covered |
| Docs | ✅ Synced with Part 1 — `methodology`, `SIMULATION`, `ALLOCATION`, `SMS`, `architecture`, `tradeoffs`, `README`, `data/README`, `prompts/context.md` |
| SMS check-in simulator | ✅ Merged, documented in `docs/SMS.md`; road-block reports now drive an impact preview |
| Prompt log + skills | ✅ `prompts/` complete, 4 repo skills under `.agents/skills/` |
| Team roster | ✅ Filled in `README.md` |
| **Product gaps** | ✅ Closed — road-block preview, critical roads, escalation curve and people counts all ship |
| **Live deploy** | ❌ Not deployed; no deploy config committed yet (T18, needs an account) |
| **`docs/architecture.png`** | ✅ Rendered, linked from the README (T12) |
| **Screenshots** | ❌ `screenshots/` is empty — needs a browser (T13) |
| **Demo video** | ❌ Not recorded (T20) |

---

## What is left, and whose hands it is in

Part 1 (T1–T11), the diagram (T12), the repo-size check (T16) and the deploy **config** (T18) are
done and gated. What remains cannot be finished by an agent working in a terminal:

| Task | Why it is user-side |
|---|---|
| **T13 screenshots** | Needs a real browser to capture the Leaflet UI. |
| **T15 branch tidy** | Deletes local and remote branches — a history operation. |
| **T18 deploy** | Needs a Vercel/Netlify account. The config is committed and does not need touching. |
| **T19 perf check** | Needs the live URL from T18. |
| **T20 demo video** | Needs a person to record it. |
| **T21 / T22 submit + verify** | Yours. |
| **Who did what** | Each task's `Done by:` is filled from the answer to that question, never guessed. |

---

## Estimates and cut list

Each task carries an estimate for one person. The order below is a sequence, not a strict
serialisation, but **T1 must land before T2/T3** so the road model is stable.

You have roughly one working day. If you run short, cut in this order (they are the least
load-bearing): **T9 → T10 → T4 → T3**. Never cut T1, T5, T11, T18, T20 or T21.

---

# Part 1 — Fix the product (do these first, in this order)

## T1 · Close the loop on road-blocked SMS reports
**Est:** 3 h · **Done by:** Syed Abdul Wasay · **Priority: highest**

Today an SMS `3` is recorded and displayed but changes nothing
(`IsolationClockPage.tsx:241` — *"the simulation is unchanged until confirmed"*). That is the most
natural action in the whole app and it is a dead end. Two possible versions — **do A, treat B as
stretch**:

**A. Impact preview from the precomputed bottleneck (recommended). ✅ implemented**
- [x] Let a road-block report be associated with a road edge: default it to the reporting
      household's own `bottleneck_road`, and allow picking from the road edges near that household.
      (`RoadBlockReport.edgeId`, `setRoadBlockEdge`, `findNearbyRoadEdges`.) When the household's
      recorded bottleneck is a street name it cannot be located, so the default is `null` and the
      user picks from the nearby list.
- [x] When a report has an edge, compute the **dependants**: every household whose
      `bottleneck_road` equals that edge (`getRoadDependants` in `src/simulation/roadImpact.ts`).
- [x] Show it: *"Closing this road cuts off the only modelled route for N households (M people)."*
      Dependants are highlighted on the map and listed in the SMS panel.
- [x] Add a "closed" flag per edge and render those segments in a distinct style (dashed purple,
      "Reported blocked (unverified)").
- [x] **Label it honestly:** this is an *impact preview based on each household's recorded
      bottleneck road*, **not** a re-simulation of `isolation_level`. Said in the UI, in
      `docs/SMS.md` and in `docs/methodology.md`. No ETI moves.
- [x] Update `docs/SMS.md` (the `3` row) and `docs/methodology.md`.

**B. Stretch — real re-simulation.** Requires shipping the road graph and running widest-path
(maximin) in the browser. This is what `src/routing/` would have been for; the folder has been
deleted (see T10) because version B was not built.
- [ ] Add `data/road_graph.json` (nodes + edges + `threshold`) to the pipeline output. **Not done.**
- [ ] Implement widest-path maximin in `src/routing/` and recompute `isolation_level` with the
      closed edge removed. **Not done — post-deadline backlog.**
- [ ] Only attempt this if A is done and deployed. It is a feature build, not a tweak.

**Done when:** reporting a blocked road visibly shows its dependants, and both the UI copy and
`docs/SMS.md` are explicit that it is a preview (A) or a genuine recompute (B).

## T2 · Critical-roads panel
**Est:** 2 h · **Done by:** Syed Abdul Wasay

`bottleneck_road` is precomputed for all 400 households but today is shown for the selected
household only (`WhyRankPanel.tsx:216`). Aggregate it.

- [x] New panel (`CriticalRoadsPanel.tsx`): group households by `bottleneck_road`; show the road id,
      the count of households and people that depend on it, and the safe place(s) it serves.
- [x] Sort by households descending; clicking a row highlights that road on the map. The "scroll the
      ranking to its top household" part is implemented as an **"Open top household"** button inside
      the row, which selects it (and therefore scrolls the ranking) — a plain click is kept for the
      map focus only, so one click does one thing.
- [x] Show it for the **current scenario level**, with a note that households already isolated are
      counted separately.
- [x] Put the aggregation in `src/simulation/` (`roadImpact.ts`), not in the component, and add tests
      (`tests/roadImpact.test.ts`).
- [x] Update `docs/architecture.md` and `docs/methodology.md` with the new panel and function.

**Done when:** you can answer "which single road, if it fails, isolates the most people?" in the app.

## T3 · Escalation curve — make the clock a clock
**Est:** 2 h · **Done by:** Syed Abdul Wasay

Per-household ETI exists; a cumulative curve does not. This is what makes it read as a *clock*.

- [x] Pure function: for hours `h = 0 … 10`, the scenario level is `level + riseRateDefault × h`,
      capped at 100; a household is isolated once `isolation_level ≤` that level. Counts households
      **and people** at each hour. (`getEscalationCurve` / `ESCALATION_HOURS` in `escalation.ts`.)
- [x] Render a clickable bar-per-hour chart (`EscalationCurvePanel.tsx`), with the current hour marked
      and the cumulative households/people above it.
- [x] Clicking an hour jumps the scenario slider to that level.
- [x] State plainly in the UI that the rise rate is the illustrative `rise_rate_default`, not a
      measured flood rate.
- [x] Tests for the cumulative function (monotonic, hour 0 == currently isolated): `tests/escalation.test.ts`.
- [x] Update `docs/methodology.md` and `docs/SIMULATION.md`.

**Done when:** a judge can see "at +3 h, N households / M people are cut off" without moving the
slider.

## T4 · Count people, not just households
**Est:** 1 h · **Done by:** Syed Abdul Wasay

`household_size` is in the data but every headline counts households, which understates scale.

- [x] Show people alongside households wherever a total is shown: ranking header, allocation panel,
      the T2/T3 panels, the map summary, the before/after panel and the README.
- [x] Handle `household_size` null explicitly (unknown size → count the household, flag it) rather
      than silently treating it as 1 (`countPeople` in `population.ts`).
- [x] Update `README.md` where totals are quoted.

**Done when:** no headline says a bare household count when the people count is available.

## T5 · Tests for `smsCheckins.ts`
**Est:** 1.5 h · **Done by:** Syed Abdul Wasay

The SMS module has **no tests** while the other three simulation modules do.

- [x] `getEffectiveHousehold`: applies a `2` (needs help) and a `4` (fills a missing medical need
      but never overwrites a known value).
- [x] A `3` produces a `RoadBlockReport` and leaves the household record unchanged.
- [x] `reportedFields` marks exactly the fields the check-ins supplied.
- [x] The offline queue applies messages in order when the toggle is turned off.

**Done when:** `tests/smsCheckins.test.ts` exists and passes. ✅ (13 cases)

## T6 · Tests for data loading
**Est:** 1 h · **Done by:** Syed Abdul Wasay

`useStudyData.ts` validation is untested — it was parked in this file's old backlog. The validation
was extracted into the pure `src/hooks/studyDataValidation.ts` so it is testable without a DOM.

- [x] Malformed JSON → the error state, not a crash.
- [x] A household with no matching `isolation` record → the "missing household" error.
- [x] A non-finite / non-positive `rise_rate_default` → the invalid-structure error.

**Done when:** the loader's error paths are covered. ✅ (`tests/studyDataValidation.test.ts`, 8 cases)

## T7 · Tests for the new panels' logic
**Est:** 1 h · **Done by:** Syed Abdul Wasay

- [x] Cases for the T2 aggregation (ties, a household with `bottleneck_road: null`).
- [x] Cases for the T3 cumulative curve (monotonic, hour 0 equals the current isolated set).
- [x] Case for T1's dependants helper (an edge no household depends on → empty, not an error).

**Done when:** the Part 1 pure functions all have tests. ✅

## T8 · Performance: stop re-rendering every road segment per tick
**Est:** 1.5 h · **Done by:** Syed Abdul Wasay

`IsolationMap.tsx` re-renders all ~4,958 road polylines on every playback tick, which is visible
jank on a 20 s sweep.

- [x] Profile first (React DevTools) and write down the actual frame cost — do not guess.
      **Could not do this:** the build environment has no browser, so a real React DevTools profile
      was impossible. What was measured instead, in Node against the shipped dataset, is below; the
      numbers are honest about what they are (JS classification cost, not frame time).
- [x] Pick the cheapest effective fix and record the before/after. Chosen: **group the roads into a
      handful of style-grouped polylines** (`buildRoadClusters`) instead of one `<Polyline>` per
      segment. Keeps the SVG renderer and the exact same colours, and drops the element count from
      ~4,958 to ~4 per render.
- [x] Do **not** change the visual result — the same segments are the same colour at the same levels
      (only the grouping changed, and the legend is unchanged apart from two new keys for the T1/T2
      overlays).
- [x] If a fix costs more than it gains, stop and note it in `docs/tradeoffs.md` — recorded there.

Measured on this machine (Node v24.14.1) against `public/data/roads.json` (4,958 segments):
a full pass that classifies every segment against the scenario level costs **≈0.15 ms**, so the
per-tick classification is negligible; the cost that mattered was the ~4,958 React elements and
Leaflet layers, which the clustering removes. **Browser frame timings were not captured.**

**Done when:** playback is smooth at 1×/2× and the profile numbers are recorded. ⚠️ Structurally
done and gated, but the frame numbers could not be verified in this environment — see T19, which
checks the real thing on the deployed URL.

## T9 · Optional model upgrades (only if time remains)
**Est:** 2–4 h each · **Done by:** Syed Abdul Wasay

Each of these needs its own doc update, and each must stay within the honesty rules.

- [x] **Hospital allocation.** `matchResources` now receives **shelters and hospitals** as
      destinations, because the isolation model already routes households to both — shipping an
      allocation that ignored hospitals made the two panels contradict each other. `SafePlace.kind`
      is stamped at load time; `docs/ALLOCATION.md` updated; tests added. Medical-need households are
      **not** given hospital priority: that is a policy call we did not invent.
- [ ] **Route-based allocation distance.** Replace the straight-line Haversine with the routed
      network. **Deferred:** the app does not ship the road graph (see T1 option B), so this cannot be
      done honestly without shipping the graph first.
- [ ] **Per-road rise rate.** ETI currently uses one global `rise_rate_default`. **Deferred:** the
      offline pipeline would have to derive a per-road rate, and there is no measured rate to derive
      it from — it would be inventing numbers.
- [ ] **Sensitivity band.** `docs/idea.md` point 5 — a ±margin re-rank. **Deferred, and still
      explicitly not built.** `docs/methodology.md`, `docs/SCORING.md` and `AGENTS.md` §2 all say so.

**Done when:** either shipped with docs + tests, or consciously left in the backlog below. ✅ —
one shipped (hospital allocation), three consciously left in the post-deadline backlog with reasons.

## T10 · Decide the empty placeholder folders
**Est:** 15 min · **Done by:** Syed Abdul Wasay

`src/routing/` and `src/workers/` contain only `.gitkeep`.

- [ ] If T1 option B shipped, `src/routing/` is now real — document it. **It did not ship.**
- [x] Otherwise delete both folders: routing is offline in `scripts/`, and there is no worker.
- [x] Whichever you choose, `docs/architecture.md` must not describe a folder that is empty — the
      "reserved, unused folders" note is gone and the component table no longer lists them.

**Done when:** no folder exists that the docs cannot explain, and `AGENTS.md` §2 stays true
(no Web Worker, no service worker). ✅

## T11 · Docs sync for everything added in Part 1
**Est:** 1 h · **Done by:** Syed Abdul Wasay

- [x] Walk `docs/` and fix every statement that Part 1 changed: `methodology.md` (new §6 on the road
      views + people counts), `SIMULATION.md` (road-block reports change nothing), `ALLOCATION.md`
      (hospitals as destinations), `SMS.md` (the `3` path drives an impact preview),
      `architecture.md` (new modules, new panels, no empty folders), `tradeoffs.md` (new decisions and
      the new limitations). `SCORING.md` and `assumptions.md` needed no change — Part 1 did not touch
      the score or add an assumption.
- [x] Update `docs/README.md`'s index for any new doc, and `README.md`'s feature list — a new
      "What's in the app" table was added, and the structure tree and folder table were refreshed.
- [x] Grep the whole repo for any figure you changed (counts, max score 95, `rise_rate_default`) and
      make the numbers agree: 400 households, 1,043 people, 4,958 segments, 111 tests.
- [x] One `prompts/prompts.md` entry per Part 1 task, each with `Model:` and `Done by:` filled in.

Two extra drift fixes found while syncing:
- `tsconfig.*.json` did **not** set `strict`, although `AGENTS.md` and `prompts/context.md` both
  claimed strict TypeScript. Rather than weaken the docs, `"strict": true` was added to all three
  configs — `tsc -b` passes cleanly, so the claim is now true.
- `scripts/__pycache__/generate_data.cpython-315.pyc` was committed. It is bytecode for a Python
  version not used here; it was deleted and `__pycache__/` + `*.pyc` were added to `.gitignore`.

**Done when:** no doc contradicts the shipped code, and every Part 1 task has a prompt-log entry. ✅

---

# Part 2 — Presentation artifacts

## T12 · Render `docs/architecture.png`
**Est:** 1 h · **Done by:** Syed Abdul Wasay

- [x] Draw the real data flow: offline pipeline (`scripts/`) → `public/data/*.json` →
      `useStudyData` → `src/simulation/` → components → page state.
- [x] Include the SMS override path and each Part 1 panel.
- [x] Export to `docs/architecture.png`, link it from `README.md`, and delete the two
      "still to be rendered" notes. The diagram is authored as a hand-written, diffable
      `docs/architecture.svg` and rasterised to a 2× `docs/architecture.png`; both are committed.

**Done when:** the README renders the diagram and no text calls it pending. ✅

## T13 · Screenshots
**Est:** 45 min · **Done by:** —

- [ ] Capture: the map mid-sweep; the ranking with a selected household; the why-panel (score +
      confidence + verification); the allocation panel; the escalation curve; the critical-roads
      panel; the SMS panel with a road-block report open; and the before/after comparison.
- [ ] Save into `screenshots/` with descriptive names; reference them from `README.md`.

**Done when:** `screenshots/` is non-empty and the README shows them. ⚠️ **Blocked:** capturing a
Leaflet UI needs a real browser, which this build environment does not have. User-side — open the dev
server, take the shots, drop them in `screenshots/`.

## T14 · README final read
**Est:** 30 min · **Done by:** Syed Abdul Wasay (partly)

- [x] Read it start to finish as a judge: does `npm install` + `npm run dev` work exactly as written?
      Yes — the command block matches `package.json`, and the dev server is at `:5173`.
- [ ] Add the live link (T18) and the video link (T20) near the top. **Blocked on T18/T20.**
- [x] Make the "Project Structure" tree match the repo after T2/T10/T12/T13 — `routing/` and
      `workers/` removed, the new simulation modules and panels added, the diagram assets listed, and
      the folder-roles table refreshed to match.
- [x] Confirm the honesty wording: *scenario simulator, not a forecast*; the scenario level is never
      called cm or metres. Swept the whole file — clean.

**Done when:** every command in it is copy-pasteable and every link resolves. ⚠️ Everything except the
two external links is done; those two arrive with T18 and T20.

---

# Part 3 — Repo hygiene

## T15 · Tidy branches and refs
**Est:** 15 min · **Done by:** —

- [ ] `ameena`, `wasay` and `rabia-v1` are all merged into `main` — delete the local and remote
      branches.
- [ ] Local-only tag `archive/rabia-b4bc175` — keep as insurance or `git tag -d` it. It is not
      pushed.

**Done when:** `git branch -a` shows only what is live, and the history is still legible.

## T16 · Repo size check
**Est:** 20 min · **Done by:** Syed Abdul Wasay

- [x] `data/*.graphml` (~2.0 MB), the `data/*.geojson` inputs and `cache/*.json` are committed so the
      pipeline is reproducible offline — **confirmed still intended**, and now documented: every
      committed input file is listed with its size in `data/README.md`, in a new "What is actually
      committed under `data/`" table.
- [x] Confirm `.gitignore` still keeps large raw inputs out while force-keeping `public/data/*.json`.
      It does. Two additions were needed while checking: `__pycache__/` and `*.pyc` were **not**
      ignored, and `scripts/__pycache__/generate_data.cpython-315.pyc` was committed — a stale
      bytecode file for a Python version not used here. It was deleted and the patterns added.
- [x] If T1 option B shipped, size the new `data/road_graph.json` and confirm it is acceptable. **Not
      applicable** — option B did not ship, so there is no `road_graph.json`.

Sizes measured: working tree under 4 MB, `.git` 1.1 MB, largest file `public/data/roads.json` at
1.15 MB. No file needs Git LFS.

**Done when:** `data/README.md` explains every committed data file. ✅

## T17 · Keep this file live
**Est:** ongoing · **Done by:** Syed Abdul Wasay

- [ ] Tick boxes as tasks land and refresh the status snapshot (branch tip, test count, gate status).
- [ ] Fill in `Done by:` on each task as it completes — ask who did it.
- [ ] Move anything you consciously drop into the [post-deadline backlog](#post-deadline-backlog)
      with a one-line reason.

---

# Part 4 — Deploy

## T18 · Deploy to a live URL
**Est:** 1 h · **Done by:** Syed Abdul Wasay (config) · **Blocking for submission**

- [x] Commit a deploy config (`vercel.json` or `netlify.toml`): build `npm run build`, output `dist/`,
      static site, no serverless functions. **Both** are committed with identical settings, so either
      host works with no dashboard configuration. (They are in the working tree, not committed yet —
      the user owns git.)
- [ ] Deploy and open the live URL on a phone as well as desktop. **Needs an account — user-side.**
- [ ] Confirm the five `public/data/*.json` files are served and gzip/brotli-compressed. `roads.json`
      is 1.15 MB raw; both hosts compress by default, but this must be confirmed on the real URL.
- [ ] Confirm deep links / refresh on a sub-path work (`import.meta.env.BASE_URL` handling). The app is
      a single page with no client-side router, so any URL serves `index.html`; a sub-path deploy is
      still worth one manual check because `BASE_URL` is used for every data fetch.
- [ ] Put the URL at the top of `README.md` (T14).

**Done when:** the live URL loads the full app on a fresh device with no console errors.
⚠️ **Blocked on a hosting account.** The config is ready; the deploy itself is user-side.

## T19 · Performance sanity check on the live URL
**Est:** 45 min · **Done by:** —

`public/data/roads.json` is ~1.1 MB raw.

- [ ] Measure first load, throttled to "Fast 3G" in DevTools. **Blocked on T18.**
- [ ] Confirm the JSON is compressed at the edge (Vercel/Netlify do this by default — verify).
- [ ] If it still feels slow, record it in `docs/tradeoffs.md` rather than over-engineering now.

What is already known and recorded in `docs/tradeoffs.md`: the per-tick classification of all 4,958
segments costs ≈0.15 ms in Node, and the map now draws ~4 road layers per render instead of ~4,958.
The remaining unknown is the **first-load** cost of the 1.15 MB JSON, which is a network number and
can only be measured on a real URL.

**Done when:** the numbers are written down, with a decision. ⚠️ **Blocked on a live URL.**

---

# Part 5 — Demo video

## T20 · Record the ~3 minute demo
**Est:** 1.5 h · **Done by:** — · **Blocking for submission**

- [ ] Script it around the live URL, in this order: the problem → drag the scenario slider and watch
      the re-sort → open one household's *why* panel → the allocation panel → pin and compare →
      the new Part 1 panels → the honesty disclaimer.
- [ ] Say the disclaimer out loud: **scenario simulator, not a forecast**; synthetic households;
      real OSM roads; unverified SMS is not evidence.
- [ ] Upload (unlisted) and put the link near the top of `README.md`.

**Done when:** the link plays for someone who has never seen the project.

---

# Part 6 — Submission (do this last)

## T21 · Submit
**Est:** 30 min · **Done by:** —

- [ ] Public repo with visible history — confirm the pushed tip is the one you want judged.
- [ ] Live link works on a fresh device.
- [ ] `prompts/prompts.md` present and complete, every entry with its `Model:` filled in.
- [ ] `README.md` runnable as written; architecture diagram and trade-offs present.
- [ ] Demo video link present.
- [ ] Submit the form well before **18 Oct 2026, 22:00 PKT**.

**Done when:** the submission is in.

## T22 · Verify the submission
**Est:** 15 min · **Done by:** —

- [ ] Screenshot the confirmation.
- [ ] Re-open the submitted live link and repo in a private window and check both as a judge would.
- [ ] Chase nothing new. If a fix is needed, it must be a fix that makes the demo more honest or
      stops it breaking — no new features after T20.

**Done when:** the confirmation is screenshotted and both links check out.

---

# Post-deadline backlog

Consciously not built. `AGENTS.md` says the docs must not claim them until they exist.

- [ ] **Offline support.** Online-only today: the app needs a connection to load and Leaflet pulls
      OSM raster tiles. A service worker plus a tile-free or cached basemap would make it usable on a
      dead network — the real field condition. Needs `docs/architecture.md` and
      `docs/assumptions.md` updates, and `AGENTS.md` §2 currently asserts there is no service worker.
- [ ] **Full road-closure re-simulation** (T1 option B). Needs `data/road_graph.json` plus a
      widest-path (maximin) search in the browser. Skipped because shipping the graph is a real size
      cost and the impact preview already answers the question a coordinator is asking.
- [ ] **Per-road rise rate** for ETI. Blocked on having a measured rise rate to use; inventing one
      would break the honesty rules.
- [ ] **Route-based allocation distance.** Blocked on the same missing road graph as above; today the
      allocator uses straight-line distance and says so.
- [ ] **Medical-need priority for hospital beds.** Deliberately not implemented — it is a policy
      decision, not a modelling detail, and the model should not make it silently.
- [ ] **Config surface.** Expose weights and thresholds as a settings panel instead of constants.
- [ ] **Sensitivity view.** A ±margin re-rank around the scenario level (T9). `AGENTS.md` §2 asserts
      there is no sensitivity band, so this needs that rule changed first.
- [ ] **Regenerate `public/data`** with the fixed `bottleneck_road` / `bottleneck_road_name` split so
      all 400 households have a locatable bottleneck edge (112 currently carry a street name instead).
      Needs Python with `osmnx` / `networkx` / `geopandas`.

---

## Suggested run order for a single day

| Slot | Task |
|---|---|
| 1 | T1 road-block loop |
| 2 | T2 critical roads, T3 escalation curve |
| 3 | T4 people counts, T5–T7 tests |
| 4 | T8 performance, T11 docs sync |
| 5 | T12 diagram, T13 screenshots, T14 README |
| 6 | T15–T17 hygiene |
| 7 | T18 deploy, T19 perf check |
| 8 | T20 video |
| 9 | T21 submit, T22 verify — well before 22:00 PKT |
