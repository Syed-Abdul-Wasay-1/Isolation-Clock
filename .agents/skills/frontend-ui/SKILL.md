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
| Data loading + validation | `src/hooks/useStudyData.ts` |
| Map | `src/components/IsolationMap.tsx` |
| Priority list (tabs) | `src/components/RankingPanel.tsx` |
| Household detail ("why this rank") | `src/components/WhyRankPanel.tsx` |
| Boats / vehicles / beds UI | `src/components/ResourceAllocationPanel.tsx` |
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

## Playback

Sweeps from the current level to 100 over `PLAYBACK_DURATION_MS` (20 s), ticking every
`PLAYBACK_TICK_MS` (100 ms), with 1x/2x speed. Time is tracked with `performance.now()` in refs, not
a counter, so changing speed mid-playback stays smooth. Dragging the slider stops playback and resets
its progress. Play is disabled at level 100.

## Map rules

- Roads are polylines coloured by `scenarioLevel >= threshold` (blue = scenario-closed, grey = open).
- Households are `CircleMarker`s coloured by status (`householdColors`), radius grows when selected.
- Shelter/hospital markers use `divIcon`. Household click selects it; the same click opens a `Popup`
  with rank, status, ETI, assignment and top reasons (annotations come from the page).
- The map **fits the study bounding box on mount** (`FitMapToData`), with `minZoom`/`maxZoom` bounds.
- Assignment lines are straight lines between household and shelter, because the allocator uses
  straight-line distance. Do not draw them as routed paths.
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

Playback re-renders the whole page ~10x/second: 400 markers plus ~4,958 road polylines, a re-sort and
a full allocation pass. It is fine at this size, but:

- Do not add per-tick work that is O(n^2).
- If you touch the map, keep road polylines keyed by `edge_id` so React reuses them.
- `useMemo` is already used for the scenario list; keep new heavy derivations memoised or derived from
  it rather than recomputed per marker.

## Data loading contract

`useStudyData` fetches the five JSON files, resolves paths against `import.meta.env.BASE_URL`
(deploy-safe under a sub-path), validates the arrays and each shelter/hospital record, checks every
household has an isolation record, and returns `loading | error | ready`. If you add a data
dependency, extend that validation rather than fetching inside a component.

## Verify

```bash
npx tsc -b      # strict typecheck (noUnusedLocals is on: remove dead vars/imports)
npx oxlint
npm run build
npm run dev     # then check the map, both tabs, and the detail panel
```

`noUnusedLocals` and `noUnusedParameters` are enabled, so an unused import fails the build.
