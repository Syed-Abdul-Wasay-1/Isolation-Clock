import { useState } from 'react'
import { formatPeopleCount } from '../simulation/population'
import { describeBottleneckRoad } from '../simulation/roadImpact'
import type { BottleneckRoadGroup } from '../simulation/roadImpact'

interface CriticalRoadsPanelProps {
  /** Groups for the current scenario level, most households first. */
  groups: BottleneckRoadGroup[]
  /** Households with no recorded bottleneck road at all. */
  withoutBottleneckCount: number
  withoutBottleneckPeople: number
  focusedBottleneckRoad: string | null
  onFocusRoad: (bottleneckRoad: string | null) => void
  onSelectHousehold: (householdId: string) => void
}

const VISIBLE_GROUPS = 8

export function CriticalRoadsPanel({
  groups,
  withoutBottleneckCount,
  withoutBottleneckPeople,
  focusedBottleneckRoad,
  onFocusRoad,
  onSelectHousehold,
}: CriticalRoadsPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleGroups = showAll ? groups : groups.slice(0, VISIBLE_GROUPS)
  const goal = groups[0]
  const goalRoad = goal
    ? describeBottleneckRoad(goal.bottleneckRoad, goal.displayName, goal.drawable)
    : null

  return (
    <section className="critical-roads-panel" aria-labelledby="critical-roads-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">BOTTLENECK ROADS</div>
          <h2 id="critical-roads-title">Critical roads</h2>
        </div>
      </div>
      <p className="section-intro">
        Which single road, if it fails, breaks the most households&rsquo; modelled route out.
      </p>
      {goal && goalRoad ? (
        <p className="critical-roads-lead">
          Worst single road: <strong>{goalRoad.label}</strong>
          {goalRoad.edgeId && <span className="road-edge-id"> ({goalRoad.edgeId})</span>} is the
          recorded bottleneck for <strong>{goal.households.length}</strong> of{' '}
          {groups.reduce((sum, group) => sum + group.households.length, 0)} households with a known
          route.
        </p>
      ) : (
        <p className="critical-roads-lead">No household has a recorded bottleneck road.</p>
      )}
      {groups.length > 0 && (
        <ol className="critical-roads-list">
          {visibleGroups.map((group) => {
            const isFocused = focusedBottleneckRoad === group.bottleneckRoad
            const road = describeBottleneckRoad(
              group.bottleneckRoad,
              group.displayName,
              group.drawable,
            )
            return (
              <li key={group.bottleneckRoad} className={isFocused ? 'is-focused' : undefined}>
                <button
                  className="critical-road-row"
                  type="button"
                  aria-pressed={isFocused}
                  onClick={() => onFocusRoad(isFocused ? null : group.bottleneckRoad)}
                >
                  <span className="critical-road-name">
                    <strong>{road.label}</strong>
                    {road.edgeId && <span className="road-edge-id">{road.edgeId}</span>}
                    {!group.drawable && (
                      <span className="critical-road-tag">street name only · no edge geometry</span>
                    )}
                    {group.threshold !== null && (
                      <span className="critical-road-tag">
                        closes at level {group.threshold.toFixed(1)}
                      </span>
                    )}
                  </span>
                  <span className="critical-road-counts">
                    <strong>{group.households.length}</strong> households ·{' '}
                    {formatPeopleCount(group.people)}
                  </span>
                </button>
                {isFocused && (
                  <div className="critical-road-detail">
                    <p>
                      {group.isolatedHouseholds} of these {group.households.length} households (
                      {group.isolatedPeople} people) are already isolated at this level and are counted
                      separately; the rest still have a modelled route.
                    </p>
                    <p>
                      Serves: {group.safePlaceIds.length > 0 ? group.safePlaceIds.join(', ') : 'unknown'}
                    </p>
                    {!group.drawable && (
                      <p>
                        Recorded as a street name only, so no edge geometry is stored and this road
                        cannot be highlighted on the map.
                      </p>
                    )}
                    {group.topHouseholdId && (
                      <button
                        className="critical-road-open"
                        type="button"
                        onClick={() => onSelectHousehold(group.topHouseholdId as string)}
                      >
                        Open top household ({group.topHouseholdId})
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {groups.length > VISIBLE_GROUPS && (
        <button
          className="show-all-button"
          type="button"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? `Show top ${VISIBLE_GROUPS}` : `Show all ${groups.length}`}
        </button>
      )}
      <p className="critical-roads-note">
        <strong>Impact preview, not a re-simulation.</strong> Each household&rsquo;s bottleneck is the
        lowest-threshold road on its <em>best</em> modelled route, precomputed offline. Counting the
        households that name this road does not prove the road&rsquo;s closure would isolate them — it
        shows how far the recorded route would have to be rebuilt.
        {withoutBottleneckCount > 0 &&
          ` ${withoutBottleneckCount} household${
            withoutBottleneckCount === 1 ? '' : 's'
          } (${withoutBottleneckPeople} people) have no recorded bottleneck road and are excluded.`}
      </p>
    </section>
  )
}
