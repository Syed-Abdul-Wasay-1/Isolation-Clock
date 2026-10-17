# Assumptions

> Every non-obvious assumption we made, stated plainly. Judges: this is the honest list.

## Hydrology

1. **Water rises monotonically** during a scenario (no receding phase in the MVP). This makes "once
   isolated, always isolated" true, which keeps the time-to-isolation calculation simple and fast.
2. **We simulate exposure rather than solve hydrology.** Coarse (≈30 m) elevation data cannot
   resolve urban drains, kerbs or micro-topography, so we build a *relative* exposure index from
   elevation and distance to mapped water and let the user explore how road access changes. We do
   not claim street-level flow accuracy and we do **not** compute a water depth.
3. **Roads close on a relative 0–100 index, not a depth.** Each road edge gets a threshold from the
   percentile rank of its endpoints' exposure. There is **no depth tolerance in metres**: a road is
   treated as closed once the scenario level reaches its threshold. The number is a comparative
   scenario index, not centimetres of water.
4. **Drainage is not modelled.** We deliberately skip a drainage term; there is not enough data to
   parameterise one honestly. The scenario level is driver-independent and illustrative.
5. **Elevation is relative, not an absolute datum.** We need to know *which road is lower*, not the
   exact height above sea level.
6. **The default rise rate is illustrative.** `config.rise_rate_default` is 10 index points per hour
   — a scenario setting, not a measured or predicted rate of rise.

## Routing

7. **Travel happens on the road network only** — no cross-country or through-building shortcuts.
8. **A household is reachable while any route to a safe place survives**, where a route's
   survivability is its weakest (lowest-threshold) edge. The isolation level is the highest bottleneck
   threshold across all routes to a shelter or hospital — a widest-path (maximin), not a
   shortest-path, quantity.
9. **Straight-line distance is used for resource suggestions.** `resourceMatching` picks the closest
   shelter by Haversine distance, not routed travel time.
10. **Passability is binary at the threshold.** A road is open or closed; beyond the threshold we do
    not model partial passability (wading, high-clearance vehicles).
11. **We keep the largest connected part** of the network. Households outside it are reported as
    *no modelled route* — never silently dropped.

## Population

12. **The population is synthetic.** The distributions for age, mobility, living alone, phone access
    and medical need are plausible for a flood-prone low-income urban area, but **no individual is
    real**. This is both a privacy and a data-availability choice.
13. **Vulnerability weights are heuristic.** They encode our judgement for demo clarity and are
    fully configurable — see [`SCORING.md`](SCORING.md). They are not a validated clinical model.
14. **One household = one decision unit**, even though real households vary in size and need.
    Household size is read where present and defaults to 4 when missing, with the assumption flagged.

## Data quality

15. **Missing vulnerability data lowers confidence, not score.** A null field contributes zero
    vulnerability points and reduces the confidence value; it is surfaced in the UI, never hidden and
    never treated as a positive signal.
16. **Missing isolation data is explicit.** If a household has no computable `isolation_level` its
    status is `unknown` and it is shown as such — no fabricated ETI.
17. **Missing shelter capacity or household size falls back to a documented default** (40 beds, 4
    people) and the UI identifies the records that relied on the assumption.

## Scope and framing

18. **This is a scenario simulator, not a forecast.** A countdown looks authoritative on a crude
    model, so we label it explicitly and always show a separate confidence value.
19. **We rank who needs help first, and we suggest a resource allocation.** `resourceMatching` makes
    a greedy boat/vehicle/bed suggestion — it is explicitly **not** dispatch and **not** a globally
    optimal matching. Final decisions stay with the coordinator.
20. **There is no offline snapshot or service worker.** The app is served statically and the browser
    may cache assets, but there is no precomputed snapshot tier and no guaranteed offline mode.
21. **The MVP targets a small study area** (a few square kilometres, 400 households) so it is fast
    enough to demo live.

## Platform and delivery

22. **Frontend-only.** The app runs entirely in the browser (Vite + React + TypeScript) and is
    deployed as static files. There is no server, database or API to call.
23. **Hosting is static-only (Vercel / Netlify).** Everything must be servable as plain files, so no
    server-side rendering, background jobs or persistent storage at request time.
24. **Data is precomputed and shipped.** OSM and elevation inputs are reduced to compact JSON
    **offline**, once, by `scripts/`, and committed to `public/data/`. The app never queries
    OpenStreetMap live.
25. **The runtime computation runs on the main thread.** With isolation levels precomputed, the
    browser only converts them to ETI and re-ranks — fast enough that no Web Worker is used.

## What we deliberately did NOT assume

- We do **not** assume household reports are timely or correct — the MVP is model-driven; reports
  are future work and are never trusted silently.
- We do **not** assume the elevation data is accurate at building scale — hence a relative exposure
  index rather than a terrain flood-depth model.
- We do **not** assume the scenario level corresponds to real water depth or to a rainfall
  forecast; it is a comparative index the coordinator explores.
