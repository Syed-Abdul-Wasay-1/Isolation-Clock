# Priority score

The Isolation Clock priority score is an explainable, illustrative ranking aid. It combines
scenario urgency (up to 35 points) with household vulnerability (up to 60 points) and reports a
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
| Help requested by SMS (unverified) | 10 |
| No phone | 6 |
| **Maximum vulnerability points** | **60** |

The total is the sum of urgency and known vulnerability points, bounded from 0 to 100. No points
are assigned for time spent isolated. Because urgency is capped at 35 and vulnerability at 60, the
maximum attainable score is 95. In the interface, points are displayed to one decimal place.
SMS-reported help and medical-need fields are explicitly marked unverified. A medical SMS only
fills a missing field; it does not overwrite a known value.

## Confidence and missing data

Confidence starts at 1.0 and decreases by an equal 0.2 for each of the five base vulnerability
fields that is missing, with a floor of 0. Every applied SMS check-in adds 0.2 confidence, capped
at 1.0 (High):

```text
Confidence = min(1, max(0, 1 − 0.2 × count(missing base fields) + 0.2 × SMS check-ins))
```

A field is counted once if its value is null, undefined, or empty. The dataset has no verification
field. SMS check-ins adjust confidence but do not verify a report. Missing base values are listed
in the household's confidence notes. Confidence does not multiply or scale the score. Missing
values contribute zero vulnerability points and are never interpreted as positive vulnerability
points.

The interface labels confidence High at 0.8 or above, Medium from 0.4 through 0.79, and Low below
0.4. Without check-ins, this is equivalent to High for 0–1 missing fields, Medium for 2–3, and Low
for 4 or more.

## Limitations

- Household details are synthetic demonstration data, not verified reports about real residents.
- The weights and confidence penalty are illustrative, not validated against real-world outcomes,
  expert review, or a formal prioritization standard.
- SMS check-ins are mock, unverified reports. The additional help-request weight and confidence
  increment are demonstration choices and must not be treated as operational rules.
- The score uses coarse categories and does not represent the full range of individual needs,
  household circumstances, route conditions, available assistance, or changing hazards.
- A missing value lowers confidence but does not change score points; consequently, two equal
  scores can have different amounts of available data behind them.
- ETI depends on the scenario's modelled isolation level and default rise rate. It is not a flood
  forecast or a guarantee that a route is safe or passable.
