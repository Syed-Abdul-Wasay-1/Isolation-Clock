# TASKS.md — Isolation Clock · remaining work

> **The single source of truth for what is left to do.** Keep it updated: tick boxes as you finish.
> Read [`AGENTS.md`](AGENTS.md) first — it has the ground rules, the model invariants and the
> verification gate.
>
> **Deadline: 18 Oct 2026, 22:00 PKT.** Late submissions are not evaluated.

## Status snapshot (as of 17 Oct 2026)

| Area | State |
|---|---|
| Branch | `main` == `wasay` == `1b64700`, pushed, working tree clean |
| Build / lint / types | ✅ `tsc -b`, `oxlint`, `npm run build` all pass |
| Tests | ✅ 45 tests across ETI/status, scoring, allocation (`npm test`) |
| Docs | ✅ Match the shipped code — no phantom features |
| Prompt log + skills | ✅ `prompts/` complete, 4 repo skills under `.agents/skills/` |
| Team roster | ✅ Filled in `README.md` |
| **Live deploy** | ❌ Not deployed, no deploy config committed |
| **`docs/architecture.png`** | ❌ Not rendered |
| **Demo video** | ❌ Not recorded |
| **Screenshots** | ❌ `screenshots/` is empty |

---

## Who does what

Three people. Match the roles in `README.md`, and **stay in your own files** so we can work in
parallel without conflicts.

| Person | Role | Owns these paths |
|---|---|---|
| **Syed Abdul Wasay** | Lead | `README.md`, `docs/architecture.md` + `.png`, deploy config, `prompts/`, `TASKS.md`, repo hygiene |
| **Ameena Batool** | Simulation & Routing | `scripts/`, `public/data/*.json`, `src/simulation/`, `tests/`, `docs/SIMULATION.md`, `docs/SCORING.md`, `docs/ALLOCATION.md`, `docs/DATA.md` |
| **Rabia Chadio** | Frontend / UX | `src/components/`, `src/pages/`, `src/styles.css`, `screenshots/`, `.agents/skills/frontend-ui/` |

**Rule:** if you need to change a file outside your column, say so in the group chat first.
**Verify before you commit:** `npx tsc -b`, `npx oxlint`, `npm run build`, `npm test` — all green.
**Log it:** add an entry to `prompts/prompts.md` (see `AGENTS.md` §7).

---

## Priority legend

| Tag | Meaning |
|---|---|
| **P0** | Blocks submission — cannot submit without it |
| **P1** | Directly affects a judging criterion — do it before the video |
| **P2** | Repo polish — cheap wins |
| **P3** | Backlog — only if time remains (or after the deadline) |

---

# P0 — Critical path to submission

## T0 · Deep-research & pitch evidence pass
**Owner:** Ameena · **Est:** 1 h · **Depends on:** nothing

Before anything else, prove the numbers we put on stage. Produce a short evidence note (a few
paragraphs in the pitch doc or `docs/`) covering:

- [ ] What "time to isolation" means vs. a depth map, in one sentence a judge will remember.
- [ ] Why the study area is Sukkur, Sindh, and one or two concrete facts about flood risk there
      (source the claims — link or cite).
- [ ] The exact dataset counts to quote: **400** households, **5** shelters, **2** hospitals,
      **4,958** road features, **1,908** elevation nodes. Read them from `public/data/`, do not guess.
- [ ] State plainly what is **not** modelled (no water depth, no live feeds, no dispatch) — judges
      reward honesty and it is already our framing.
- [ ] One realistic usage story: "coordinator 6–12 h before heavy rain decides where to park boats."

**Done when:** the note exists and every number in it is traceable to a file or a source.

---

## T1 · Deploy the app and get a live link
**Owner:** Wasay · **Est:** 1–2 h · **Depends on:** nothing

There is currently **no deploy config** in the repo. Static site only.

- [ ] Choose Vercel or Netlify (both free tiers are fine).
- [ ] Commit a minimal config so the build is reproducible:
      `vercel.json` **or** `netlify.toml` with build command `npm run build` and output dir `dist/`.
- [ ] Confirm `public/data/*.json` is served — the app fetches `data/households.json`,
      `data/shelters.json`, `data/hospitals.json`, `data/roads.json`, `data/isolation.json`.
      Data paths use `import.meta.env.BASE_URL`, so a sub-path deploy works **if** Vite's `base` is set.
- [ ] Deploy from the **`main`** branch.
- [ ] Open the live URL on a phone and on desktop. Load the page, drag the slider, switch tabs.
- [ ] Put the live link at the top of `README.md` and in the pitch.

**Done when:** a public URL loads the map, the ranking, the allocation panel and the before/after view
with real data — not a blank screen or a 404 on the JSON.

---

## T2 · Render `docs/architecture.png`
**Owner:** Wasay · **Est:** 1 h · **Depends on:** T1 (link it after)

The rules require "architecture diagram + trade-off notes". `docs/tradeoffs.md` is done; the diagram
is still a to-do (see `docs/architecture.md` and `docs/README.md`).

- [ ] Render the ASCII diagram in `docs/architecture.md` (draw.io / Excalidraw / Mermaid → PNG).
- [ ] Save it as **`docs/architecture.png`**.
- [ ] Embed it in `README.md` with a caption and alt text: `![Isolation Clock architecture](docs/architecture.png)`.
- [ ] Keep the ASCII version in `docs/architecture.md` (it is the source of truth for the diagram).
- [ ] Remove the "To do" notes in `docs/architecture.md` and `docs/README.md`.

**Done when:** the PNG is committed and referenced from the README, and no "still to be rendered" text
remains anywhere.

---

## T3 · Record the 3-minute demo video
**Owner:** Wasay (script) + Rabia (screen) · **Est:** 2 h · **Depends on:** T1, T4

- [ ] Script it to ~3 minutes against the judging weights: problem fit 30, MVP 25, UI/UX 20,
      innovation 15, pitch 10.
- [ ] Suggested beats: the problem (20 s) → the one idea "who loses their last way out, and when?" (20 s)
      → live demo (90 s) → honesty/limits (20 s) → close (20 s).
- [ ] In the live demo show: rising slider, roads recolouring, list re-sorting, the *why* panel,
      the allocation panel, and pin/compare (before-after).
- [ ] Say out loud: **"scenario simulator, not a forecast"**, synthetic households, real OSM base data.
- [ ] Upload (YouTube unlisted or Drive) and add the link to `README.md`.

**Done when:** the video plays end to end, is ≤ 3 minutes, and the link is in the README.

---

## T4 · Screenshots for the README and the pitch
**Owner:** Rabia · **Est:** 45 min · **Depends on:** nothing

`screenshots/` contains only `.gitkeep`, and the README points at it.

- [ ] Capture with data loaded (not the loading state): the map with roads coloured, the ranking list,
      the *why* panel open, the allocation panel, and the before/after comparison.
- [ ] Save as `screenshots/01-map.png`, `02-ranking.png`, `03-why.png`, `04-allocation.png`, `05-before-after.png`.
- [ ] Embed the best two or three in `README.md` under a "Screenshots" heading.
- [ ] Keep the images reasonably small (crop, compress) — the repo should stay light.

**Done when:** `screenshots/` holds the images and the README shows them.

---

## T5 · Final submission
**Owner:** Wasay · **Est:** 30 min · **Depends on:** T1, T2, T3

- [ ] Re-read the checklist in `docs/event-brief.md` and the README checklist.
- [ ] Confirm: one problem domain, public repo with visible history, live link, `prompts/`,
      runnable README, architecture diagram + trade-offs, demo video.
- [ ] Fresh-clone test in a temp folder: `npm install` → `npm run dev` works; `npm test` is green.
- [ ] Submit the live link + repo URL **before 18 Oct 22:00 PKT**.

**Done when:** the submission is in and the confirmation is screenshotted.

---

# P1 — Judging-criterion work

## T6 · Manual QA pass across the whole flow
**Owner:** Rabia · **Est:** 1 h

Walk the app at several scenario levels and note anything broken or confusing.

- [ ] Scenario level 0 → 25 → 50 → 75 → 100: list re-sorts, count of isolated grows monotonically.
- [ ] "Needs rescue now" tab vs "Not yet isolated" tab: ranks number from #1 in each tab.
- [ ] Select a household: the *why* panel, map popup and rank selection agree.
- [ ] Allocation panel: boats/vehicles used and beds per shelter look sane; unassigned reasons readable.
- [ ] Play control: sweeps to 100, 1x/2x toggle works.
- [ ] Pin → move level → compare shows rank movement, newly isolated, assignment changes.
- [ ] Loading and error states: throttle the network and confirm the error screen is understandable.
- [ ] Log every issue found as a new task in this file.

## T7 · Accessibility & responsive polish
**Owner:** Rabia · **Est:** 1.5 h

UI/UX is 20% of the score.

- [ ] Keyboard: every control reachable by Tab, slider usable with arrow keys.
- [ ] Screen reader: controls have labels; status ("isolated"/"urgent") is not colour-only.
- [ ] Contrast: check the ranking and status colours.
- [ ] Narrow viewport (~380 px): no horizontal scroll, panels usable.
- [ ] Respect `prefers-reduced-motion` for the playback animation.

## T8 · Model & data verification note
**Owner:** Ameena · **Est:** 1.5 h

Make sure what the UI shows matches the spec, and that the pipeline still runs.

- [ ] Re-read `docs/SIMULATION.md`, `docs/SCORING.md`, `docs/ALLOCATION.md` against `src/simulation/`.
- [ ] Spot-check 3 households by hand: recompute `isolation_level` → ETI → score and match the UI.
- [ ] Confirm the practical max is 85 while the UI shows "/ 100" — either accept and document it, or fix.
- [ ] Try a full data regeneration (`.venv` + `requirements.txt`, then the two scripts); if it fails,
      record why — the committed JSON is what ships, so this is a nice-to-have.
- [ ] Confirm the generation date/seed in `public/data/meta.json` and quote it in the pitch (provenance).

## T9 · Performance sanity check on the live deploy
**Owner:** Wasay · **Est:** 45 min

`public/data/roads.json` is ~1.1 MB raw.

- [ ] Measure first load on the live URL (DevTools, throttled "Fast 3G").
- [ ] Confirm the JSON is served gzipped/brotli (Vercel/Netlify do this by default — verify).
- [ ] If first load feels slow, note it in `docs/tradeoffs.md` rather than over-engineering a fix now.

---

# P2 — Repo hygiene (cheap wins)

## T10 · Tidy branches and refs
**Owner:** Wasay · **Est:** 15 min

- [ ] The `ameena` branch (local and remote) sits at the old tip `3e357a0`, 6 commits behind `main`.
      Decide: fast-forward it to `main`, or delete it. (Nothing is lost either way.)
- [ ] Local-only tag `archive/rabia-b4bc175` points at Rabia's abandoned commit. Decide whether to keep
      it as insurance or `git tag -d` it. It is **not** pushed.

## T11 · Decide on the empty placeholder folders
**Owner:** Wasay · **Est:** 15 min

`src/routing/` and `src/workers/` contain only `.gitkeep`. They are leftovers from the original
scaffold plan and are explained in `docs/architecture.md`.

- [ ] Either delete both folders (routing is offline in `scripts/`; there is no worker), or
      keep them with the explanation. Do not leave them unexplained.

## T12 · Repo size check
**Owner:** Ameena · **Est:** 20 min

- [ ] `data/roads_*.graphml` (~2 MB), the `data/*.geojson` caches and `cache/*.json` are committed so the
      pipeline is reproducible offline. Confirm that is still intended; if not, move them out and note
      it in `data/README.md`.
- [ ] Confirm `.gitignore` still keeps the raw/large inputs out while force-keeping `public/data/*.json`.

## T13 · README final read
**Owner:** Wasay · **Est:** 30 min

- [ ] Add the live link and the video link near the top.
- [ ] Add the screenshots (T4).
- [ ] Read it start to finish as a judge: does `npm install` + `npm run dev` work as written?
- [ ] Make sure the "Project Structure" tree still matches the repo after T2/T4/T11.

---

# P3 — Backlog (only if time remains, or after the deadline)

These are real improvements we consciously did not build. They are **not** required to submit, and
`AGENTS.md` says the docs must not claim them until they exist.

- [ ] **Offline support.** The app is online-only: it needs a connection to load and the Leaflet map
      pulls OSM raster tiles. A service worker + a tile-free/cached basemap would make it usable on a
      dead network — the real field condition. This is a feature build, not a port; would need
      `docs/architecture.md` and `docs/assumptions.md` updated.
- [ ] **Route-based travel distance.** Allocation uses straight-line Haversine. Using the routed
      network for shelter distance would be more defensible but slower.
- [ ] **Hospital allocation.** `matchResources` only receives shelters; hospitals are map-only.
- [ ] **Tests for data loading.** `useStudyData.ts` validation is untested; add cases for the
      malformed-JSON and missing-household paths.
- [ ] **Config surface.** Expose the weights/thresholds as a settings panel instead of constants.
- [ ] **Sensitivity view.** A ±margin re-run around the scenario level — deliberately not built; would
      need `docs/methodology.md` and `docs/SCORING.md` updated.

---

## Suggested timing (T-1 day)

| When | Who | What |
|---|---|---|
| Now | Everyone | T0 (research), T4 (screenshots) in parallel |
| +1 h | Wasay | T1 deploy → live link |
| +2 h | Ameena, Rabia | T8 verification, T6 QA pass |
| +3 h | Rabia | T7 accessibility/responsive |
| +4 h | Wasay | T2 architecture diagram |
| +5 h | Wasay + Rabia | T3 record video |
| +6 h | Everyone | T10–T13 hygiene, then freeze scope |
| Final | Wasay | T5 submit — well before 22:00 PKT |

> **Freeze rule:** once the video is recorded, no more feature changes. Only fixes that make the demo
> more honest or stop it from breaking.
