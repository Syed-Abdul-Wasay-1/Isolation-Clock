# public/data/

**The JSON the app actually loads.** These files are served statically with the site and fetched by
the browser at startup. They are produced **offline** by the scripts in `../../scripts/` and are
small enough to commit.

## Files

| File | Contents |
|---|---|
| `households.json` | Household locations + vulnerability attributes (and a confidence flag). |
| `destinations.json` | Shelters and hospitals with location, type, capacity and open flag. |
| `road_graph.json` | The routable road network (GeoJSON) with ground elevation per segment. |
| `snapshots.json` | Precomputed priority rankings at +10 / +20 / +30 cm, for offline use. |
| `meta.json` | Study area, generation date, seed and the assumed water curve. |

## Rules for these files

- **Keep them small.** Round coordinates, drop unused fields, split by water level where it helps
  first load.
- **Never hand-edit.** Regenerate via `scripts/` so results stay reproducible from the seed.
- **Stamp them.** `meta.json` records when and how the data was generated.
- **They must be offline-safe.** The app should function with these files alone — no network calls.

> These files are synthetic. **No real resident data is present.** See [`../../data/README.md`](../../data/README.md).
