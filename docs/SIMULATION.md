# Simulation model

**Isolation Clock is a scenario simulator, not a flood forecast.** Its road thresholds do
not predict when or where water will flood. They let users explore how road access changes
under an assumed rising-water scenario.

The road network is built from OpenStreetMap. Households, shelters and hospitals are snapped
to their nearest road node. Each road edge receives a threshold from the relative elevation
and distance-to-water scores of its endpoint nodes. The combined node exposure is converted
to a percentile rank across the study-area road nodes; the resulting 0–100 threshold is a
**relative scenario index (percentile of exposure), not a water depth**. For a household,
`isolation_level` is the highest bottleneck threshold among its routes to a shelter or
hospital: a route's bottleneck is the lowest edge threshold along that route.
`isolation.json` stores these levels and the safe place and bottleneck road associated with
the best route; it does not precompute estimated times to isolation (ETIs).

Elevation and water distance are used as **proxies**, not as a hydrological model. Relative
elevation helps distinguish higher and lower ground, while proximity to mapped rivers,
canals, streams, drains and water bodies provides a rough indicator of exposure. They are
combined heuristically because street-scale flood depths and flow require detailed terrain,
drainage and rainfall data that this study does not have. The result is useful for comparing
scenarios, but it is not a statement of actual flood depth, a validated risk estimate, or a
forecast.

The `config.rise_rate_default` value in `public/data/isolation.json` is **10 index points per
hour (illustrative scenario setting)**. It is not inferred from local rainfall or
hydrological measurements and must not be interpreted as a predicted rate of rise.

## Road-block reports do not change the model

A **road-block report** from the SMS panel (message `3`) does not change any threshold, any
`isolation_level` or any ETI. The app ships road geometry and thresholds only — **not the road
graph** — so it cannot re-run routing in the browser. A report is drawn as a dashed *reported
blocked* segment and shows an **impact preview**: the households that recorded that road as the
bottleneck of their best modelled route. It is never presented as a closed road, and the ETI
countdowns do not move. See [`SMS.md`](SMS.md).
