# Methodology

> How the Isolation Clock computes a household's time-to-isolation, and how it ranks.

Everything below runs **client-side in the browser**. The road graph and datasets arrive as
precomputed JSON; the water model and the isolation-time sweep execute in a Web Worker so the map
and slider stay responsive. No part of this needs a server.

## 1. The core quantity: ETI

**ETI — Estimated Time to Isolation** is how long a household can still be *reached* by road before
rising water closes every route to a safe destination (shelter or hospital).

Stated plainly:

```
Reachable(household, time)  ⟺  some path to an open destination still exists,
                                where every road segment along it is not yet flooded.

ETI(household) = the last time at which the household is still reachable.
```

- A **road segment is flooded** when the water depth over it exceeds a tolerance (the depth a
  normal vehicle/evacuation can still cope with).
- A **destination is open** if it is not itself inundated.
- If a household still has a route at the end of the scenario, its ETI is beyond the horizon
  ("still reachable").
- If a household has no route at all from the start, it is flagged as **no modelled route**
  (see the bad-data rules below).

Because the water level rises over time, once a household is cut off it stays cut off. That
monotonic property means the isolation time can be found efficiently rather than by brute-force
stepping through every minute.

## 2. Water model

We do **not** run a hydrodynamic solver. With coarse (≈30 m) elevation data — too coarse to resolve
urban drains — pretending to model street-level flow would be false precision. Instead we model a
**rising water level over time** plus a **drainage allowance**:

```
water level(t)  =  the modelled level at time t
                   (an assumed rise curve, optionally reduced by drainage loss)
uncertainty band =  the level is treated as ± a margin, used only for the sensitivity test
```

The optional hydrology step lets us reason about rainfall honestly: *"2 hours of 40 mm/hr rain adds
roughly X cm, assuming Y% of it drains away"* — rather than asserting an absolute depth we cannot
verify.

## 3. Road network and elevation

1. Use the **road network** for the study area (from OpenStreetMap, or a synthetic grid offline).
2. Give each road segment a **ground elevation** (from elevation data, else interpolated, else the
   neighbourhood average — flagged low-confidence).
3. Attach each household and each destination to the nearest point on the network.
4. Keep only the **largest connected part** as the routable network; anything outside it is reported
   as *no modelled route*.

## 4. Vulnerability score

Each household gets a **vulnerability index** between 0 and 1, built from signals such as:

| Signal | Why it matters |
|---|---|
| Older age | Slower to react; higher medical risk |
| Disability / non-ambulant | Cannot self-evacuate |
| Lives alone | No one to assist |
| No smartphone | Will not receive alerts |
| Low income / poor housing | Less resilience, often worse location |

The exact weighting is a configurable choice; the point is that **who lives there** feeds the
ranking, not just **where** it is.

## 5. Priority ranking

```
urgency        = how soon the household is isolated (closer to now ⇒ more urgent)
priority score = a weighted blend of  vulnerability  and  urgency
                 (minus a small penalty for low-confidence data)
```

Two non-negotiable rules:

- Households with **no modelled route** are surfaced at the **top** with a low-confidence badge —
  we would rather over-alert than silently drop someone.
- Every row is **explainable**: it names the actual road and the estimated time, e.g.
  *"only road to Shelter B floods in ~1h 40m"*.

## 6. Sensitivity band

For each household we re-run the ranking at the water level **± the uncertainty margin** and report:

> *"stays top 10 if water rises ±20 cm"*

If a household drops out of the top N across that band, it is labelled **fragile**, so the
coordinator knows the ranking is sensitive to water-level error.

## 7. Offline snapshots

For volunteer phones with no signal, precompute full rankings at fixed water levels
(+10, +20, +30 cm, …) and serve them directly. The field device shows the closest snapshot plus its
timestamp — no live computation needed.

## 8. How we'd validate it

- **Monotonicity:** the isolation time never gets *longer* as water rises.
- **Hand cases:** a household whose only bridge floods → a finite isolation time; one on high ground
  with two routes → still reachable.
- **Stability:** rankings stay broadly the same within the ±20 cm band for the demo dataset.
- **Degradation:** removing a household's elevation or a road segment produces the documented
  fallback, never a crash and never an invented route.
