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
  medical need 10, no phone 6, SMS help request 10; max 60). Practical max is 95, displayed out of 100.
- Confidence (completeness) is separate from the score: 1 - 0.2 * (number of missing vulnerability
  fields), floored at 0. Missing fields add zero points and only lower confidence. Applied SMS
  check-ins are unverified and never raise it; they are reported as a separate count.
- Ranking: score desc, then ETI asc, then fewer missing fields, then household id. The number the user
  sees is the rank WITHIN the household's own tab (rescue or evacuate) and is the same in the list,
  the detail panel and the map popup; the before/after panel is the only cross-tab view and labels its
  column "overall priority, both tabs".
- Resource matching is greedy: already-isolated households get boats, others get vehicles, closest
  safe place with enough beds (straight-line Haversine distance), beds consumed by household size.
  Destinations are shelters AND hospitals: the isolation model already routes households to both.
- Escalation curve: at +h hours the level is min(100, scenarioLevel + h * riseRateDefault); the panel
  counts the households and people whose isolation_level is at or below that level. Hour 0 equals the
  set the ranking already calls isolated.
- An SMS road-block report (message 3) changes NOTHING in the model. The app ships road geometry and
  thresholds, not the road graph, so it cannot re-route. A report drives an impact preview only: a
  dashed unverified road on the map plus the households whose recorded bottleneck_road is that road.
- Household and people counts always appear together. A household with a missing household_size
  counts as a household but is excluded from the people total (never assumed to be 1 person).

DATA FILES (public/data/)
- households.json   400 synthetic households, 1043 people (some fields null on purpose)
- shelters.json     5 shelters, hospitals.json 2 hospitals (all with a capacity)
- roads.json        4958 LineString edges with { edge_id, threshold }
- isolation.json    config.rise_rate_default = 10, plus 400 per-household isolation records
- meta.json         study area, seed 20261017, fallback details

KNOWN DATA CAVEAT
- Every isolation.json bottleneck_road is now a locatable edge id, with the OSM street name (when the
  way has one) in bottleneck_road_name. Only 356 of the 4,958 drive edges are named at all, so 275 of
  the 387 routed households have no name and the UI shows them as "Unnamed road segment" with the id
  as a muted tag. public/data was regenerated in Oct 2026; the app still reads the older
  street-name-in-bottleneck_road shape.

KEY FILES
- src/pages/IsolationClockPage.tsx      page state, playback, focus, ranking composition
- src/simulation/householdStatus.ts     ETI + status
- src/simulation/priorityScore.ts       score, confidence, comparator
- src/simulation/smsOverrides.ts        applies SMS overrides, returns the ranked order
- src/simulation/smsCheckins.ts         SMS override/check-in/road-block types + pure helpers
- src/simulation/resourceMatching.ts    boats/vehicles/bed assignment (shelters + hospitals)
- src/simulation/roadImpact.ts          bottleneck-road groups + nearest road segments
- src/simulation/escalation.ts          households + people per hour ahead
- src/simulation/population.ts          household/people counting
- src/simulation/geo.ts                 straight-line distance
- src/hooks/useStudyData.ts             loads the JSON
- src/hooks/studyDataValidation.ts      pure, tested validation -> StudyData
- src/components/                       IsolationMap, RankingPanel, WhyRankPanel,
                                        ResourceAllocationPanel, EscalationCurvePanel,
                                        CriticalRoadsPanel, SmsCheckinPanel, BeforeAfterPanel
- tests/                                node:test over src/simulation/ and the data validation
- docs/ the authoritative spec: methodology.md, SCORING.md, ALLOCATION.md, SIMULATION.md, SMS.md,
  DATA.md, assumptions.md, risks.md, tradeoffs.md, architecture.md

RULES FOR YOUR ANSWER
1. Do not invent features that do not exist. If something is only in docs/ but not in src/, say so.
2. Keep household data synthetic and never imply this is a forecast.
3. If you change a weight, formula or file shape, update the matching doc under docs/ and say which
   one you changed.
4. Preserve the relative units. Do not call the scenario level "cm" or "metres".
5. Keep changes consistent with the existing style: single quotes, no semicolons, small typed
   functions, accessibility attributes on interactive UI.
6. In src/simulation/, value imports between modules MUST use an explicit .ts extension, because the
   tests import these files directly with node --test. Type-only imports may omit it.
7. Add a test in tests/ whenever you change the model. Do not commit or push: leave changes in the
   working tree for the human to review.
8. Tell me how you verified the change (npx tsc -b, npx oxlint, npm run build, npm test) and what you
   could not verify.
```

---

## After you are done

Add an entry to [`prompts.md`](prompts.md) with the goal, the prompt you used, the model, and the outcome.
See [`templates/05-update-docs.md`](templates/05-update-docs.md) if you want the assistant to draft it.
