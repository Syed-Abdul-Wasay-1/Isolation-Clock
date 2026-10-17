# Priority score

The Isolation Clock priority score is an explainable, illustrative ranking aid. It combines
scenario urgency (up to 35 points) with household vulnerability (up to 50 points) and reports a
separate confidence value. It is not an operational rescue recommendation.

## Formula

For a household that is already isolated at the current scenario level:

```text
Urgency = 35
```

Otherwise, when estimated time to isolation (ETI) is known:

```text
Urgency = 35 × (1 − min(ETI in hours, 6) / 6)
```

An ETI of six hours or more contributes zero urgency points. If ETI is unavailable, urgency is
zero because the model has no time-to-cut-off estimate; the record remains in the pre-cut-off tab
unless it is already marked isolated.

Vulnerability points are added to urgency, with unknown values contributing no vulnerability
points:

| Factor | Points |
| --- | ---: |
| Age band is 65–74 or 75+ | 12 |
| Lives alone | 10 |
| Mobility is limited or wheelchair | 12 |
| Medical need | 10 |
| No phone | 6 |
| **Maximum vulnerability points** | **50** |

The total is the sum of urgency and known vulnerability points, bounded from 0 to 100. No points
are assigned for time spent isolated. Because urgency is capped at 35 and vulnerability at 50, the
maximum attainable score is 85. In the interface, points are displayed to one decimal place.

## Confidence and missing data

Confidence starts at 1.0 and decreases by an equal 0.2 for each of the five vulnerability fields
that is missing, with a floor of 0:

```text
Confidence = max(0, 1 − 0.2 × count(missing vulnerability fields))
```

A field is counted once if its value is null, undefined, or empty. The dataset has no verification
field; verification is not inferred and does not affect confidence. Missing values are listed in
the household's confidence notes. Confidence does not multiply, scale, or otherwise change the
score. Missing values contribute zero vulnerability points and are never interpreted as positive
vulnerability points.

The interface labels confidence High when 0–1 fields are missing, Medium for 2–3, and Low for 4 or
more.

## Limitations

- Household details are synthetic demonstration data, not verified reports about real residents.
- The weights and confidence penalty are illustrative, not validated against real-world outcomes,
  expert review, or a formal prioritization standard.
- The score uses coarse categories and does not represent the full range of individual needs,
  household circumstances, route conditions, available assistance, or changing hazards.
- A missing value lowers confidence but does not change score points; consequently, two equal
  scores can have different amounts of available data behind them.
- ETI depends on the scenario's modelled isolation level and default rise rate. It is not a flood
  forecast or a guarantee that a route is safe or passable.
