# Architecture

> Isolation Clock — a **client-side, static** application. No server, no database, no API.

## Why frontend-only

The only hosting available is static (**Vercel / Netlify**), and in a flood the network can be gone
anyway. So the app is built to run **entirely in the browser**:

- All logic — the water model and the time-to-isolation calculation — is **TypeScript** running on
  the client.
- All data is **precomputed JSON** shipped as static assets, fetched once at load.
- Heavy graph math runs in a **Web Worker** so the UI stays smooth.
- Once loaded, it **works offline** — which is the real field condition.

Nothing needs a backend at request time. The only "backend-ish" work is a run-once, offline data
preparation step under `scripts/`.

## High-level diagram

```
             OFFLINE (once, on a dev machine)                 │        BROWSER (at runtime)
                                                              │
  OpenStreetMap ─┐                                            │
  Elevation data ─┼─►  scripts/  ─►  public/data/*.json        │
  Synthetic pop. ─┘   (prepare)      (households, graph,       │
                                      destinations, snapshots) │
                                                              │
  ────────────────────────────────────────────────────────────┼──────────────────────────────
                                                              │
                                                              ▼
                                          ┌────────────────────────────────────┐
                                          │  App shell (Vite + React + TS)     │
                                          │  map · water-level slider · list   │
                                          └───────────────┬────────────────────┘
                                                          │ messages
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  Web Worker                        │
                                          │  ┌──────────────┐ ┌─────────────┐  │
                                          │  │ Simulation   │ │ Routing     │  │
                                          │  │ water level  │→│ graph paths │  │
                                          │  │ over time    │ │ + ETI       │  │
                                          │  └──────────────┘ └─────────────┘  │
                                          └───────────────┬────────────────────┘
                                                          │ results (per household)
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  Ranking                           │
                                          │  vulnerability × urgency + band    │
                                          └───────────────┬────────────────────┘
                                                          ▼
                                          ┌────────────────────────────────────┐
                                          │  UI updates: roads turn blue,      │
                                          │  households flip to countdowns,     │
                                          │  priority list re-sorts live        │
                                          └────────────────────────────────────┘
```

> **To do:** render this and save it as `docs/architecture.png` for the README and pitch.

## Components

| Component | Lives in | Responsibility |
|---|---|---|
| **Offline data prep** | `scripts/` | Run-once conversion of OSM/elevation/synthetic data into compact JSON. Not deployed. |
| **Static data** | `public/data/` | The JSON the browser fetches: households, road graph, destinations, offline snapshots. |
| **App shell / UI** | `src/components/`, `src/pages/` | The coordinator-facing interface: map, water-level slider, priority list, badges. |
| **State wiring** | `src/hooks/` | React hooks that feed slider/scenario changes to the worker and results back to the UI. |
| **Simulation** | `src/simulation/` | The water model: level over time and which road segments are submerged. |
| **Routing + ETI** | `src/routing/` | Graph search to shelters/hospitals and the time-to-isolation calculation. |
| **Worker** | `src/workers/` | Runs the simulation + routing sweep off the main thread. |
| **Shared types** | `src/types/` | TypeScript contracts for households, edges, snapshots and results. |
| **Docs** | `docs/` | Architecture, assumptions, methodology, risks, trade-offs. |
| **Prompts** | `prompts/` | The AI prompt log required for this Vibe Coding hackathon. |

## Runtime data flow (one interaction)

1. App loads, fetches `public/data/*.json` once, and hands the graph to the worker.
2. Coordinator drags the **water-level slider** (or picks a scenario).
3. The **worker** runs the water model and the ETI sweep for the new level.
4. Results travel back to the main thread as a compact list of household outcomes.
5. The **UI** recolours submerged roads, flips households to countdowns, and re-sorts the priority
   list — live.

## Design principles

- **No server.** If it needs a backend, it doesn't ship. Computation is client-side, data is static.
- **Config-driven.** Study area, tolerances, weights and the assumed water curve are tunable in one
  place — no magic numbers buried in components.
- **Graceful degradation.** Missing elevation → neighbourhood average + low-confidence badge.
  No route → an explicit message, never an invented one.
- **Honesty over polish.** Every countdown travels with a confidence band. A *scenario simulator*,
  not a forecast.
- **Offline-first.** Precomputed snapshots mean the field device works with no signal.

## What we deliberately have no room for

| Not used | Why |
|---|---|
| Backend API / server | Hosting is static-only; also a liability when the network dies. |
| Database | Data is precomputed and shipped; nothing to query at runtime. |
| Live OSM queries in the app | Would need a network and be slow; preprocessing happens offline. |
| User accounts / saved sessions | Out of scope for the MVP. |

## See also

- [`methodology.md`](methodology.md) — how ETI and the ranking are actually defined
- [`assumptions.md`](assumptions.md) — the assumptions behind every layer above
- [`tradeoffs.md`](tradeoffs.md) — what we deliberately left out
