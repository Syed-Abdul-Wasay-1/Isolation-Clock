---
name: Isolation Clock Frontend
description: Use when editing the React/Leaflet UI - the map, ranking list, detail panel, allocation panel, before/after comparison, playback controls, loading/error states, or styles.css.
---

# Isolation Clock - frontend conventions

Vite + React 19 + TypeScript (strict), react-leaflet v5 + Leaflet, one stylesheet. No router, no
state library, no backend.

## Where things live

| Piece | File |
|---|---|
| Entry | `src/main.tsx` -> `src/App.tsx` -> `src/pages/IsolationClockPage.tsx` |
| Page state + playback + composition | `src/pages/IsolationClockPage.tsx` |
| Data loading | `src/hooks/useStudyData.ts` |
| Data validation (pure, tested) | `src/hooks/studyDataValidation.ts` |
| Map | `src/components/IsolationMap.tsx` |
| Priority list (tabs) | `src/components/RankingPanel.tsx` |
| Household detail ("why this rank") | `src/components/WhyRankPanel.tsx` |
| Boats / vehicles / beds UI | `src/components/ResourceAllocationPanel.tsx` |
| Hour-by-hour curve | `src/components/EscalationCurvePanel.tsx` |
| Ranked bottleneck roads | `src/components/CriticalRoadsPanel.tsx` |
| SMS check-in simulator | `src/components/SmsCheckinPanel.tsx` |
| Pinned before/after diff | `src/components/BeforeAfterPanel.tsx` |
| All styles | `src/styles.css` |

## State model

`IsolationClockPage` owns everything; components are presentational and receive props. There is no
global store, so a new feature usually means: a new piece of state in the page, a derived value
computed inline, and a prop on a child.

Derived values are recomputed on render (they are cheap at 400 households but visible in playback - see
Performance). Page state:

- `scenarioLevel` (0-100), `isPlaying`, `playbackStartLevel`, `playbackSpeed`, `pinnedSnapshot`,
  `selectedHouseholdId`, `activeTab` (`'rescue' | 'evacuate'`), `resourceConfig`.
- `focusedRoad` (a road key from the critical-roads panel, or null), `focusedHouseholdIds` (the
  reported-blocked dependants to highlight), and the SMS session: `smsMessages`, `smsOverrides`,
  `roadBlockReports`, offline mode and the queue.

Everything the SMS overrides do lives in `src/simulation/smsOverrides.ts` and
`src/simulation/smsCheckins.ts` — keep new SMS behaviour there, not in the page or a panel.

## Playback

Sweeps from the current level to 100 over `PLAYBACK_DURATION_MS` (20 s), ticking every
`PLAYBACK_TICK_MS` (100 ms), with 1x/2x speed. Time is tracked with `performance.now()` in refs, not
a counter, so changing speed mid-playback stays smooth. Dragging the slider stops playback and resets
its progress. Play is disabled at level 100.

## Map rules

- Roads are polylines coloured by `scenarioLevel >= threshold` (blue = scenario-closed, grey = open),
  plus two overlay styles: dashed purple for **reported blocked (unverified)** and a highlighted style
  for the focused road. They are grouped into a few style-keyed `<Polyline>` layers by
  `buildRoadClusters` — not one layer per segment (see Performance notes).
- Households are `CircleMarker`s coloured by status (`householdColors`), radius grows when selected.
- Shelter/hospital markers use `divIcon`. Household click selects it; the same click opens a `Popup`
  with rank, status, ETI, assignment and top reasons (annotations come from the page).
- The map **fits the study bounding box on mount** (`FitMapToData`), with `minZoom`/`maxZoom` bounds.
- Assignment lines are straight lines between household and safe place (shelter or hospital), because
  the allocator uses straight-line distance. Do not draw them as routed paths.
- Everything inside `<MapContainer>` must be a react-leaflet child component.

## Editing style to match

- Single quotes, **no semicolons**, 2-space indent, one component per file.
- `type` imports separated: `import type { X } from './x'`.
- Types live in `src/types/` or next to the module that owns them. Props are declared as an
  `interface XProps` above the component.
- Functional components with destructured props; early returns for loading/error.
- Interactive elements are real `<button>`s with `type="button"`, and carry `aria-*` where the
  existing code does (`role="tablist"`, `aria-selected`, `aria-labelledby`, `aria-live`).
- Numbers are formatted through the existing helpers (`formatEti`, `toFixed(1)`), not ad hoc.

## Performance notes

Playback re-renders the whole page ~10x/second: 400 markers plus the road layers, a re-sort and a full
allocation pass. It is fine at this size, but:

- **Roads are drawn as a few style-grouped polylines, not one layer per segment.** `buildRoadClusters`
  buckets the ~4,958 features into open / closed / reported-blocked / focused, and each bucket is a
  single `<Polyline>`. Do not "fix" this back into a `.map()` over every road: that was ~4,958 React
  elements and Leaflet layers per render, which was the actual jank, while classifying all of them
  costs ≈0.15 ms.
- Do not add per-tick work that is O(n^2).
- `useMemo` is already used for the scenario list; keep new heavy derivations memoised or derived from
  it rather than recomputed per marker.

## Data loading contract

`useStudyData` fetches the five JSON files, resolves paths against `import.meta.env.BASE_URL`
(deploy-safe under a sub-path), and hands them to the **pure** `validateStudyData` in
`src/hooks/studyDataValidation.ts`, which validates the arrays and each shelter/hospital record, checks
every household has an isolation record, and returns the assembled `StudyData` — or throws
`INVALID_STRUCTURE_MESSAGE` / the missing-household message. The hook exposes `loading | error | ready`.
If you add a data dependency, extend that validation (and its tests) rather than fetching inside a
component.

## Verify

```bash
npx tsc -b      # strict typecheck (noUnusedLocals is on: remove dead vars/imports)
npx oxlint
npm run build
npm run dev     # then check the map, both tabs, and the detail panel
```

`noUnusedLocals` and `noUnusedParameters` are enabled, so an unused import fails the build.
