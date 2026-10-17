# Assumptions

> Every non-obvious assumption we made, stated plainly. Judges: this is the honest list.

## Hydrology

1. **Water rises monotonically** during a scenario (no receding phase in the MVP). This makes "once
   isolated, always isolated" true, which keeps the time-to-isolation calculation simple and fast.
2. **We simulate hydrology rather than solve it.** Coarse (≈30 m) elevation data cannot resolve
   urban drains, kerbs or micro-topography, so we model water as a level that rises over time and
   closes low-lying roads. We do not claim street-level flow accuracy.
3. **Road tolerance is about 0.30 m.** An assumed depth that a normal evacuation vehicle can still
   cope with. On foot the tolerance is lower. This is a tunable choice, not a constant.
4. **Drainage removes a fixed fraction of rainfall** up to a capacity. Real drainage is non-linear
   and blockage-prone; we treat this as a rough, adjustable loss.
5. **Elevation is relative, not an absolute datum.** We need to know *which road is lower*, not the
   exact height above sea level.

## Routing

6. **Travel happens on the road network only** — no cross-country or through-building shortcuts.
7. **Speeds are constant per mode** (walking, driving, emergency vehicle). We ignore traffic, debris
   and congestion.
8. **The nearest OPEN destination wins.** If the nearest shelter is inundated, we route to the next
   reachable one.
9. **Connectivity is binary.** A road is passable or it isn't; beyond the depth threshold we do not
   model partial passability (wading, high-clearance vehicles).
10. **We keep the largest connected part** of the network. Households outside it are reported as
    *no modelled route* — never silently dropped.

## Population

11. **The population is synthetic.** The distributions for age, disability, living alone, smartphone
    access and income are plausible for a flood-prone low-income urban area, but **no individual is
    real**. This is both a privacy and a data-availability choice.
12. **Vulnerability weights are heuristic.** They encode our judgement for demo clarity and are
    fully configurable. They are not a validated clinical model.
13. **One household = one decision unit**, even though real households vary in size and need.

## Data quality

14. **Missing elevation → neighbourhood average**, with a **low-confidence badge** and a widened
    time band.
15. **Missing or disconnected roads → the household is surfaced as urgent**, not hidden.
16. **Rankings are only as good as the water-level assumption**, so every ranking carries a
    sensitivity band.

## Scope and framing

17. **This is a scenario simulator, not a forecast.** A countdown looks authoritative on a crude
    model, so we label it explicitly and always show the band.
18. **We rank who needs help first; we do not assign vehicles.** Resource allocation stays with the
    human coordinator — we give them a defensible, explainable order.
19. **Offline snapshots are precomputed at fixed levels**, not updated live. The field device shows
    the closest snapshot plus a timestamp.
20. **The MVP targets a small study area** (a few square kilometres) so it is fast enough to demo
    live.

## Platform and delivery

21. **Frontend-only.** The app runs entirely in the browser (Vite + React + TypeScript) and is
    deployed as static files. There is no server, database or API to call.
22. **Hosting is static-only (Vercel / Netlify).** Everything must be servable as plain files, so no
    server-side rendering, background jobs or persistent storage at request time.
23. **Data is precomputed and shipped.** OSM and elevation inputs are reduced to compact JSON
    **offline**, once, and committed to `public/data/`. The app never queries OpenStreetMap live.
24. **The computation runs on the client.** The water model and time-to-isolation sweep execute in
    the visitor's browser (in a Web Worker). A weak device is therefore a real constraint, which is
    why the study area and household count are kept small.
25. **First load needs a connection; afterwards it should not.** Assets and data can be cached so the
    app keeps working offline — matching the field reality of a dead network.

## What we deliberately did NOT assume

- We do **not** assume household reports are timely or correct.
- We do **not** assume mobile connectivity exists during the event (hence offline snapshots).
- We do **not** assume the elevation data is accurate at building scale (hence simulation rather
  than terrain interpolation).
