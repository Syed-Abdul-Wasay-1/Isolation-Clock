# data/

Inputs and documentation for Isolation Clock's data. Reminder: the app is **frontend-only**, so
nothing here is queried at runtime — it is the **source** that an offline script turns into the JSON
the browser actually loads.

## Where things live

| Location | Role | Committed? |
|---|---|---|
| `data/` (this folder) | Raw/source inputs and this documentation. Consumed by `scripts/`. | Large inputs are gitignored. |
| `public/data/` | The **precomputed JSON that ships with the app** and is fetched in the browser. | Yes — small, static. |

Flow:

```
data/ (raw inputs)  ──►  scripts/ (run once, offline)  ──►  public/data/*.json  ──►  browser
```

## What the datasets are

| Dataset | What it is |
|---|---|
| **Households** | One entry per synthetic household: a location plus vulnerability attributes (age band, mobility, lives alone, medical need, phone access, household size). |
| **Shelters & hospitals** | Destination points with a location, a name and a bed/patient capacity. |
| **Road network** | The study-area road network as GeoJSON, with a per-edge scenario threshold derived from node exposure. Built from OpenStreetMap; a synthetic grid is used only if the OSM query returns too few roads. |
| **Isolation levels** | Per household: the widest-path level at which its last route to a safe place closes, plus the safe place and bottleneck road for that route. |

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
