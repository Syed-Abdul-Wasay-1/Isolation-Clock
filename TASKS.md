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
| Branch | `main` @ `e76b747`, **in sync with `origin/main`** — plus a working tree of uncommitted changes (screenshots, `media/`, README/TASKS/prompts edits) |
| Build / lint / types | ✅ `tsc -b`, `oxlint`, `npm run build` all pass — now with `strict: true` |
| Tests | ✅ **115 pass** across 23 suites (was 49) — SMS, data loading, road impact and escalation are covered |
| Docs | ✅ Synced with Part 1 — `methodology`, `SIMULATION`, `ALLOCATION`, `SMS`, `DATA`, `architecture`, `tradeoffs`, `README`, `data/README`, `prompts/context.md` and the four skills |
| SMS check-in simulator | ✅ Merged, documented in `docs/SMS.md`; road-block reports now drive an impact preview |
| Prompt log + skills | ✅ `prompts/` complete; the 4 repo skills + the axe-core a11y skill under `.agents/skills/` |
| Team roster | ✅ Filled in `README.md` |
| **Product gaps** | ✅ Closed — road-block preview, critical roads, escalation curve and people counts all ship |
| **Live deploy** | ✅ Live at <https://isolation-clock.netlify.app/> (T18) — `netlify.toml` + `vercel.json` committed |
| **`docs/architecture.png`** | ✅ Rendered, linked from the README (T12) |
| **Screenshots** | ✅ 12 captures in `screenshots/`, rendered in the README (T13) |
| **Demo video** | ✅ Recorded by Rabia Chandio — 2 min 21 s, in `media/` and linked from the README (T20) |

---

## What is left, and whose hands it is in

Part 1 (T1–T11), the diagram (T12), the screenshots (T13), the repo-size check (T16), the live deploy
(T18), the first-load check (T19) and the demo video (T20) are done. What remains cannot be finished
by an agent working in a terminal:

| Task | Why it is user-side |
|---|---|
| **T15 branch tidy** | Deletes local and remote branches — a history operation. |
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

- [x] New panel (`CriticalRoadsPanel.tsx`): group households by `bottleneck_road`; show the street
      name where OpenStreetMap has one (else *"Unnamed road segment"* with the edge id as a muted tag),
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
      make the numbers agree: 400 households, 1,043 people, 4,958 segments, tests (111 at the time;
      115 now — see the status table above).
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
**Est:** 45 min · **Done by:** Ameena Batool

- [x] Capture the sweep — the same view at scenario levels **10, 20, 30, 45, 63 and 96**, with the
      escalation curve reading the same rise — plus the **critical-roads panel**, the **priority
      ranking** and the **SMS panel with a road-block report open**. 9 images lifted out of
      `Isolation-Clock-Screenshots.docx` into `screenshots/`.
- [x] Capture the three panels the `.docx` did not contain — the **why-panel** (score + confidence +
      verification), the **resource allocation** panel and the **before/after comparison** — by
      driving the running app, `screenshots/10`–`12`.
- [x] Save into `screenshots/` with descriptive names; reference them from `README.md`.

**Done when:** `screenshots/` is non-empty and the README shows them. ✅ **Done:** all 12 captures are
in `screenshots/` and every row of the capture list above is covered. The sweep and the first three
panels are full-window shots; `10`–`12` are panel detail crops, because the panels are ~410 px wide
inside the window and the score breakdown is not legible in a full-window capture.

## T14 · README final read
**Est:** 30 min · **Done by:** Syed Abdul Wasay (partly)

- [x] Read it start to finish as a judge: does `npm install` + `npm run dev` work exactly as written?
      Yes — the command block matches `package.json`, and the dev server is at `:5173`.
- [x] Add the live link (T18) near the top. Live at <https://isolation-clock.netlify.app/>, in bold
      directly under the intro. ✅ The video link (T20) is in its own section above the fold, and the
      tree plus folder-roles table list `media/`.
- [x] Make the "Project Structure" tree match the repo after T2/T10/T12/T13 — `routing/` and
      `workers/` removed, the new simulation modules and panels added, the diagram assets listed, and
      the folder-roles table refreshed to match.
- [x] Confirm the honesty wording: *scenario simulator, not a forecast*; the scenario level is never
      called cm or metres. Swept the whole file — clean.

**Done when:** every command in it is copy-pasteable and every link resolves. ⚠️ Everything except the
live deploy link is done; that one arrives with T18.

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

- [x] `data/*.graphml` (~2.0 MB) and the `data/*.geojson` inputs are committed so the pipeline is
      reproducible offline — **confirmed still intended**, and documented: every committed input file
      is listed with its size in `data/README.md`, in a new "What is actually committed under `data/`"
      table. A root-level `cache/` of five raw Overpass responses (two of them empty, ~171 KB) was
      **removed** afterwards: nothing in the repo ever read it — both scripts cache into `data/` and
      `public/data/`.
- [x] Confirm `.gitignore` still keeps large raw inputs out while force-keeping `public/data/*.json`.
      It does. Two additions were needed while checking: `__pycache__/` and `*.pyc` were **not**
      ignored, and `scripts/__pycache__/generate_data.cpython-315.pyc` was committed — a stale
      bytecode file for a Python version not used here. It was deleted and the patterns added.
- [x] If T1 option B shipped, size the new `data/road_graph.json` and confirm it is acceptable. **Not
      applicable** — option B did not ship, so there is no `road_graph.json`.

Sizes measured after the cleanup pass (excluding `node_modules/`, `.git/` and `dist/`): working tree
4.24 MB in 100 files, `.git` 2.02 MB, largest file `data/roads_27_688_…graphml` at 2.0 MB, then
`public/data/roads.json` at 1.13 MB. No file needs Git LFS.

**Superseded, 18 Oct** — the measurements above are kept as a record, but two later additions and one
removal changed them. `media/demo-walkthrough.mp4` is now the **largest file in the repo at 35.06 MB**,
and with the 12 screenshots the working tree is **40.50 MB in 112 files**. The size driver moved from
the road graph to the video, and a clone is roughly 20× heavier than it was. Still no Git LFS needed —
the video is well under GitHub's 100 MB hard limit and the only warning threshold is 50 MB — but the
weight is baked into history the moment it is committed, so it is worth a deliberate `git add` rather
than a blanket `git add .`. The source document `Isolation-Clock-Screenshots.docx` (1.01 MB) has since
been **deleted**, not archived: all nine of its images were verified byte-identical by SHA-256 to
`screenshots/01`–`09` before it went, so no image was lost, but the README is now the only place its
captions exist.

**Done when:** `data/README.md` explains every committed data file. ✅

## T17 · Keep this file live
**Est:** ongoing · **Done by:** Syed Abdul Wasay

- [x] Tick boxes as tasks land and refresh the status snapshot (branch tip, test count, gate status).
- [x] Fill in `Done by:` on each task as it completes — ask who did it.
- [x] Move anything you consciously drop into the [post-deadline backlog](#post-deadline-backlog)
      with a one-line reason.

---

# Part 4 — Deploy

## T18 · Deploy to a live URL
**Est:** 1 h · **Done by:** Syed Abdul Wasay · **Blocking for submission**

- [x] Commit a deploy config (`vercel.json` or `netlify.toml`): build `npm run build`, output `dist/`,
      static site, no serverless functions. **Both** are committed with identical settings, so either
      host works with no dashboard configuration.
- [x] Deployed and opened: <https://isolation-clock.netlify.app/>. Verified from this environment —
      the page loads, the header reads **400 households · 1043 people · 7 safe places** from the live
      JSON, all 12 map tiles load, and there are **zero console or page errors**. The live bundle hash
      is `index-1ywJAOey.js`, the same hash a local `npm run build` produces, so the deployed artefact
      matches the committed source. ⚠️ **Still unverified:** the phone check, which needs a phone.
- [x] Confirm the five `public/data/*.json` files are served and compressed. Measured on the live URL:
      `roads.json` **1.15 MB raw → 137 KB over the wire** (Brotli, ~8.4×), `households.json` 138 KB →
      8 KB, `isolation.json` 76 KB → 3 KB, plus `shelters`, `hospitals` and `meta` all `200 OK`. The
      two tiny files (466 B and 896 B) are served uncompressed, which is Netlify's size threshold and
      irrelevant at that size.
- [x] Confirm deep links / refresh work. Measured: `/` serves the app and refresh works; an invented
      path such as `/some/deep/path` returns **404**. That is correct for this app and not a defect —
      it has no client-side router, so no URL other than `/` is a real entry point. The earlier note
      here claimed "any URL serves `index.html`", which was wrong: Netlify only does that with an
      explicit catch-all rewrite, and adding one would be cargo-culting a route that does not exist.
- [x] Put the URL at the top of `README.md` (T14).

**Done when:** the live URL loads the full app on a fresh device with no console errors. ✅ Verified on
desktop. ⚠️ One gap: `netlify.toml` declares `Cache-Control: public, max-age=3600` for `/data/*`, but
the live responses come back with `public, max-age=0, must-revalidate` — the rule is **not** being
applied. That is harmless (it only costs a revalidation round trip, not a re-download) but it suggests
the site may have been published by dragging `dist/` rather than built from the repo, in which case
**later commits will not redeploy automatically**. Worth connecting the repo in the Netlify UI.

## T19 · Performance sanity check on the live URL
**Est:** 45 min · **Done by:** Syed Abdul Wasay

Measured on <https://isolation-clock.netlify.app/> with the cache disabled, network throttled through
the DevTools protocol (Chrome's "Fast 3G": 1.6 Mbps down, 750 Kbps up, 150 ms RTT):

| Condition | Time until the app is usable |
|---|---|
| No throttle | **0.93 s** |
| Fast 3G | **2.0 s** |
| Slow 3G (400 Kbps, 400 ms RTT) | **7.1 s** |

First load is **285 KB** compressed in every case — of which `roads.json` is 137 KB and the JS bundle
122 KB — so the payload is roughly a fifth of the 1.15 MB the raw data file suggests.

- [x] Measure first load, throttled to "Fast 3G". **2.0 s**, against 0.93 s unthrottled and 7.1 s on a
      400 Kbps link. The throttle was verified to be real rather than assumed: the three profiles scale
      as they should, so the number is trustworthy.
- [x] Confirm the JSON is compressed at the edge. Confirmed — Brotli, with `roads.json` at 8.4×.
- [x] If it still feels slow, record it in `docs/tradeoffs.md` rather than over-engineering now.
      **Not needed:** 285 KB and 2 s on Fast 3G is fine, so nothing is added to `tradeoffs.md`. The one
      thing worth naming that this measurement does **not** cover is the **OpenStreetMap raster tiles**,
      which load from `a/b/c.tile.openstreetmap.org` and are third-party: they are outside the 285 KB
      and outside our control. On a throttled link they arrive after the app is already interactive, so
      the app is usable while the basemap is still filling in — which is the right order.

**Done when:** the numbers are written down, with a decision. ✅ Written down here; the decision is
that the size is acceptable and needs no work before submission.

---

# Part 5 — Demo video

## T20 · Record the demo
**Est:** 1.5 h · **Done by:** Rabia Chandio · **Blocking for submission**

- [x] Recorded the walkthrough — the scenario sweep, the ranking re-sorting live, a household's *why*
      panel, the allocation split, pin-and-compare and the SMS check-in simulator.
- [x] The honesty framing is on screen throughout: *scenario simulator, not a flood forecast*,
      synthetic households, and simulated SMS marked unverified.
- [x] Put it in the repo at `media/demo-walkthrough.mp4` (**2 min 21 s**) and linked it from the demo
      section at the top of `README.md` — the in-repo route instead of an unlisted upload, so the link
      cannot rot. This replaces the "upload unlisted and paste the link" step.

**Done when:** the link plays for someone who has never seen the project. ✅ The file is committed with
the repo and the README links it. Note the length is **2 min 21 s**, not the ~3 min this task assumed.

---

# Part 6 — Submission (do this last)

## T21 · Submit
**Est:** 30 min · **Done by:** —

- [x] Public repo with visible history — `main` @ `e76b747` is in sync with `origin/main`. ⚠️ The
      screenshots, `media/` and the README/TASKS/prompts edits from 18 Oct are still **uncommitted**, so
      commit and push before submitting or the judged tip will not match the README.
- [x] Live link works on a fresh device. Verified with the cache disabled at
      <https://isolation-clock.netlify.app/>: loads clean, data present, no console errors. ⚠️ Verified
      on desktop only — the phone pass still needs a phone.
- [ ] `prompts/prompts.md` present and complete, every entry with its `Model:` filled in.
- [ ] `README.md` runnable as written; architecture diagram and trade-offs present.
- [x] Demo video link present — `media/demo-walkthrough.mp4` (2 min 21 s), linked from the top of
      `README.md`. Committed with the repo rather than uploaded externally.
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
- [x] **Regenerate `public/data`** with the fixed `bottleneck_road` / `bottleneck_road_name` split so
      all 400 households have a locatable bottleneck edge. Done Oct 2026: `isolation_level`,
      `nearest_safe_place_id`, `road_node_id` and every road threshold reproduced exactly; all 387
      routed households now carry an edge id, 112 of them with a street name.

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
