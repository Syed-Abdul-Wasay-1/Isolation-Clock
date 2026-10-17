# Methodology

> How the Isolation Clock computes a household's time-to-isolation, and how it ranks.

Everything below happens **client-side in the browser**, but the expensive part is done
**offline in Python**. `scripts/build_isolation_clock.py` builds the road graph, scores every node's
exposure and runs the widest-path search, writing the results to `public/data/isolation.json`. The
browser then only converts those precomputed isolation levels into ETI and re-ranks. No part of this
needs a server.

## 1. The core quantity: ETI

**ETI — Estimated Time to Isolation** is how long a household can still be *reached* by road before
rising water closes every route to a safe destination (shelter or hospital).

Stated plainly:

```
Reachable(household, level)  ⟺  some path to an open destination still exists,
                                 where every road segment along it is still open.

ETI(household) = (isolation_level − scenarioLevel) / riseRate,  floored at 0.
```

- A **road segment is open** while the scenario level is below its threshold. The threshold is a
  **relative 0–100 exposure index, not a water depth** — see [`SIMULATION.md`](SIMULATION.md).
- A household's `isolation_level` is the **highest bottleneck threshold** across all its routes to a
  shelter or hospital, where a route's bottleneck is its lowest-threshold edge. This is a
  **widest-path (maximin)** quantity: it is the level at which the *last* route closes.
- If a household has no computable route, its status is `unknown` and the UI shows "No route" — it is
  never given a fabricated time.
- `ETI` is capped at 0 once the household is isolated (`scenarioLevel ≥ isolation_level`).

Because the water level only rises, once a household is cut off it stays cut off — which is what
makes the precomputed widest-path level a complete description of the countdown.

## 2. What the scenario level means

We do **not** run a hydrodynamic solver. With coarse (≈30 m) elevation data — too coarse to resolve
urban drains — pretending to model street-level flow would be false precision. Instead
`build_isolation_clock.py` builds a **relative exposure index**:

```
node exposure = 0.6 × normalised(elevation) + 0.4 × normalised(water distance)
edge threshold = 100 × min(exposure[u], exposure[v])       # percentile-scaled over the network
```

The 0–100 scenario level the user drags is a **competitive index over that exposure**, not
centimetres of water. `config.rise_rate_default` (10 index points/hour) is an illustrative setting
used only to turn an index gap into an ETI in hours; it is not a measured rate of rise.

## 3. Road network and elevation

1. Build the **road network** for the study area from OpenStreetMap (osmnx).
2. Give each node an elevation (OpenTopoData / SRTM; 1,908 nodes in the shipped dataset) and a
   distance to the nearest mapped water feature.
3. Combine the two into a node exposure score and percentile-scale it across the network.
4. Snap each household, shelter and hospital to the nearest road node.
5. Run a reverse **widest-path** search from every shelter and hospital to get each household's
   `isolation_level`, its best safe place and the bottleneck road on that route.

## 4. Vulnerability factors

Each household's score draws on five signals, each worth a fixed number of points:

| Signal | Points | Why it matters |
|---|---:|---|
| Age 65–74 or 75+ | 12 | Slower to react; higher medical risk |
| Lives alone | 10 | No one to assist |
| Mobility limited / wheelchair | 12 | Cannot self-evacuate |
| Medical need | 10 | Needs medication or care |
| No phone | 6 | Will not receive alerts |

Unknown values add **zero** points (never points) and lower confidence. The weights are a
configurable, illustrative choice — the point is that **who lives there** feeds the ranking, not just
**where** it is. Full formula in [`SCORING.md`](SCORING.md).

## 5. Priority ranking

```text
Urgency        = 35                        if the household is already isolated
               = 35 × (1 − min(ETI, 6)/6)   otherwise  (0 when ETI ≥ 6 h or unknown)
Priority score = Urgency + known vulnerability points      # bounded 0–100, practical max 95
Confidence     = max(0, 1 − 0.2 × count(missing vulnerability fields))
```

Households are ordered by priority score, then by ETI (ascending), fewer missing fields, and id.
The ranking is split into two tabs — **Needs rescue now** (already isolated) and **Not yet
isolated**. A household's **rank number is its position inside its own tab**, so the row number, the
"why this rank" panel and the map popup always show the same value — #1 is the top household of that
tab, not of the whole 400. (An isolated household sits high in the overall order, so its overall
position can be larger than the size of its own tab; that is deliberate, not a bug.) The one
cross-tab surface is the **before/after** panel, which works from the *overall* order (both tabs
together) and labels its column **"overall priority, both tabs"**. Every row is **explainable**: it
names the safe place, the bottleneck road and the top contributing factors. Confidence is reported
separately and does **not** change the score; unverified SMS check-ins are counted separately and
never raise it.

## 6. From ranking to roads: the two road views

The ranking answers *who*; two panels answer *which road* and *how soon*.

**Escalation curve.** For each hour `h`, the scenario level is `min(100, scenarioLevel + h ×
riseRateDefault)`, and the panel counts the households (and people) whose `isolation_level` is at or
below that level. The count is cumulative and, because the level only rises, monotone. Hour 0
reproduces exactly the set the ranking already calls isolated. Clicking an hour moves the scenario
slider to that level. The rise rate is the same illustrative setting used for ETI, so the curve
shows a **shape**, not a forecast.

**Critical roads.** Every household's isolation record names the bottleneck road on its best
modelled route. Grouping households by that value answers "which single road appears most often as
the last way out". This is an **impact preview, not a re-simulation**: the shipped dataset records
the bottleneck of the *best* route only, so a group means "households whose best modelled route
uses this road", not a proven set of households whose closure would isolate them. Nothing is
recomputed and no `isolation_level` is ever edited.

The value is a road edge id, so a group can always be located in `roads.json` and highlighted on the
map. Where OpenStreetMap has a street name for the way, the row shows it; where it does not — 275 of
the 387 households with a known route, since only 356 of the study area's 4,958 drive edges are named
at all — the row reads *"Unnamed road segment"* with the edge id kept as a muted secondary tag. A name
is never invented for an unnamed way. See [`../data/README.md`](../data/README.md).

**People, not just households.** Every headline count is reported as households **and** people,
using `household_size`. A household with a missing or invalid size is counted as a household and
**excluded** from the people total — never silently counted as one person — and the UI says how
many such households there are.

## 7. How we'd validate it

- **Monotonicity:** the isolation time never gets *longer* as the scenario level rises.
- **Hand cases:** a household whose only bridge is the bottleneck → a finite isolation level; one
  with two independent routes → a higher level, set by the weaker route.
- **Degradation:** removing a household's data produces the documented fallback (default size,
  reduced confidence, or `unknown` status), never a crash and never an invented value.
