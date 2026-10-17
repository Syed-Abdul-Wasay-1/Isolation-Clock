# Project context primer

Paste this into a fresh AI chat before asking for anything on this repo. It gets the assistant to
the same starting point every time, so you spend your prompt on the actual task.

---

## Copied prompt

```text
You are helping on "Isolation Clock", a frontend-only flood scenario simulator for Sukkur, Sindh,
Pakistan, built for the CODE//CONNECT'26 Vibe Coding Hackathon (Problem A - Disaster Response).

WHAT IT DOES
It does not rank by current flood depth. It ranks by time until isolation (ETI): how long before
every road out of a household is closed and it can no longer be reached.

STACK
- Vite + React 19 + TypeScript (strict), react-leaflet + Leaflet for the map.
- No backend, no database, no runtime API. Everything is computed in the browser from precomputed
  static JSON in public/data/.
- Data is generated offline by Python scripts in scripts/ (osmnx, networkx, geopandas).
- Lint: oxlint. Typecheck/build: tsc -b && vite build.

THE MODEL (do not change the meaning of these without saying so)
- Scenario level: a unitless 0-100 slider. It is a relative exposure index, NOT water depth in cm.
- Each road edge has a threshold 0-100. The road is treated as closed when scenarioLevel >= threshold.
- isolation_level (per household, precomputed): the highest scenario level at which a route to a
  shelter or hospital still exists. It is a widest-path (maximin) value: the maximum, over routes, of
  the route's lowest edge threshold. Stored in public/data/isolation.json.
- ETI hours = max(0, (isolation_level - scenarioLevel) / riseRateDefault), riseRateDefault = 10.
- Status: isolated when scenarioLevel >= isolation_level; urgent when ETI <= 3 h; else safe;
  unknown when isolation_level is null.
- Priority score = urgency (max 35) + vulnerability (age 65+ 12, lives alone 10, mobility 12,
  medical need 10, no phone 6; max 50). Practical max is 85, displayed out of 100.
- Confidence is separate from the score: 1 - 0.2 * (number of missing vulnerability fields).
  Missing fields add zero points and only lower confidence.
- Ranking: score desc, then ETI asc, then fewer missing fields, then household id.
- Resource matching is greedy: already-isolated households get boats, others get vehicles, closest
  shelter with enough beds (straight-line Haversine distance), beds consumed by household size.

DATA FILES (public/data/)
- households.json   400 synthetic households (some fields null on purpose)
- shelters.json     5 shelters, hospitals.json 2 hospitals
- roads.json        4958 LineString edges with { edge_id, threshold }
- isolation.json    config.rise_rate_default = 10, plus 400 per-household isolation records
- meta.json         study area, seed 20261017, fallback details

KEY FILES
- src/pages/IsolationClockPage.tsx   page state, playback, ranking composition
- src/simulation/householdStatus.ts  ETI + status
- src/simulation/priorityScore.ts    score, confidence, comparator
- src/simulation/resourceMatching.ts boats/vehicles/bed assignment
- src/hooks/useStudyData.ts          loads and validates the JSON
- src/components/                    IsolationMap, RankingPanel, WhyRankPanel,
                                     ResourceAllocationPanel, BeforeAfterPanel
- docs/ the authoritative spec: methodology.md, SCORING.md, ALLOCATION.md, SIMULATION.md,
  assumptions.md, risks.md, tradeoffs.md

RULES FOR YOUR ANSWER
1. Do not invent features that do not exist. If something is only in docs/ but not in src/, say so.
2. Keep household data synthetic and never imply this is a forecast.
3. If you change a weight, formula or file shape, update the matching doc under docs/ and say which
   one you changed.
4. Preserve the relative units. Do not call the scenario level "cm" or "metres".
5. Keep changes consistent with the existing style: single quotes, no semicolons, small typed
   functions, accessibility attributes on interactive UI.
6. Tell me how you verified the change (tsc -b, oxlint, npm run build) and what you could not verify.
```

---

## After you are done

Add an entry to [`prompts.md`](prompts.md) with the goal, the prompt you used, the model, and the outcome.
See [`templates/05-update-docs.md`](templates/05-update-docs.md) if you want the assistant to draft it.
