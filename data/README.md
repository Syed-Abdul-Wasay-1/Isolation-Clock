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
| **Households** | One entry per synthetic household: a location plus vulnerability attributes (age, disability, lives alone, smartphone access, income band). |
| **Destinations** | Shelters and hospitals with a location, type, capacity and an open/closed flag. |
| **Road graph** | The routable road network for the study area, with ground elevation per segment. Built from OpenStreetMap where available, with a synthetic grid fallback. |
| **Offline snapshots** | Precomputed priority rankings at fixed water levels (+10/+20/+30 cm) so field devices work with no connectivity. |

## How the synthetic data is generated

- **Reproducible.** A fixed random seed means the same dataset every time, so what a judge sees
  locally matches the demo in the README.
- **Plausible distributions.** Household attributes are sampled to resemble a flood-prone,
  low-income urban area — but the individuals are invented, not real.
- **Deliberately imperfect.** A share of households is missing elevation and a share of roads is
  missing, so the fallback and low-confidence behaviour is exercised by default. This is intended:
  the hackathon asks how the system behaves when data is incomplete.

Column-level detail for each dataset is added alongside the data as it is built.

## What this data is NOT

- **Not real residents.** No individual here corresponds to a real person.
- **Not a flood forecast.** Water levels are scenario inputs, not predictions.
- **Not survey-grade.** Locations and elevations are approximate by design.

## Licensing / attribution

- Road data (when OpenStreetMap is used): © OpenStreetMap contributors, ODbL.
- All synthetic data: released under this repo's [MIT License](../LICENSE).
