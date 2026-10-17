# Architecture

> Isolation Clock — a **client-side, static** application. No server, no database, no API.

## Why frontend-only

The only hosting available is static (**Vercel / Netlify**), and in a flood the network can be gone
anyway. So the app is built to run **entirely in the browser**:

- All the geospatial graph work — building the road network, exposure scoring and the widest-path
  search — is **precomputed offline** by Python scripts in `scripts/`.
- The result ships as **precomputed JSON** in `public/data/`, fetched once at load.
- At runtime the browser only does cheap arithmetic per household: convert a precomputed
  `isolation_level` into an Estimated Time to Isolation (ETI), score it, and greedily match
  resources. There is **no Web Worker** — the dataset is small (400 households, ~5 k road features)
  and this step runs in a few milliseconds on the main thread.

Nothing needs a backend at request time. The only "backend-ish" work is the run-once, offline data
preparation step under `scripts/`.

## High-level diagram

```
             OFFLINE (once, on a dev machine)                 │        BROWSER (at runtime)
                                                              │
  OpenStreetMap ─┐                                            │
  Elevation data ─┼─►  scripts/  ─►  public/data/*.json        │
  Synthetic pop. ─┘   (Python)       (households, shelters,    │
                                      hospitals, roads,        │
                                      isolation)               │
                                                              │
  ────────────────────────────────────────────────────────────┼──────────────────────────────
                                                              │
                                                              ▼
                                          ┌────────────────────────────────────┐
                                          │  App shell (Vite + React + TS)     │
                                          │  map · scenario slider · panels    │
                                          └───────────────┬────────────────────┘
                                                          │ fetch + validate, once
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  src/hooks/                        │
                                          │  useStudyData → studyDataValidation│
                                          │  → StudyData + isolation lookup    │
                                          └───────────────┬────────────────────┘
                                                          │ in-process calls
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  src/simulation/ (pure functions)  │
                                          │  householdStatus (ETI) →           │
                                          │  priorityScore → ranked order      │
                                          │  resourceMatching (greedy)         │
                                          │  roadImpact (bottleneck groups)    │
                                          │  escalation (hour curve)           │
                                          │  population (households + people)  │
                                          │  smsCheckins + smsOverrides        │
                                          └───────────────┬────────────────────┘
                                                          │ results (per household)
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  src/components/                   │
                                          │  Ranking + WhyRank + Allocation    │
                                          │  Escalation + CriticalRoads        │
                                          │  SMS check-ins + Before/After      │
                                          └───────────────┬────────────────────┘
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  UI updates: roads recolour,        │
                                          │  households flip to countdowns,     │
                                          │  priority list re-sorts live        │
                                          └────────────────────────────────────┘
```

Rendered version: [`architecture.svg`](architecture.svg).

## Components

| Component | Lives in | Responsibility |
|---|---|---|
| **Offline data prep** | `scripts/` | Run-once Python conversion of OSM/elevation/synthetic data into compact JSON, including the widest-path isolation levels. Not deployed. |
| **Static data** | `public/data/` | The JSON the browser fetches: `households.json`, `shelters.json`, `hospitals.json`, `roads.json`, `isolation.json`. |
| **Data loading** | `src/hooks/useStudyData.ts`, `src/hooks/studyDataValidation.ts` | Fetches the JSON, validates its structure and assembles `StudyData` with the `isolationByHousehold` lookup; validation is a pure, separately tested function. |
| **Simulation** | `src/simulation/householdStatus.ts` | Turns a household's `isolation_level` and the current scenario level into ETI (hours) and a status (`safe` / `urgent` / `isolated` / `unknown`). |
| **Scoring** | `src/simulation/priorityScore.ts` | Blends urgency and vulnerability into the explainable priority score, plus a separate confidence value and an unverified-report count. |
| **Ranking** | `src/simulation/smsOverrides.ts` | Folds applied SMS overrides into the households and returns the ranked order; also applies SMS message batches (live or replayed from the offline queue). |
| **SMS state** | `src/simulation/smsCheckins.ts` | The SMS override, check-in and road-block report types, plus the pure helpers that apply and re-point them. |
| **Allocation** | `src/simulation/resourceMatching.ts` | Greedy priority-first assignment of boats, vehicles and beds across **shelters and hospitals**; records why a household was not assigned. |
| **Road impact** | `src/simulation/roadImpact.ts` | Groups households by their recorded bottleneck road, counts the dependants, and finds the road segments nearest a household. An impact preview only — it never re-runs routing. |
| **Escalation** | `src/simulation/escalation.ts` | Household and people counts per hour ahead, at the illustrative rise rate. |
| **Population** | `src/simulation/population.ts` | Household and people counts, with households of unknown size excluded from the people total rather than assumed to be one person. |
| **Geometry** | `src/simulation/geo.ts` | Straight-line (great-circle) distance, shared by allocation and the road picker. |
| **Map** | `src/components/IsolationMap.tsx` | Leaflet map of roads and households, road recolouring by scenario level, the unverified road-block overlay and the focused-road highlight, popups and `fitBounds`. Roads are drawn in a handful of style-grouped polylines rather than one layer per segment. |
| **Ranking UI** | `src/components/RankingPanel.tsx`, `WhyRankPanel.tsx` | The priority list (with household and people totals) and the per-household explanation. |
| **Allocation UI** | `src/components/ResourceAllocationPanel.tsx` | Boats/vehicles used, people assigned, and beds consumed per shelter or hospital. |
| **Road views** | `src/components/EscalationCurvePanel.tsx`, `CriticalRoadsPanel.tsx` | The hour-by-hour escalation curve and the ranked bottleneck roads, each clickable through to the map and the ranking. |
| **SMS UI** | `src/components/SmsCheckinPanel.tsx` | The browser-only SMS simulator, including the road-block reports and their impact preview. |
| **Before/after** | `src/components/BeforeAfterPanel.tsx` | Pins a moment and compares it with another (rank shifts, newly isolated, assignment changes). |
| **Page + state** | `src/pages/IsolationClockPage.tsx` | Holds the scenario level, playback, pinning and focus state; wires data to components. |
| **Shared types** | `src/types/study.ts` | TypeScript contracts for households, safe places, roads and isolation records. |
| **Docs** | `docs/` | Architecture, assumptions, methodology, risks, trade-offs. |
| **Prompts** | `prompts/` | The AI prompt log required for this Vibe Coding hackathon. |

> **No worker, no in-browser routing.** There is no Web Worker and no routing module: graph work
> runs offline in `scripts/`, and the browser only reads precomputed results. The original scaffold
> kept empty `src/workers/` and `src/routing/` placeholders; both were deleted rather than left
> undocumented.

## Runtime data flow (one interaction)

1. App loads and fetches `public/data/*.json` once via `useStudyData`, which validates the structure
   and assembles the `StudyData` and isolation lookup.
2. Coordinator drags the **scenario-level slider** (0–100) or presses play.
3. For every household, `getHouseholdScenario` computes `ETI = max(0, (isolation_level −
   scenarioLevel) / riseRate)` and derives its status.
4. `priorityScore` scores and orders the households; `resourceMatching` greedily assigns boats,
   vehicles and beds across shelters and hospitals.
5. In the same pass, `escalation` builds the hour curve and `roadImpact` groups households by their
   bottleneck road.
6. The **UI** recolours roads, updates the priority list and map popups, and re-renders — all
   synchronously, with no message passing. An SMS check-in re-runs steps 3–6 for the affected
   household; a road-block report only moves the preview overlay.

## Design principles

- **No server.** If it needs a backend, it doesn't ship. Computation is client-side, data is static.
- **Precompute the heavy part.** Graph work runs once in Python so the browser stays instant; the
  client only does arithmetic on already-computed isolation levels.
- **Explainable.** Every ranked row names its reason — the safe place, the bottleneck road, the
  contributing vulnerability factors.
- **Graceful degradation.** Missing isolation data → an explicit `unknown` status. Missing shelter
  capacity or household size → a documented default, clearly flagged, never silent.
- **Honesty over polish.** A *scenario simulator*, not a forecast; confidence is always shown.

## What we deliberately have no room for

| Not used | Why |
|---|---|
| Backend API / server | Hosting is static-only; also a liability when the network dies. |
| Database | Data is precomputed and shipped; nothing to query at runtime. |
| Web Worker | The runtime computation is trivial once isolation levels are precomputed; a worker would add complexity for no measurable gain. |
| Offline snapshot files | With no service worker, an offline mode would need extra build tooling; the app is designed to be served statically and cached by the browser. |
| Live OSM queries in the app | Would need a network and be slow; preprocessing happens offline. |
| User accounts / saved sessions | Out of scope for the MVP. |

## See also

- [`SIMULATION.md`](SIMULATION.md) — what the road thresholds mean and what they do not
- [`SCORING.md`](SCORING.md) — the priority score and confidence formula
- [`ALLOCATION.md`](ALLOCATION.md) — how boats, vehicles and beds are assigned
- [`methodology.md`](methodology.md) — how ETI and the ranking are defined
- [`assumptions.md`](assumptions.md) — the assumptions behind every layer above
- [`tradeoffs.md`](tradeoffs.md) — what we deliberately left out
