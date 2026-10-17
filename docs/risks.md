# Risks & Mitigations

> Named openly, with what we do about each. The hackathon rules ask us to be explicit about
> behaviour under incomplete or wrong data — this is that list.

## Model risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| M1 | **False precision.** A countdown looks authoritative on a crude model. | Over-trust. | Label as a *scenario simulator, not a forecast*. Show a separate **confidence** value and explain the drivers per row. |
| M2 | The exposure index is a proxy, not a hydrological model. | Road closures are suggestive, not physical. | Documented in [`SIMULATION.md`](SIMULATION.md); thresholds are a 0–100 relative percentile, and the UI copy says so. |
| M3 | The monotonic-water assumption breaks if water recedes. | Time-to-isolation undefined for receding floods. | Documented limitation; receding scenarios out of MVP scope. |
| M4 | Vulnerability weights are heuristic. | Ranking may not reflect true clinical risk. | Weights are configurable and documented as judgement, not validated — [`SCORING.md`](SCORING.md). |
| M5 | The ranking depends on the exposure assumption and the illustrative rise rate. | The top-N could shift under different assumptions. | The index and weights are inspectable in one place; each row explains its drivers, and the tool is framed as comparative, not predictive. |

## Data risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| D1 | Missing vulnerability fields. | Less-informed ranking. | Missing values add **zero** points and lower the **confidence** value; the missing fields are listed per household. |
| D2 | Missing isolation data. | No computable countdown. | The household gets an explicit `unknown` status ("No route"); no fabricated time. |
| D3 | Road network data missing or stale. | Broken graph. | The graph is built offline and committed; a generation date is stamped in `meta.json`. |
| D4 | No real resident data available. | Cannot validate against ground truth. | Synthetic population with plausible distributions; clearly labelled, including in `data/README.md`. |
| D5 | Reports late, duplicated or wrong. | Bad inputs. | The MVP is model-driven; crowdsourced reports are future work, never trusted silently. |

## Runtime risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Judges can't install or run the app. | Submission fails to demo. | `npm install` + `npm run dev` from a clean clone; only open-source JS deps; data ships in the repo. |
| R2 | Runtime computation too slow on a few hundred households. | Demo stutters. | The heavy graph work is precomputed offline; the browser only does per-household arithmetic, which is instant. |
| R3 | Geospatial dependencies hard to install. | Judges can't regenerate data. | The Python pipeline is documented but **not** required to run the app — the JSON is committed. |
| R4 | The UI recomputes on each interaction. | Sluggish slider. | Only per-household arithmetic runs per change; there is no graph search at runtime. |

## UX / trust risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| U1 | Coordinator over-trusts the ranking. | Bad allocation. | Show the *why* per household (safe place, bottleneck road, top factors) plus the confidence value. |
| U2 | Low-confidence households get ignored. | People missed. | Low-confidence items are **surfaced, not hidden**, and clearly flagged. |
| U3 | The ranking is a black box. | No trust. | Every row shows its reason: *"only road to Shelter B floods at level X"*. |
| U4 | The countdown is mistaken for a promise. | Panic or complacency. | Copy labels it an estimate and the tool a *scenario simulator, not a forecast*. |

## Delivery risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| H1 | Deadline: 18 Oct 22:00 PKT. | Disqualification. | Freeze scope early; deploy link and record the video before the deadline. |
| H2 | The live link needs hosting. | Missing submission item. | Host on a free tier (Vercel / Netlify) with committed data so it runs without live downloads. |
| H3 | Work split across modules drifts. | Integration crunch. | Agree the interfaces (data shape, scenario level, ranking) up front. |

## Platform / hosting risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| P1 | **No backend available.** Only static hosting (Vercel / Netlify). | Any server-dependent feature is impossible. | Everything runs client-side; data is precomputed JSON shipped with the app. |
| P2 | Runtime computation runs on the main thread. | UI could freeze on a very slow device. | The dataset is small (400 households, ~5 k road features) and the per-level work is arithmetic only, so it stays well within a frame. |
| P3 | Precomputed data goes stale. | Misleading results if roads/areas change. | Stamp datasets with a generation date in `meta.json`; regenerate via the offline scripts; document it. |
| P4 | The road GeoJSON hurts first load. | Slow start on poor connections. | Coordinates are rounded and the JSON is served compressed; the app fetches five files once. |
| P5 | No live road/elevation data at runtime. | Can't react to real-time changes. | Accepted limitation; the tool is a scenario simulator fed by prepared data. |
| P6 | There is no explicit offline mode. | App needs a connection on first load. | Accepted limitation and stated honestly — there is no service worker or precomputed snapshot tier; the browser's HTTP cache may still serve repeat loads. |

## Safety note

Isolation Clock is a **decision-support and coordination aid**. It does not replace local knowledge,
official warnings, or on-the-ground judgement. Outputs are estimates with a separate confidence
value and must be validated by the coordinator before resources are committed.
