import type { HouseholdStatus } from '../simulation/householdStatus'
import type { ResourceAllocation, ResourceAssignment } from '../simulation/resourceMatching'
import type { RankedHousehold } from './RankingPanel'

interface SnapshotRankedHousehold {
  householdId: string
  rank: number
  score: number
  status: HouseholdStatus
}

interface SnapshotAssignment {
  householdId: string
  assignment: ResourceAssignment
}

export interface PinnedScenarioSnapshot {
  level: number
  isolatedCount: number
  isolatedPeople: number
  rankedHouseholds: SnapshotRankedHousehold[]
  assignments: SnapshotAssignment[]
}

interface BeforeAfterPanelProps {
  snapshot: PinnedScenarioSnapshot
  currentLevel: number
  currentIsolatedCount: number
  currentIsolatedPeople: number
  rankedHouseholds: RankedHousehold[]
  allocation: ResourceAllocation
}

export function BeforeAfterPanel({
  snapshot,
  currentLevel,
  currentIsolatedCount,
  currentIsolatedPeople,
  rankedHouseholds,
  allocation,
}: BeforeAfterPanelProps) {
  const snapshotById = new Map(
    snapshot.rankedHouseholds.map((household) => [household.householdId, household]),
  )
  const snapshotAssignments = new Map(
    snapshot.assignments.map(({ householdId, assignment }) => [householdId, assignment]),
  )
  const newlyIsolated = rankedHouseholds
    .filter(({ scenario }) =>
      scenario.status === 'isolated' && snapshotById.get(scenario.household.id)?.status !== 'isolated',
    )
    .sort((first, second) =>
      second.priority.total - first.priority.total ||
      first.scenario.household.id.localeCompare(second.scenario.household.id),
    )
  const resourceChanges = Array.from(
    new Set([
      ...snapshotAssignments.keys(),
      ...allocation.assignments.keys(),
    ]),
  ).flatMap((householdId) => {
    const before = snapshotAssignments.get(householdId)
    const after = allocation.assignments.get(householdId)
    const beforeLabel = before?.resourceLabel
    const afterLabel = after?.resourceLabel
    if (beforeLabel === afterLabel) return []
    return [{
      householdId,
      change: [
        beforeLabel ? `lost ${beforeLabel}` : null,
        afterLabel ? `gained ${afterLabel}` : null,
      ].filter((item): item is string => item !== null).join('; '),
    }]
  })
  const topHousehold = rankedHouseholds[0]
  const previousTopRank = topHousehold
    ? snapshotById.get(topHousehold.scenario.household.id)?.rank
    : undefined
  const topAssignment = topHousehold
    ? allocation.assignments.get(topHousehold.scenario.household.id)
    : undefined
  const isolatedDifference = currentIsolatedCount - snapshot.isolatedCount
  const isolatedPeopleDifference = currentIsolatedPeople - snapshot.isolatedPeople
  const isolatedChangeText = isolatedDifference > 0
    ? `${isolatedDifference} more households (${isolatedPeopleDifference} more people) were cut off`
    : isolatedDifference < 0
      ? `${Math.abs(isolatedDifference)} fewer households (${Math.abs(isolatedPeopleDifference)} fewer people) are isolated`
      : 'the same number of households are isolated'
  const topMovementText = topHousehold
    ? previousTopRank === undefined
      ? `${topHousehold.scenario.household.id} is new at #1`
      : previousTopRank === 1
        ? `${topHousehold.scenario.household.id} remains at #1`
        : `${topHousehold.scenario.household.id} moved from #${previousTopRank} to #1`
    : 'no households are ranked'
  const summary = `Between level ${snapshot.level} and ${currentLevel}, ${isolatedChangeText}; ${topMovementText} and ${
    topAssignment ? `now gets ${topAssignment.resourceLabel}` : 'is now unassigned'
  }.`

  return (
    <section className="before-after-panel" aria-labelledby="before-after-title">
      <div className="before-after-heading">
        <div>
          <div className="eyebrow">PINNED SCENARIO COMPARISON</div>
          <h2 id="before-after-title">Before / after</h2>
        </div>
        <strong>Level {snapshot.level} → {currentLevel}</strong>
      </div>
      <div className="comparison-counts">
        <span>
          Isolated before <strong>{snapshot.isolatedCount}</strong> households ·{' '}
          <strong>{snapshot.isolatedPeople}</strong> people
        </span>
        <span>
          Isolated after <strong>{currentIsolatedCount}</strong> households ·{' '}
          <strong>{currentIsolatedPeople}</strong> people
        </span>
      </div>
      <p className="comparison-summary">{summary}</p>

      <section className="comparison-section" aria-labelledby="top-now-title">
        <h3 id="top-now-title">Top 10 now</h3>
        <ol className="comparison-list">
          {rankedHouseholds.slice(0, 10).map(({ scenario, priority }, index) => {
            const householdId = scenario.household.id
            const previousRank = snapshotById.get(householdId)?.rank
            const rankChange = previousRank === undefined
              ? { symbol: 'NEW', label: 'New in ranking', className: 'rank-change-new' }
              : previousRank > index + 1
                ? { symbol: '↑', label: `Up from #${previousRank}`, className: 'rank-change-up' }
                : previousRank < index + 1
                  ? { symbol: '↓', label: `Down from #${previousRank}`, className: 'rank-change-down' }
                  : { symbol: '—', label: 'Rank unchanged', className: 'rank-change-same' }
            return (
              <li key={householdId}>
                <span className="comparison-rank">#{index + 1}</span>
                <span className={`rank-change ${rankChange.className}`} aria-label={rankChange.label}>
                  {rankChange.symbol}
                </span>
                <strong>{householdId}</strong>
                <span className="comparison-assignment">
                  {allocation.assignments.get(householdId)?.resourceLabel ?? 'unassigned'}
                </span>
                <span className="comparison-score">{priority.total.toFixed(1)}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="comparison-section" aria-labelledby="newly-isolated-title">
        <h3 id="newly-isolated-title">Newly isolated since pin <span>{newlyIsolated.length}</span></h3>
        {newlyIsolated.length === 0 ? (
          <p className="comparison-empty">None</p>
        ) : (
          <ol className="comparison-list newly-isolated-list">
            {newlyIsolated.slice(0, 5).map(({ scenario, priority }) => (
              <li key={scenario.household.id}>
                <strong>{scenario.household.id}</strong>
                <span className="comparison-score">{priority.total.toFixed(1)} score</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="comparison-section" aria-labelledby="resource-changes-title">
        <h3 id="resource-changes-title">Resource changes <span>{resourceChanges.length}</span></h3>
        {resourceChanges.length === 0 ? (
          <p className="comparison-empty">No boat or vehicle assignment changes</p>
        ) : (
          <ul className="resource-change-list">
            {resourceChanges.map(({ householdId, change }) => (
              <li key={householdId}>
                <strong>{householdId}</strong>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
