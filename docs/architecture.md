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
                                                          │ in-process calls
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  src/simulation/                    │
                                          │  ┌──────────────┐ ┌─────────────┐  │
                                          │  │ household    │ │ priority    │  │
                                          │  │ status (ETI) │→│ score       │  │
                                          │  └──────────────┘ └─────────────┘  │
                                          │  ┌──────────────────────────────┐  │
                                          │  │ resourceMatching (greedy)    │  │
                                          │  └──────────────────────────────┘  │
                                          └───────────────┬────────────────────┘
                                                          │ results (per household)
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  Ranking  +  Why-rank  +  Alloc    │
                                          │  vulnerability + urgency → score   │
                                          └───────────────┬────────────────────┘
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  UI updates: roads recolour,        │
                                          │  households flip to countdowns,     │
                                          │  priority list re-sorts live        │
                                          └────────────────────────────────────┘
```

> **To do:** render this and save it as `docs/architecture.png` for the README and pitch.

## Components

| Component | Lives in | Responsibility |
|---|---|---|
| **Offline data prep** | `scripts/` | Run-once Python conversion of OSM/elevation/synthetic data into compact JSON, including the widest-path isolation levels. Not deployed. |
| **Static data** | `public/data/` | The JSON the browser fetches: `households.json`, `shelters.json`, `hospitals.json`, `roads.json`, `isolation.json`. |
| **Data loading** | `src/hooks/useStudyData.ts` | Fetches the JSON, validates its structure, and builds the `isolationByHousehold` lookup and `riseRateDefault`. |
| **Simulation** | `src/simulation/householdStatus.ts` | Turns a household's `isolation_level` and the current scenario level into ETI (hours) and a status (`safe` / `urgent` / `isolated` / `unknown`). |
| **Scoring** | `src/simulation/priorityScore.ts` | Blends urgency and vulnerability into the explainable priority score, plus a separate confidence value. |
| **Allocation** | `src/simulation/resourceMatching.ts` | Greedy priority-first assignment of boats, vehicles and shelter beds; records why a household was not assigned. |
| **Map** | `src/components/IsolationMap.tsx` | Leaflet map of roads and households, road recolouring by scenario level, popups and `fitBounds`. |
| **Ranking UI** | `src/components/RankingPanel.tsx`, `WhyRankPanel.tsx` | The priority list and the per-household explanation. |
| **Allocation UI** | `src/components/ResourceAllocationPanel.tsx` | Boats/vehicles used and beds consumed per shelter. |
| **Before/after** | `src/components/BeforeAfterPanel.tsx` | Pins a moment and compares it with another (rank shifts, newly isolated, assignment changes). |
| **Page + state** | `src/pages/IsolationClockPage.tsx` | Holds the scenario level, playback and pinning state; wires data to components. |
| **Shared types** | `src/types/study.ts` | TypeScript contracts for households, safe places, roads and isolation records. |
| **Docs** | `docs/` | Architecture, assumptions, methodology, risks, trade-offs. |
| **Prompts** | `prompts/` | The AI prompt log required for this Vibe Coding hackathon. |

> **Reserved, unused folders.** `src/workers/` and `src/routing/` exist only as empty placeholders
> (`.gitkeep`) from the original scaffold plan. There is no worker and no in-browser routing module;
> both responsibilities were moved offline into `scripts/`.

## Runtime data flow (one interaction)

1. App loads and fetches `public/data/*.json` once via `useStudyData`, validating the structure and
   building the isolation lookup.
2. Coordinator drags the **scenario-level slider** (0–100) or presses play.
3. For every household, `getHouseholdScenario` computes `ETI = max(0, (isolation_level −
   scenarioLevel) / riseRate)` and derives its status.
4. `priorityScore` scores and orders the households; `resourceMatching` greedily assigns boats,
   vehicles and shelter beds.
5. The **UI** recolours roads, updates the priority list and map popups, and re-renders — all
   synchronously, with no message passing.

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
