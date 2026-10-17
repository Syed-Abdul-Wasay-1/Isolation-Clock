import { useRef, useState } from 'react'
import { formatEti } from '../simulation/householdStatus'
import { compareHouseholdIds } from '../simulation/householdStatus'
import type { PeopleCount } from '../simulation/population'
import type { PriorityScore } from '../simulation/priorityScore'
import {
  compareHouseholdPriority,
  PRIORITY_WEIGHTS,
  URGENCY_MAX_POINTS,
} from '../simulation/priorityScore'
import type { HouseholdScenario } from '../simulation/householdStatus'
import type { ResourceAllocation } from '../simulation/resourceMatching'

export interface RankedHousehold {
  scenario: HouseholdScenario
  priority: PriorityScore
}

export type RankingTab = 'rescue' | 'evacuate'
export type RankingSort = 'priority' | 'id'

interface RankingPanelProps {
  isolatedHouseholds: RankedHousehold[]
  evacuateHouseholds: RankedHousehold[]
  isolatedCount: number
  totalHouseholds: number
  isolatedPeople: PeopleCount
  totalPeople: PeopleCount
  activeIsolatedPeople: PeopleCount
  selectedHouseholdId: string | null
  /** Priority rank inside the household's own tab (rescue or evacuate). */
  priorityRankInTab: Map<string, number>
  activeTab: RankingTab
  onTabChange: (tab: RankingTab) => void
  onSelectHousehold: (householdId: string) => void
  allocation: ResourceAllocation
  sortBy: RankingSort
  onSortChange: (sortBy: RankingSort) => void
}

export function RankingPanel({
  isolatedHouseholds,
  evacuateHouseholds,
  isolatedCount,
  totalHouseholds,
  isolatedPeople,
  totalPeople,
  activeIsolatedPeople,
  selectedHouseholdId,
  priorityRankInTab,
  activeTab,
  onTabChange,
  onSelectHousehold,
  allocation,
  sortBy,
  onSortChange,
}: RankingPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const rescueTabRef = useRef<HTMLButtonElement | null>(null)
  const evacuateTabRef = useRef<HTMLButtonElement | null>(null)
  const tabOrder: RankingTab[] = ['rescue', 'evacuate']

  /** WAI-ARIA tab pattern: arrow keys move both the selection and the focus. */
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = tabOrder.indexOf(activeTab)
    const select = (tab: RankingTab) => {
      onTabChange(tab)
      const ref = tab === 'rescue' ? rescueTabRef : evacuateTabRef
      ref.current?.focus()
    }
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        select(tabOrder[(current - 1 + tabOrder.length) % tabOrder.length])
        break
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        select(tabOrder[(current + 1) % tabOrder.length])
        break
      case 'Home':
        event.preventDefault()
        select(tabOrder[0])
        break
      case 'End':
        event.preventDefault()
        select(tabOrder[tabOrder.length - 1])
        break
    }
  }

  const households = [...(activeTab === 'rescue' ? isolatedHouseholds : evacuateHouseholds)]
  households.sort((first, second) => {
    switch (sortBy) {
      case 'id':
        return compareHouseholdIds(
          first.scenario.household.id,
          second.scenario.household.id,
        )
      case 'priority':
        return compareHouseholdPriority(
          first.scenario,
          first.priority,
          second.scenario,
          second.priority,
        )
    }
  })
  const visibleHouseholds = households.slice(0, 20)

  return (
    <section className="ranking-section" aria-labelledby="ranking-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">HOUSEHOLD PRIORITY</div>
          <h2 id="ranking-title">Needs attention</h2>
        </div>
        <div className="isolated-count">
          <strong>{isolatedCount}</strong>
          <span>households isolated / {totalHouseholds}</span>
          <span className="isolated-people">
            {isolatedPeople.people} of {totalPeople.people} people
            {totalPeople.unknownSizeHouseholds > 0 &&
              ` · ${totalPeople.unknownSizeHouseholds} household${
                totalPeople.unknownSizeHouseholds === 1 ? '' : 's'
              } of unknown size`}
          </span>
        </div>
      </div>
      <div
        className="ranking-tabs"
        role="tablist"
        aria-label="Household priority group"
        onKeyDown={handleTabKeyDown}
      >
        <button
          id="tab-rescue"
          ref={rescueTabRef}
          className={`ranking-tab${activeTab === 'rescue' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'rescue'}
          aria-controls="ranking-list"
          tabIndex={activeTab === 'rescue' ? 0 : -1}
          onClick={() => onTabChange('rescue')}
        >
          Needs rescue now <span>{isolatedHouseholds.length}</span>
        </button>
        <button
          id="tab-evacuate"
          ref={evacuateTabRef}
          className={`ranking-tab${activeTab === 'evacuate' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'evacuate'}
          aria-controls="ranking-list"
          tabIndex={activeTab === 'evacuate' ? 0 : -1}
          onClick={() => onTabChange('evacuate')}
        >
          Evacuate before cut-off <span>{evacuateHouseholds.length}</span>
        </button>
      </div>
      <p className="section-intro">
        {activeTab === 'rescue'
          ? `Households already isolated at this scenario level — ${isolatedHouseholds.length} households, ${activeIsolatedPeople.people} people.`
          : `Households not yet isolated — ${evacuateHouseholds.length} households, ${activeIsolatedPeople.people} people.`}
      </p>
      <div className="ranking-list-controls">
        <label>
          Sort by
          <select
            aria-label="Sort households by"
            value={sortBy}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (value === 'priority' || value === 'id') {
                onSortChange(value)
              }
            }}
          >
            <option value="priority">Priority rank</option>
            <option value="id">Household number</option>
          </select>
        </label>
        {households.length > 20 && (
          <button
            className="show-all-button"
            type="button"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? 'Show top 20' : 'Show all'}
          </button>
        )}
      </div>
      <div className="ranking-list" id="ranking-list" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {households.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">✓</span>
            <strong>
              {activeTab === 'rescue'
                ? 'No households are isolated at this level'
                : 'All modelled households are isolated'}
            </strong>
            <span>Adjust the scenario level to explore other conditions.</span>
          </div>
        ) : (showAll ? households : visibleHouseholds).map(({ scenario, priority }) => (
          <button
            key={scenario.household.id}
            className={`ranking-row${selectedHouseholdId === scenario.household.id ? ' is-selected' : ''}`}
            type="button"
            onClick={() => onSelectHousehold(scenario.household.id)}
          >
            <span className="rank-number" title="Priority rank in this tab">
              {priorityRankInTab.has(scenario.household.id)
                ? String(priorityRankInTab.get(scenario.household.id)).padStart(2, '0')
                : '–'}
            </span>
            <span className={`status-dot status-${scenario.status}`} />
            <span className="rank-main">
              <span className="rank-id">{scenario.household.id}</span>
              <span
                className={`resource-badge resource-${allocation.assignments.get(scenario.household.id)?.resourceType ?? 'none'}`}
                title={allocation.assignments.get(scenario.household.id)?.usedDefaultHouseholdSize
                  ? `Household size assumed as ${allocation.assignments.get(scenario.household.id)?.householdSize}`
                  : undefined}
              >
                {allocation.assignments.get(scenario.household.id)?.resourceLabel ?? 'none'}
              </span>
              <span className="rank-vulnerability">
                {priority.topFactors.map((factor) => factor.label).join(' · ') || 'No positive factors'}
              </span>
              <span className={`confidence-badge confidence-${priority.confidenceLevel.toLowerCase()}`}>
                {priority.confidenceLevel} confidence
              </span>
            </span>
            <span className="rank-metrics">
              <strong>{priority.total.toFixed(1)} <small>score</small></strong>
              <span>{formatEti(scenario.etiHours)} ETI</span>
            </span>
          </button>
        ))}
      </div>
      <details className="score-explainer">
        <summary>How the score works</summary>
        <p>Urgency contributes up to {URGENCY_MAX_POINTS} points; recorded vulnerabilities contribute up to 60 points:</p>
        <ul>
          <li>Age 65+: {PRIORITY_WEIGHTS.age65Plus}</li>
          <li>Lives alone: {PRIORITY_WEIGHTS.livesAlone}</li>
          <li>Mobility limitation or wheelchair: {PRIORITY_WEIGHTS.mobilityLimitation}</li>
          <li>Medical need: {PRIORITY_WEIGHTS.medicalNeed}</li>
          <li>Help requested by SMS: {PRIORITY_WEIGHTS.needsHelp}</li>
          <li>No phone: {PRIORITY_WEIGHTS.noPhone}</li>
        </ul>
        <p>Weights are illustrative, not validated. Missing fields lower confidence only; they add no vulnerability points. SMS help requests are unverified.</p>
      </details>
    </section>
  )
}
