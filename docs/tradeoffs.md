# Trade-offs

> The hackathon rules: *"Explain your trade-offs: what you chose, what you left out and why."*
> This is that explanation.

## The one big bet

**We rank by time-to-isolation, not by current flood depth.**

- **Why:** A person already at a shelter door needs nothing. A frail person on dry ground whose last
  road floods in 90 minutes needs everything. Depth ranks the wrong person first.
- **Cost:** A countdown implies a precision our model cannot fully justify.
- **What we accepted:** Always ship the number *with* a separate confidence value and label the tool
  a scenario simulator — not a forecast.

## The platform constraint we designed around

**We have no backend — only static hosting (Vercel / Netlify).**

- **Why we accepted it:** in a flood the network may be down anyway, and a static app that computes
  locally is both easier to ship and better suited to the field.
- **What it cost us:** datasets must be **precomputed offline** and shipped as JSON instead of
  queried live; the study area and household count are kept small so the browser can compute fast;
  and anything server-shaped (accounts, live updates, a database) is simply out of scope.
- **What we gained:** no server to run, no API keys, no downtime, and instant deploys.

## What we built vs. what we cut

| Area | We built | We cut | Why |
|---|---|---|---|
| Study area | A few km², 400 households | City-wide coverage | The demo must run live without waiting. |
| Population | Synthetic, with realistic distributions | Real resident records | Privacy, plus zero data-availability dependency. |
| Hydrology | A relative exposure index from elevation + water distance | A hydrodynamic model, or a water depth in metres | Coarse elevation can't resolve urban drains; a depth model would be false precision. |
| Isolation level | Widest-path (maximin) level at which the last route closes | Per-minute simulation of the rising level | The monotonic assumption makes the widest-path level equivalent and far faster. |
| Routing | A nearest-*open* safe place, precomputed offline in Python | In-browser graph search | The graph math belongs offline; the browser only needs the result. |
| Ranking | Explainable priority score + confidence | Statistical uncertainty bands | Fast, explainable, and honest about what it is. |
| Allocation | A greedy boat / vehicle / bed **suggestion** | Globally optimal dispatch | Scope, and the coordinator keeps control; labelled as a suggestion, not dispatch. |
| Delivery | Static client-side app | Backend API / database | Only static hosting (Vercel/Netlify) is available. |
| Offline | Served statically, browser-cacheable | A service worker + precomputed snapshot tier | Extra build tooling for a benefit the demo doesn't need; the limitation is stated openly. |
| Hazards | Flood only | Heatwave, fire, etc. | The problem allows one slice; flood best fits the core idea. |

## Deliberate design decisions

1. **Precompute the heavy part.** All graph work runs once in Python; the shipped JSON is the
   contract, so the browser stays instant and the same data can be re-analysed offline.
2. **Config in one place.** The exposure weights, vulnerability weights, rise rate and resource pool
   are all inspectable and tunable, rather than magic numbers buried in components.
3. **Graceful degradation over hard failure.** Missing vulnerability data lowers confidence; missing
   isolation data becomes an explicit `unknown` status; missing capacity or household size uses a
   documented default. The app never silently invents data.
4. **Surface uncertainty, don't hide it.** Low-confidence households are flagged; every score is
   broken into its factors.
5. **Explainable rows.** Every household shows *why*: the safe place, the bottleneck road and the
   contributing factors. Trust comes from traceability, not from a score.

## Known limitations we own

- Exposure is relative and coarse; road closure is a threshold on a 0–100 index, not physics.
- `config.rise_rate_default` is illustrative, not measured or forecast.
- The population is synthetic and cannot be validated against ground truth.
- Water is monotonic only; receding-flood isolation times are undefined in this MVP.
- Resource matching is a greedy suggestion using straight-line distance — not dispatch, and not a
  globally optimal matching.
- There is no explicit offline mode (no service worker or precomputed snapshot tier).

## Why this is still worth shipping

Even with those limits, Isolation Clock answers a question responders cannot currently answer at a
glance — **"who loses their last way out, and when?"** — and it does so in a way that degrades
honestly and explains itself. That is a real improvement over a depth map alone.
