# scripts/

**Offline, run-once data preparation.** These helpers are *not* deployed and never run at request
time — they exist only to turn bulky source data into the compact JSON that ships in
`public/data/`.

```
data/ (raw inputs)  ──►  scripts/ (run once, locally)  ──►  public/data/*.json  ──►  browser
```

## What belongs here

| Step | Purpose | Implemented in |
|---|---|---|
| **Fetch / load** | Pull or read the OpenStreetMap extract and elevation data for the study area. | `generate_data.py`, `build_isolation_clock.py` |
| **Generate the population** | Create the synthetic households and destination points from a fixed seed. | `generate_data.py` |
| **Build the road network** | Reduce roads to the study-area network and score each node's exposure. | `build_isolation_clock.py` |
| **Compute isolation levels** | Run the reverse widest-path search from every shelter and hospital. | `build_isolation_clock.py` |
| **Emit JSON** | Write the compact, rounded files into `public/data/`, plus a `meta.json` stamp. | both scripts |

## Why offline

The app is frontend-only and hosted statically, so it cannot run Python or Node at request time.
Doing the heavy geospatial work **once, here**, keeps the browser bundle small and the app fast —
and means the data is reproducible from a seed rather than fetched live.

## Rules

- **Never run in the deployed app.** This folder is a dev-time tool, not a service.
- **Always reproducible.** Same seed ⇒ same output.
- **Write only to `public/data/`.** Keep the generated files small and committed.

> Two scripts implement this pipeline: `generate_data.py` (households, shelters, hospitals) and
> `build_isolation_clock.py` (road network, exposure thresholds and isolation levels). See
> [`../docs/DATA.md`](../docs/DATA.md) for the field-level reference.
