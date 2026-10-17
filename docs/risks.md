# Risks & Mitigations

> Named openly, with what we do about each. The hackathon rules ask us to be explicit about
> behaviour under incomplete or wrong data — this is that list.

## Model risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| M1 | **False precision.** A countdown looks authoritative on a crude model. | Over-trust. | Label as a *scenario simulator, not a forecast*. Always show the confidence band. |
| M2 | Coarse elevation data misses urban drains. | Wrong road closures. | Simulate hydrology rather than trusting terrain; expose tolerance and drainage as tunable knobs. |
| M3 | The monotonic-water assumption breaks if water recedes. | Time-to-isolation undefined for receding floods. | Documented limitation; receding scenarios out of MVP scope. |
| M4 | Vulnerability weights are heuristic. | Ranking may not reflect true clinical risk. | Weights are configurable and documented as judgement, not validated. |
| M5 | The ranking is sensitive to water-level error. | The top-N changes with ±20 cm. | Sensitivity band; a **fragile** flag when a household drops out across the band. |

## Data risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| D1 | Missing household elevation. | Wrong isolation time. | Neighbourhood-average fallback + low-confidence badge + widened band. |
| D2 | Missing road segments / disconnected network. | Unroutable household. | Report *no modelled route*; surface as highest urgency with low confidence. |
| D3 | Road network data missing or stale. | Broken graph. | Built-in synthetic road-grid fallback. |
| D4 | No real resident data available. | Cannot validate against ground truth. | Synthetic population with plausible distributions; clearly labelled. |
| D5 | Reports late, duplicated or wrong. | Bad inputs. | The MVP is model-driven; crowdsourced reports are future work, never trusted silently. |

## Runtime risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Road-network download slow / judges offline. | App won't start. | Cached network + synthetic fallback + a documented offline mode. |
| R2 | Live simulation too slow on a few hundred households. | Demo stutters. | Use the monotonic property to compute isolation times efficiently; cache per level. |
| R3 | Geospatial dependencies hard to install. | Judges can't run it. | Keep import-time dependencies minimal; document install; provide fallbacks. |
| R4 | The UI recomputes everything on each interaction. | Sluggish slider. | Cache heavy steps; only re-rank when the water level changes. |

## UX / trust risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| U1 | Coordinator over-trusts the ranking. | Bad allocation. | Show the *why* per household (the actual road and time). Show band + confidence. |
| U2 | Low-confidence households get ignored. | People missed. | Low-confidence items are **surfaced, not hidden**, and clearly flagged. |
| U3 | The ranking is a black box. | No trust. | Every row shows its reason: *"only road to Shelter B floods in ~1h 40m"*. |
| U4 | The countdown is mistaken for a promise. | Panic or complacency. | Copy labels it an estimate with a band: "simulator, not forecast". |

## Delivery risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| H1 | Deadline: 18 Oct 22:00 PKT. | Disqualification. | Freeze scope early; deploy link and record the video before the deadline. |
| H2 | The live link needs hosting. | Missing submission item. | Host on a free tier with committed fallback data so it runs without live downloads. |
| H3 | Work split across modules drifts. | Integration crunch. | Agree the interfaces (data shape, water curve, ranking) up front. |

## Platform / hosting risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| P1 | **No backend available.** Only static hosting (Vercel / Netlify). | Any server-dependent feature is impossible. | Everything runs client-side; data is precomputed JSON shipped with the app. |
| P2 | Heavy graph math runs in the browser. | UI freezes on slow devices. | Run the ETI sweep in a **Web Worker**; keep the study area and household count small. |
| P3 | Precomputed data goes stale. | Misleading results if roads/areas change. | Stamp datasets with a generation date; regenerate via the offline script; document it. |
| P4 | Large JSON hurts first load. | Slow start on poor connections. | Ship compact, minified, rounded coordinates; split by level; cache aggressively. |
| P5 | No live road/elevation data at runtime. | Can't react to real-time changes. | Accepted limitation; the tool is a scenario simulator fed by prepared data. |
| P6 | Offline availability depends on caching. | App unusable with no cache. | Provide a cached/prerendered build and a downloadable offline snapshot. |

## Safety note

Isolation Clock is a **decision-support and coordination aid**. It does not replace local knowledge,
official warnings, or on-the-ground judgement. Outputs are estimates with confidence bands and must
be validated by the coordinator before resources are committed.
