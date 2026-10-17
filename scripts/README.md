# scripts/

**Offline, run-once data preparation.** These helpers are *not* deployed and never run at request
time — they exist only to turn bulky source data into the compact JSON that ships in
`public/data/`.

```
data/ (raw inputs)  ──►  scripts/ (run once, locally)  ──►  public/data/*.json  ──►  browser
```

## What belongs here

| Step | Purpose |
|---|---|
| **Fetch / load** | Pull or read the OpenStreetMap extract and elevation data for the study area. |
| **Build the road graph** | Reduce roads to a routable network and attach a ground elevation to each segment. |
| **Generate the population** | Create the synthetic households and destinations from a fixed seed. |
| **Emit JSON** | Write the compact, rounded files into `public/data/`, plus a `meta.json` stamp. |
| **Precompute snapshots** | Produce the offline rankings at fixed water levels. |

## Why offline

The app is frontend-only and hosted statically, so it cannot run Python or Node at request time.
Doing the heavy geospatial work **once, here**, keeps the browser bundle small and the app fast —
and means the data is reproducible from a seed rather than fetched live.

## Rules

- **Never run in the deployed app.** This folder is a dev-time tool, not a service.
- **Always reproducible.** Same seed ⇒ same output.
- **Write only to `public/data/`.** Keep the generated files small and committed.

> The implementation of these scripts is added when the app is scaffolded; this folder currently
> documents the intended pipeline.
