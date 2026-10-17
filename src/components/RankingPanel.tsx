import { formatEti } from '../simulation/householdStatus'
import type { PriorityScore } from '../simulation/priorityScore'
import { PRIORITY_WEIGHTS, URGENCY_MAX_POINTS } from '../simulation/priorityScore'
import type { HouseholdScenario } from '../simulation/householdStatus'
import type { ResourceAllocation } from '../simulation/resourceMatching'

export interface RankedHousehold {
  scenario: HouseholdScenario
  priority: PriorityScore
}

export type RankingTab = 'rescue' | 'evacuate'

interface RankingPanelProps {
  isolatedHouseholds: RankedHousehold[]
  evacuateHouseholds: RankedHousehold[]
  isolatedCount: number
  totalHouseholds: number
  selectedHouseholdId: string | null
  activeTab: RankingTab
  onTabChange: (tab: RankingTab) => void
  onSelectHousehold: (householdId: string) => void
  allocation: ResourceAllocation
}

export function RankingPanel({
  isolatedHouseholds,
  evacuateHouseholds,
  isolatedCount,
  totalHouseholds,
  selectedHouseholdId,
  activeTab,
  onTabChange,
  onSelectHousehold,
  allocation,
}: RankingPanelProps) {
  const households = activeTab === 'rescue' ? isolatedHouseholds : evacuateHouseholds

  return (
    <section className="ranking-section" aria-labelledby="ranking-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">HOUSEHOLD PRIORITY</div>
          <h2 id="ranking-title">Needs attention</h2>
        </div>
        <div className="isolated-count">
          <strong>{isolatedCount}</strong>
          <span>isolated / {totalHouseholds}</span>
        </div>
      </div>
      <div className="ranking-tabs" role="tablist" aria-label="Household priority group">
        <button
          id="tab-rescue"
          className={`ranking-tab${activeTab === 'rescue' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'rescue'}
          aria-controls="ranking-list"
          onClick={() => onTabChange('rescue')}
        >
          Needs rescue now <span>{isolatedHouseholds.length}</span>
        </button>
        <button
          id="tab-evacuate"
          className={`ranking-tab${activeTab === 'evacuate' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'evacuate'}
          aria-controls="ranking-list"
          onClick={() => onTabChange('evacuate')}
        >
          Evacuate before cut-off <span>{evacuateHouseholds.length}</span>
        </button>
      </div>
      <p className="section-intro">
        {activeTab === 'rescue'
          ? 'Households already isolated at this scenario level, ranked by priority score.'
          : 'Households not yet isolated, ranked by priority score.'}
      </p>
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
        ) : households.map(({ scenario, priority }, index) => (
          <button
            key={scenario.household.id}
            className={`ranking-row${selectedHouseholdId === scenario.household.id ? ' is-selected' : ''}`}
            type="button"
            onClick={() => onSelectHousehold(scenario.household.id)}
          >
            <span className="rank-number">{String(index + 1).padStart(2, '0')}</span>
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
        <p>Urgency contributes up to {URGENCY_MAX_POINTS} points; vulnerability contributes up to 50 points:</p>
        <ul>
          <li>Age 65+: {PRIORITY_WEIGHTS.age65Plus}</li>
          <li>Lives alone: {PRIORITY_WEIGHTS.livesAlone}</li>
          <li>Mobility limitation or wheelchair: {PRIORITY_WEIGHTS.mobilityLimitation}</li>
          <li>Medical need: {PRIORITY_WEIGHTS.medicalNeed}</li>
          <li>No phone: {PRIORITY_WEIGHTS.noPhone}</li>
        </ul>
        <p>Weights are illustrative, not validated. Missing fields lower confidence only; they add no vulnerability points.</p>
      </details>
    </section>
  )
}
