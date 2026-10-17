import type { HouseholdScenario } from '../simulation/householdStatus'
import { formatEti } from '../simulation/householdStatus'

interface RankingPanelProps {
  scenarios: HouseholdScenario[]
  isolatedCount: number
  totalHouseholds: number
  selectedHouseholdId: string | null
  onSelectHousehold: (householdId: string) => void
}

function vulnerabilitySummary(scenario: HouseholdScenario): string {
  const { household } = scenario
  const tags = [
    household.age_band,
    household.mobility && household.mobility !== 'none' ? household.mobility : null,
    household.medical_need === true ? 'medical need' : null,
    household.lives_alone === true ? 'lives alone' : null,
    household.has_phone === false ? 'no phone' : null,
  ].filter((value): value is string => Boolean(value))
  return tags.length ? tags.join(' · ') : 'No flagged vulnerability'
}

export function RankingPanel({
  scenarios,
  isolatedCount,
  totalHouseholds,
  selectedHouseholdId,
  onSelectHousehold,
}: RankingPanelProps) {
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
      <p className="section-intro">Open households with the shortest estimated time to isolation.</p>
      <div className="ranking-list">
        {scenarios.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">✓</span>
            <strong>All modelled households are isolated</strong>
            <span>Lower the scenario level to explore earlier conditions.</span>
          </div>
        ) : (
          scenarios.slice(0, 20).map((scenario, index) => (
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
                <span className="rank-vulnerability">{vulnerabilitySummary(scenario)}</span>
              </span>
              <span className="rank-time">
                <strong>{formatEti(scenario.etiHours)}</strong>
                <span>to isolation</span>
              </span>
            </button>
          ))
        )}
      </div>
      {scenarios.length > 20 && (
        <div className="list-footer">Showing the 20 most urgent of {scenarios.length} households</div>
      )}
    </section>
  )
}
