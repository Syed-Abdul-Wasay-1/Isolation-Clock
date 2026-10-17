# Trade-offs

> The hackathon rules: *"Explain your trade-offs: what you chose, what you left out and why."*
> This is that explanation.

## The one big bet

**We rank by time-to-isolation, not by current flood depth.**

- **Why:** A person already at a shelter door needs nothing. A frail person on dry ground whose last
  road floods in 90 minutes needs everything. Depth ranks the wrong person first.
- **Cost:** A countdown implies a precision our model cannot fully justify.
- **What we accepted:** Always ship the number *with* a confidence band, and label the tool a
  scenario simulator — not a forecast.

## The platform constraint we designed around

**We have no backend — only static hosting (Vercel / Netlify).**

- **Why we accepted it:** in a flood the network may be down anyway, and a static app that computes
  locally is both easier to ship and better suited to the field.
- **What it cost us:** datasets must be **precomputed offline** and shipped as JSON instead of
  queried live; the study area and household count are kept small so the browser can compute fast;
  and anything server-shaped (accounts, live updates, a database) is simply out of scope.
- **What we gained:** no server to run, no API keys, no downtime, instant deploys, and an app that
  keeps working with no signal.

## What we built vs. what we cut

| Area | We built | We cut | Why |
|---|---|---|---|
| Study area | A few km², a few hundred households | City-wide coverage | The demo must run live without waiting. |
| Population | Synthetic, with realistic distributions | Real resident records | Privacy, plus zero data-availability dependency. |
| Hydrology | Simulated rising level + drainage loss | A full hydrodynamic model | Coarse elevation can't resolve urban drains; a full model would be false precision. |
| Routing | Paths to the nearest **open** shelter or hospital | Full multi-vehicle dispatch | We rank *who*; allocation stays human. |
| Vehicles | A travel-time suggestion | Assignment optimisation | Scope, and the coordinator keeps control. |
| Data quality | Fallback + badge + sensitivity band | Full statistical uncertainty | Fast, explainable, good enough for an MVP. |
| Connectivity | Precomputed offline snapshots | Live offline sync | Volunteers need *something* on a dead network, now. |
| Delivery | Static client-side app | Backend API / database | Only static hosting (Vercel/Netlify) is available, and it survives a dead network. |
| Hazards | Flood only | Heatwave, fire, etc. | The problem allows one slice; flood best fits the core idea. |

## Deliberate design decisions

1. **Config-driven, no magic numbers.** Every threshold and weight is exposed so judges can inspect
   and challenge each value.
2. **Graceful degradation over hard failure.** Missing elevation → neighbourhood average; offline →
   synthetic network; no route → an explicit message. The app never silently invents data.
3. **Surface uncertainty, don't hide it.** Low-confidence households appear *at the top*, flagged —
   we bias toward over-alerting.
4. **Explainable rows.** Every household shows *why*: the specific road and the estimated time.
   Trust comes from traceability, not from a score.
5. **Offline-first.** The field reality is a dead network; static snapshots beat a live app that
   cannot load.

## Known limitations we own

- Elevation is relative and coarse; road closure is a threshold, not physics.
- Travel speeds are constant; no traffic, debris or congestion.
- The population is synthetic and cannot be validated against ground truth.
- Water is monotonic only; receding-flood isolation times are undefined in this MVP.
- We rank — we do not dispatch. Vehicle routing is out of scope.

## Why this is still worth shipping

Even with those limits, Isolation Clock answers a question responders cannot currently answer at a
glance — **"who loses their last way out, and when?"** — and it does so in a way that degrades
honestly, explains itself, and works offline. That is a real improvement over a depth map alone.
