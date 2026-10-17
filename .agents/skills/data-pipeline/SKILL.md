---
name: Isolation Clock Data Pipeline
description: Use when regenerating, adjusting or debugging the offline Python pipeline that produces public/data (scripts/generate_data.py, scripts/build_isolation_clock.py), or when the data files, their shapes, or the study area change.
---

# Isolation Clock - offline data pipeline

All data is generated **offline** by Python and committed to `public/data/`. The browser never
queries anything at runtime. Two scripts, in order.

```
data/ (raw OSM + caches)  ->  scripts/  ->  public/data/*.json  ->  browser
```

## Step 1 - `scripts/generate_data.py`

Produces `households.json`, `shelters.json`, `hospitals.json`, `meta.json`.

- Uses `osmnx` to fetch OSM buildings and amenities for the study bounding box, caching raw GeoJSON
  in `data/` (cache filenames include the bbox key).
- Places **400 households** on jittered OSM building centroids; falls back to points within 150 m of
  roads if fewer than 100 buildings are found.
- Four clusters, two of them "high risk" (older, more disability, fewer phones).
- Fixed seed `20261017` for reproducibility.
- Ritually blurs about 15% of records: `null` in `age_band`, `mobility`, `medical_need`,
  `lives_alone`, `has_phone`, `floor_level`, `last_contact_hours`.
- Shelters from OSM `school` / `community_centre` / `place_of_worship` (max 5); hospitals from
  `hospital` / `clinic` (max 2). Capacities are synthetic.
- `meta.json` records `fallback_used`, `fallback_details`, `buildings_found`, `amenity_counts`.

## Step 2 - `scripts/build_isolation_clock.py`

Produces `roads.json` and `isolation.json`. This is where the model is built.

1. Loads the cached `data/roads_<bbox>.graphml` drive graph (or downloads and keeps the largest
   connected component).
2. Loads per-node elevations from OpenTopoData/SRTM, cached in `data/elevations_<bbox>.json` with
   `elevation_source`. Falls back to a synthetic sine surface if the API fails. **Needs network**
   on first run, and the API is rate-limited (batches of 100, 1 s apart).
3. Downloads water features (`natural=water`, `waterway=river|canal|stream|drain`), cached as
   `data/water_<bbox>.geojson`.
4. Computes node exposure = `0.6 * normalised(elevation) + 0.4 * normalised(distance to water)`,
   then converts to a **percentile rank 0-1**, times 100.
5. Edge `threshold = 100 * min(exposure[u], exposure[v])`.
6. Runs a reverse **widest-path (maximin) Dijkstra** from every shelter and hospital to get each
   household's `isolation_level`, `nearest_safe_place_id`, `bottleneck_road`.
7. Writes `isolation.json` with `config.rise_rate_default = 10` and prints isolated counts per level.

## Output shapes - keep them stable

Defined in `src/types/study.ts` and described in `docs/DATA.md`. Highlights:

```jsonc
// isolation.json
{ "config": { "rise_rate_default": 10 },
  "households": [ { "id", "road_node_id", "isolation_level", "nearest_safe_place_id", "bottleneck_road" } ] }

// roads.json - GeoJSON FeatureCollection, one LineString per edge
{ "properties": { "edge_id", "threshold" }, "elevation_source": "..." }
```

`isolation_level` may be `null` when a household has no directed route; the app must keep handling
that, even though the current dataset has none.

## Rules

1. **Change the script, never hand-edit `public/data/*.json`.** Hand edits are overwritten and make
   the data unreproducible.
2. **Keep the seed.** A new seed invalidates README figures, screenshots and any numbers in `docs/`.
3. **Keep the output shape.** If a field is added or renamed, update `src/types/study.ts`,
   `docs/DATA.md` and `useStudyData.ts` validation together.
4. **Do not relabel the numbers.** `threshold` and `isolation_level` are a 0-100 relative index, not
   depth. `docs/SIMULATION.md` is the source of truth for that wording.
5. `scripts/__pycache__/` is committed in this repo. Ignore it; do not add to it deliberately.

## Verify after regenerating

```bash
node -e "const h=require('./public/data/households.json');console.log('households',h.households.length)"
node -e "const i=require('./public/data/isolation.json');const l=i.households.map(r=>r.isolation_level).filter(v=>v!==null);console.log('level range',Math.min(...l),Math.max(...l))"
node -e "const h=require('./public/data/households.json'),i=require('./public/data/isolation.json');const s=new Set(i.households.map(r=>r.id));console.log('missing isolation',h.households.filter(x=>!s.has(x.id)).length)"
npx tsc -b && npx oxlint && npm run build
```

Then confirm the app still loads (the hook throws a clear error if a file's shape is wrong) and
refresh anything user-visible that changed: `README.md`, `docs/DATA.md`, `docs/SIMULATION.md`,
screenshots.

Requirements live in `requirements.txt` (geopandas, osmnx, networkx, pyproj, shapely).
