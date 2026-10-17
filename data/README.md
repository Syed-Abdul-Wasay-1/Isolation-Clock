# data/

Inputs and documentation for Isolation Clock's data. Reminder: the app is **frontend-only**, so
nothing here is queried at runtime — it is the **source** that an offline script turns into the JSON
the browser actually loads.

## Where things live

| Location | Role | Committed? |
|---|---|---|
| `data/` (this folder) | Offline source inputs and this documentation. Consumed by `scripts/`. | Yes — the inputs are small and are kept so the pipeline stays reproducible |
| `public/data/` | The **precomputed JSON that ships with the app** and is fetched in the browser. | Yes — small, static |
| Large raw exports (`*.osm`, `*.pbf`, `*.tif`, `*.gpkg`, `*.shp`) | Downloadable again at will. | **No** — gitignored |

Flow:

```
data/ (raw inputs)  ──►  scripts/ (run once, offline)  ──►  public/data/*.json  ──►  browser
```

## What is actually committed under `data/`

| File | Size | What it is |
|---|---|---|
| `roads_27_688_27_711_68_838_68_883.graphml` | ~2.0 MB | The OpenStreetMap road graph for the study area, as loaded by the pipeline. Keeping it means the isolation levels can be recomputed offline without re-querying Overpass. |
| `buildings_27_688_27_711_68_838_68_883.geojson` | ~97 KB | OSM building footprints, used to place synthetic households. |
| `water_27_688_27_711_68_838_68_883.geojson` | ~66 KB | Water bodies, used for the distance-to-water part of the exposure score. |
| `elevations_27_688_27_711_68_838_68_883.json` | ~38 KB | The sampled elevation grid for the study area. |
| `amenities_27_688_27_711_68_838_68_883.geojson` | ~29 KB | OSM amenities (schools, mosques, clinics) that seed the shelter and hospital lists. |

Total committed working tree is under 4 MB, of which the only large file is the 1.15 MB
`public/data/roads.json` the browser actually loads. No file here needs Git LFS.

## What the datasets are

| Dataset | What it is |
|---|---|
| **Households** | One entry per synthetic household: a location plus vulnerability attributes (age band, mobility, lives alone, medical need, phone access, household size). |
| **Shelters & hospitals** | Destination points with a location, a name and a bed/patient capacity. |
| **Road network** | The study-area road network as GeoJSON, with a per-edge scenario threshold derived from node exposure. Built from OpenStreetMap; a synthetic grid is used only if the OSM query returns too few roads. |
| **Isolation levels** | Per household: the widest-path level at which its last route to a safe place closes, plus the safe place and bottleneck road for that route. |

### Isolation fields

`public/data/isolation.json` stores, per household:

| Field | Meaning |
|---|---|
| `isolation_level` | The widest-path (maximin) level at which the last route to a shelter or hospital closes. `null` when no route exists. |
| `nearest_safe_place_id` | The shelter or hospital on that best route. |
| `bottleneck_road` | The lowest-threshold edge on that best route — the road to watch — as an `edge_id` that matches `roads.json`. |
| `bottleneck_road_name` | The street's OpenStreetMap name for display, or the edge id again when the way carries no name. |

**Unnamed roads are the common case, not an error.** Only **356 of the study area's 4,958 drive
edges** have a `name` tag in OpenStreetMap at all (24 distinct streets). So of the 387 households with
a recorded route, **275 fall back to the edge id** and **112 name one of 9 streets** — Cinema Road,
Workshop Road, Archer Street, Military Road, High Court Road, Queen's Road, Labe Mehran Road, Teer
Chowk Bhutta Road and New Pind Road. The app renders the fallback rows as *"Unnamed road segment"*
and keeps the id as a muted secondary tag, so a raw edge id is never printed as though it were a road
name. Naming an unnamed way would be a claim the source data does not support, so it is not done.

Because `bottleneck_road` is always an edge id, every group is locatable and can be highlighted on
the map. The app still tolerates the older shape — a bare street name in `bottleneck_road` — that the
pre-regeneration file used. Regenerating needs Python with `osmnx` / `networkx` / `geopandas`; see
[`../scripts/README.md`](../scripts/README.md).

## How the synthetic data is generated

- **Reproducible.** A fixed random seed means the same dataset every time, so what a judge sees
  locally matches the demo in the README.
- **Plausible distributions.** Household attributes are sampled to resemble a flood-prone,
  low-income urban area — but the individuals are invented, not real.
- **Deliberately imperfect.** About 15% of household records have a blank field, so the
  confidence/missing-data behaviour is exercised by default. This is intended: the hackathon asks how
  the system behaves when data is incomplete.

Column-level detail for each dataset is added alongside the data as it is built.

## What this data is NOT

- **Not real residents.** No individual here corresponds to a real person.
- **Not a flood forecast.** Water levels are scenario inputs, not predictions.
- **Not survey-grade.** Locations and elevations are approximate by design.

## Licensing / attribution

- Road data (when OpenStreetMap is used): © OpenStreetMap contributors, ODbL.
- All synthetic data: released under this repo's [MIT License](../LICENSE).
