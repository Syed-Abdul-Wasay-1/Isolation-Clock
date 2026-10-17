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
- **Every code task (T1–T11) is only done when all five of these are true:**
  1. The change is implemented in the surrounding style.
  2. `npx tsc -b`, `npx oxlint`, `npm run build` and `npm test` all pass.
  3. Every affected doc under `docs/` (and `README.md` / `data/README.md`) is updated, and no doc
     claims a feature that does not exist.
  4. A new entry is added to `prompts/prompts.md`, with `Model: Claude Sonnet 5.5`.
  5. Nothing is committed or pushed by an agent — the user reviews the working tree and commits.

## Status snapshot (as of 17 Oct 2026)

| Area | State |
|---|---|
| Branch | `main` == `origin/main` == `5f9b5d7`, pushed, working tree clean |
| Build / lint / types | ✅ `tsc -b`, `oxlint`, `npm run build` all pass |
| Tests | ⚠️ 49 pass — but only ETI/status, scoring and allocation. **SMS and data loading are untested** |
| Docs | ✅ Match the shipped code — no phantom features |
| SMS check-in simulator | ✅ Merged (Ameena), documented in `docs/SMS.md` |
| Prompt log + skills | ✅ `prompts/` complete, 4 repo skills under `.agents/skills/` |
| Team roster | ✅ Filled in `README.md` |
| **Product gaps** | ❌ Road-block reports are inert; no critical-roads or escalation view; households not people |
| **Live deploy** | ❌ Not deployed, no deploy config committed |
| **`docs/architecture.png`** | ❌ Not rendered |
| **Screenshots** | ❌ `screenshots/` is empty |
| **Demo video** | ❌ Not recorded |

---

# Who does what

| Person | Role | Owns |
|---|---|---|
| **Syed Abdul Wasay** | Lead | Deploy, diagrams, video, repo hygiene, submission |
| **Ameena Batool** | Simulation / routing | The model, scoring, allocation, the test suite |
| **Rabia Chadio** | Frontend / UX | React/Leaflet UI, panels, accessibility, screenshots |

Estimates assume one person on the task. Two people can run different tasks at once — the order
below is a sequence, not a strict serialisation, but T1 must land before T2/T3 so the road model is
stable.

## Budget & cut list

You have roughly one working day. If you run short, cut in this order (they are the least
load-bearing): **T9 → T10 → T4 → T3**. Never cut T1, T5, T11, T18, T20 or T21.

---

# Part 1 — Fix the product (do these first, in this order)

## T1 · Close the loop on road-blocked SMS reports
**Owner:** Ameena (model) + Rabia (UI) · **Est:** 3 h · **Priority: highest**

Today an SMS `3` is recorded and displayed but changes nothing
(`IsolationClockPage.tsx:241` — *"the simulation is unchanged until confirmed"*). That is the most
natural action in the whole app and it is a dead end. Two possible versions — **do A, treat B as
stretch**:

**A. Impact preview from the precomputed bottleneck (recommended).**
- [ ] Let a road-block report be associated with a road edge: default it to the reporting
      household's own `bottleneck_road`, and allow picking from the road edges near that household.
- [ ] When a report has an edge, compute the **dependants**: every household whose
      `bottleneck_road` equals that edge (from `isolationByHousehold`, already loaded).
- [ ] Show it: *"Closing this road cuts off the only modelled route for N households (M people)."*
      Highlight those households on the map and list them in the SMS panel.
- [ ] Add a "closed" flag per edge and render those segments in a distinct style.
- [ ] **Label it honestly:** this is an *impact preview based on each household's recorded
      bottleneck road*, **not** a re-simulation of `isolation_level`. Say that in the UI and in
      `docs/SMS.md`. Do **not** claim the ETI changed.
- [ ] Update `docs/SMS.md` (the `3` row) and `docs/methodology.md`.

**B. Stretch — real re-simulation.** Requires shipping the road graph and running widest-path
(maximin) in the browser. This is the reason `src/routing/` exists.
- [ ] Add `data/road_graph.json` (nodes + edges + `threshold`) to the pipeline output.
- [ ] Implement widest-path maximin in `src/routing/` and recompute `isolation_level` with the
      closed edge removed.
- [ ] Only attempt this if A is done and deployed. It is a feature build, not a tweak.

**Done when:** reporting a blocked road visibly shows its dependants, and both the UI copy and
`docs/SMS.md` are explicit that it is a preview (A) or a genuine recompute (B).

## T2 · Critical-roads panel
**Owner:** Rabia (panel) + Ameena (aggregation) · **Est:** 2 h

`bottleneck_road` is precomputed for all 400 households but today is shown for the selected
household only (`WhyRankPanel.tsx:216`). Aggregate it.

- [ ] New panel (`src/components/`): group households by `bottleneck_road`; show the road id, the
      count of households and people that depend on it, and the shelter/route it serves.
- [ ] Sort by households descending; clicking a row highlights that road on the map and scrolls the
      ranking to its top household.
- [ ] Show it for the **current scenario level**, with a note that households already isolated are
      counted separately.
- [ ] Put the aggregation in `src/simulation/` (a pure function), not in the component, and add
      tests.
- [ ] Update `docs/architecture.md` and `docs/methodology.md` with the new panel and function.

**Done when:** you can answer "which single road, if it fails, isolates the most people?" in the app.

## T3 · Escalation curve — make the clock a clock
**Owner:** Rabia (chart) + Ameena (math) · **Est:** 2 h

Per-household ETI exists; a cumulative curve does not. This is what makes it read as a *clock*.

- [ ] Pure function: for hours `h = 0 … 12`, the scenario level is `level + riseRateDefault × h`;
      a household is isolated once `isolation_level ≤` that level. Count households **and people**
      isolated by each hour.
- [ ] Render a small chart/step line below the ranking, with the current hour marked.
- [ ] Clicking an hour jumps the scenario slider to that level.
- [ ] State plainly in the UI that the rise rate is the illustrative `rise_rate_default` (10), not a
      measured flood rate.
- [ ] Tests for the cumulative function (monotonic, hour 0 == currently isolated).
- [ ] Update `docs/methodology.md` and `docs/SIMULATION.md`.

**Done when:** a judge can see "at +3 h, N households / M people are cut off" without moving the
slider.

## T4 · Count people, not just households
**Owner:** Rabia · **Est:** 1 h

`household_size` is in the data but every headline counts households, which understates scale.

- [ ] Show people alongside households wherever a total is shown: ranking header, allocation panel,
      and the T2/T3 panels.
- [ ] Handle `household_size` null explicitly (unknown size → count the household, flag it) rather
      than silently treating it as 1.
- [ ] Update `README.md` where totals are quoted.

**Done when:** no headline says a bare household count when the people count is available.

## T5 · Tests for `smsCheckins.ts`
**Owner:** Ameena · **Est:** 1.5 h

The SMS module has **no tests** while the other three simulation modules do.

- [ ] `getEffectiveHousehold`: applies a `2` (needs help) and a `4` (fills a missing medical need
      but never overwrites a known value).
- [ ] A `3` produces a `RoadBlockReport` and leaves the household record unchanged.
- [ ] `reportedFields` marks exactly the fields the check-ins supplied.
- [ ] The offline queue applies messages in order when the toggle is turned off.

**Done when:** `tests/smsCheckins.test.ts` exists and passes.

## T6 · Tests for data loading
**Owner:** Ameena · **Est:** 1 h

`useStudyData.ts` validation is untested — it was parked in this file's old backlog.

- [ ] Malformed JSON → the error state, not a crash.
- [ ] A household with no matching `isolation` record → the "missing household" error.
- [ ] A non-finite / non-positive `rise_rate_default` → the invalid-structure error.

**Done when:** the loader's error paths are covered.

## T7 · Tests for the new panels' logic
**Owner:** Ameena · **Est:** 1 h

- [ ] Cases for the T2 aggregation (ties, a household with `bottleneck_road: null`).
- [ ] Cases for the T3 cumulative curve (monotonic, hour 0 equals the current isolated set).
- [ ] Case for T1's dependants helper (an edge no household depends on → empty, not an error).

**Done when:** the Part 1 pure functions all have tests.

## T8 · Performance: stop re-rendering every road segment per tick
**Owner:** Rabia · **Est:** 1.5 h

`IsolationMap.tsx` re-renders all ~4,958 road polylines on every playback tick, which is visible
jank on a 20 s sweep.

- [ ] Profile first (React DevTools) and write down the actual frame cost — do not guess.
- [ ] Pick the cheapest effective fix and record the before/after:
      `preferCanvas` on the `MapContainer`; or a memoised segment list with a stable
      `closedEdgeIds` prop; or render static geometry once and overlay only the closed set.
- [ ] Do **not** change the visual result — the same segments must be blue at the same levels.
- [ ] If a fix costs more than it gains, stop and note it in `docs/tradeoffs.md`.

**Done when:** playback is smooth at 1×/2× and the profile numbers are recorded.

## T9 · Optional model upgrades (only if time remains)
**Owner:** Ameena · **Est:** 2–4 h each

Each of these needs its own doc update, and each must stay within the honesty rules.

- [ ] **Hospital allocation.** `matchResources` receives shelters only; hospitals are map-only
      (`useStudyData.ts:52`, `IsolationMap.tsx:158`). Adds `docs/ALLOCATION.md` work.
- [ ] **Route-based allocation distance.** Replace the straight-line Haversine
      (`resourceMatching.ts:62`) with the routed network.
- [ ] **Per-road rise rate.** ETI currently uses one global `rise_rate_default`.
- [ ] **Sensitivity band.** `docs/idea.md` point 5 — a ±margin re-rank. Explicitly not built; needs
      `docs/methodology.md` and `docs/SCORING.md` updates.

**Done when:** either shipped with docs + tests, or consciously left in the backlog below.

## T10 · Decide the empty placeholder folders
**Owner:** Wasay · **Est:** 15 min

`src/routing/` and `src/workers/` contain only `.gitkeep`.

- [ ] If T1 option B shipped, `src/routing/` is now real — document it.
- [ ] Otherwise delete both folders: routing is offline in `scripts/`, and there is no worker.
- [ ] Whichever you choose, `docs/architecture.md` must not describe a folder that is empty.

**Done when:** no folder exists that the docs cannot explain, and `AGENTS.md` §2 stays true
(no Web Worker, no service worker).

## T11 · Docs sync for everything added in Part 1
**Owner:** Wasay, with Ameena · **Est:** 1 h

- [ ] Walk `docs/` and fix every statement that Part 1 changed: `methodology.md`, `SCORING.md`,
      `SIMULATION.md`, `ALLOCATION.md`, `SMS.md`, `architecture.md`, `assumptions.md`,
      `tradeoffs.md`.
- [ ] Update `docs/README.md`'s index for any new doc, and `README.md`'s feature list.
- [ ] Grep the whole repo for any figure you changed (counts, max score 95, `rise_rate_default`) and
      make the numbers agree.
- [ ] One `prompts/prompts.md` entry per Part 1 task, each `Model: Claude Sonnet 5.5`.

**Done when:** no doc contradicts the shipped code, and every Part 1 task has a prompt-log entry.

---

# Part 2 — Presentation artifacts

## T12 · Render `docs/architecture.png`
**Owner:** Wasay · **Est:** 1 h

- [ ] Draw the real data flow: offline pipeline (`scripts/`) → `public/data/*.json` →
      `useStudyData` → `src/simulation/` → components → page state.
- [ ] Include the SMS override path and each Part 1 panel.
- [ ] Export to `docs/architecture.png`, link it from `README.md`, and delete the two
      "still to be rendered" notes (`README.md` lines 138 and 278).

**Done when:** the README renders the diagram and no text calls it pending.

## T13 · Screenshots
**Owner:** Rabia · **Est:** 45 min

- [ ] Capture: the map mid-sweep; the ranking with a selected household; the why-panel (score +
      confidence + verification); the allocation panel; the before/after comparison; and each new
      Part 1 panel.
- [ ] Save into `screenshots/` with descriptive names; reference them from `README.md`.

**Done when:** `screenshots/` is non-empty and the README shows them.

## T14 · README final read
**Owner:** Wasay · **Est:** 30 min

- [ ] Read it start to finish as a judge: does `npm install` + `npm run dev` work exactly as written?
- [ ] Add the live link (T18) and the video link (T20) near the top.
- [ ] Make the "Project Structure" tree match the repo after T2/T10/T12/T13.
- [ ] Confirm the honesty wording: *scenario simulator, not a forecast*; the scenario level is never
      called cm or metres.

**Done when:** every command in it is copy-pasteable and every link resolves.

---

# Part 3 — Repo hygiene

## T15 · Tidy branches and refs
**Owner:** Wasay · **Est:** 15 min

- [ ] `ameena` is merged into `main` — delete the local and remote branch.
- [ ] `wasay` is merged — delete or fast-forward it, then delete.
- [ ] Local-only tag `archive/rabia-b4bc175` — keep as insurance or `git tag -d` it. It is not
      pushed.

**Done when:** `git branch -a` shows only what is live, and the history is still legible.

## T16 · Repo size check
**Owner:** Ameena · **Est:** 20 min

- [ ] `data/*.graphml` (~2 MB), the `data/*.geojson` caches and `cache/*.json` are committed so the
      pipeline is reproducible offline — confirm that is still intended, or move them out and note
      it in `data/README.md`.
- [ ] Confirm `.gitignore` still keeps large raw inputs out while force-keeping `public/data/*.json`.
- [ ] If T1 option B shipped, size the new `data/road_graph.json` and confirm it is acceptable.

**Done when:** `data/README.md` explains every committed data file.

## T17 · Keep this file live
**Owner:** Wasay · **Est:** ongoing

- [ ] Tick boxes as tasks land and refresh the status snapshot (branch tip, test count, gate status).
- [ ] Move anything you consciously drop into the [post-deadline backlog](#post-deadline-backlog)
      with a one-line reason.

---

# Part 4 — Deploy

## T18 · Deploy to a live URL
**Owner:** Wasay · **Est:** 1 h · **Blocking for submission**

- [ ] Commit a deploy config (`vercel.json` or `netlify.toml`): build `npm run build`, output `dist/`,
      static site, no serverless functions.
- [ ] Deploy and open the live URL on a phone as well as desktop.
- [ ] Confirm the five `public/data/*.json` files are served and gzip/brotli-compressed.
- [ ] Confirm deep links / refresh on a sub-path work (`import.meta.env.BASE_URL` handling).
- [ ] Put the URL at the top of `README.md` (T14).

**Done when:** the live URL loads the full app on a fresh device with no console errors.

## T19 · Performance sanity check on the live URL
**Owner:** Wasay · **Est:** 45 min

`public/data/roads.json` is ~1.1 MB raw.

- [ ] Measure first load, throttled to "Fast 3G" in DevTools.
- [ ] Confirm the JSON is compressed at the edge (Vercel/Netlify do this by default — verify).
- [ ] If it still feels slow, record it in `docs/tradeoffs.md` rather than over-engineering now.

**Done when:** the numbers are written down, with a decision.

---

# Part 5 — Demo video

## T20 · Record the ~3 minute demo
**Owner:** Wasay + Rabia · **Est:** 1.5 h · **Blocking for submission**

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
**Owner:** Wasay · **Est:** 30 min

- [ ] Public repo with visible history — confirm the pushed tip is the one you want judged.
- [ ] Live link works on a fresh device.
- [ ] `prompts/prompts.md` present and complete, every entry `Model: Claude Sonnet 5.5`.
- [ ] `README.md` runnable as written; architecture diagram and trade-offs present.
- [ ] Demo video link present.
- [ ] Submit the form well before **18 Oct 2026, 22:00 PKT**.

**Done when:** the submission is in.

## T22 · Verify the submission
**Owner:** Wasay · **Est:** 15 min

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
- [ ] **Full road-closure re-simulation** if T1 option A shipped instead of B.
- [ ] **Config surface.** Expose weights and thresholds as a settings panel instead of constants.
- [ ] **Sensitivity view.** A ±margin re-rank around the scenario level (T9).
- [ ] **Route-based allocation distance** and **hospital allocation** if not done in T9.

---

## Suggested run order for a single day

| Slot | Task |
|---|---|
| 1 | T1 road-block loop (Ameena + Rabia) |
| 2 | T2 critical roads, T3 escalation curve (Rabia) |
| 3 | T4 people counts, T5–T7 tests (Rabia, Ameena) |
| 4 | T8 performance, T11 docs sync (Rabia, Wasay) |
| 5 | T12 diagram, T13 screenshots, T14 README (Wasay + Rabia) |
| 6 | T15–T17 hygiene (Wasay, Ameena) |
| 7 | T18 deploy, T19 perf check (Wasay) |
| 8 | T20 video (Wasay + Rabia) |
| 9 | T21 submit, T22 verify — well before 22:00 PKT |
