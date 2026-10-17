# public/data/

**The JSON the app actually loads.** These files are served statically with the site and fetched by
the browser at startup. They are produced **offline** by the scripts in `../../scripts/` and are
small enough to commit.

## Files

| File | Contents |
|---|---|
| `households.json` | Household locations + vulnerability attributes (`households` array, `bounding_box`, seed/meta fields). |
| `shelters.json` | Shelter destinations with a name and bed capacity (`shelters` array). |
| `hospitals.json` | Hospital/clinic destinations with a name and capacity (`hospitals` array). |
| `roads.json` | The study-area road network as GeoJSON, one feature per edge with a 0–100 scenario threshold. |
| `isolation.json` | Per household: `isolation_level`, the best safe place and the bottleneck road, plus `config` (including `rise_rate_default`). |
| `meta.json` | Study area, generation date, seed and provenance for the offline build. |

## Rules for these files

- **Keep them small.** Coordinates are rounded and unused fields dropped. `roads.json` is the large
  one (~1 MB raw; served compressed).
- **Never hand-edit.** Regenerate via `scripts/` so results stay reproducible from the seed.
- **Stamp them.** `meta.json` records when and how the data was generated.
- **Self-contained at runtime.** The app needs no network call beyond fetching these static files.

> These files are synthetic. **No real resident data is present.** See [`../../data/README.md`](../../data/README.md).
