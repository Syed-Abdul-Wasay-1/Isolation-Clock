import { useMemo, useState } from 'react'
import { IsolationMap } from '../components/IsolationMap'
import { RankingPanel } from '../components/RankingPanel'
import { WhyRankPanel } from '../components/WhyRankPanel'
import { useStudyData } from '../hooks/useStudyData'
import {
  getHouseholdScenario,
  getSortedActiveHouseholds,
} from '../simulation/householdStatus'

export function IsolationClockPage() {
  const dataState = useStudyData()
  const [scenarioLevel, setScenarioLevel] = useState(0)
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null)

  const scenarios = useMemo(() => {
    if (dataState.status !== 'ready') return []
    return dataState.data.households.map((household) => {
      const isolation = dataState.data.isolationByHousehold.get(household.id)
      if (!isolation) throw new Error(`Missing isolation data for ${household.id}.`)
      return getHouseholdScenario(
        household,
        isolation,
        scenarioLevel,
        dataState.data.riseRateDefault,
      )
    })
  }, [dataState, scenarioLevel])

  if (dataState.status === 'loading') {
    return <main className="loading-screen"><span className="loading-mark">IC</span><p>Preparing the Sukkur scenario…</p></main>
  }
  if (dataState.status === 'error') {
    return (
      <main className="error-screen">
        <div className="eyebrow">ISOLATION CLOCK · SUKKUR</div>
        <h1>Study data could not be loaded</h1>
        <p>{dataState.message}</p>
        <p>Check that the static JSON files are available under <code>/data/</code>.</p>
      </main>
    )
  }

  const { data } = dataState
  const ranking = getSortedActiveHouseholds(scenarios)
  const isolatedCount = scenarios.filter((scenario) => scenario.status === 'isolated').length
  const selectedScenario = scenarios.find(
    (scenario) => scenario.household.id === selectedHouseholdId,
  )

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Isolation Clock home">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy">
            <strong>ISOLATION<span> CLOCK</span></strong>
            <small>COMMUNITY RESILIENCE · SUKKUR</small>
          </span>
        </a>
        <div className="topbar-meta">
          <span className="live-indicator"><i /> LOCAL SCENARIO</span>
          <span className="topbar-divider" />
          <span className="study-location">Sindh, Pakistan <b>·</b> 27.70° N</span>
        </div>
      </header>

      <div className="simulation-banner" role="note">
        <span className="banner-icon">!</span>
        <span>
          <strong>Simulated data.</strong> Buildings, roads and amenities are real OpenStreetMap
          data; all household details are synthetic. <b>Scenario simulator, not a flood forecast.</b>
        </span>
      </div>

      <section className="workspace">
        <section className="map-column" aria-label="Sukkur scenario map">
          <div className="map-heading">
            <div>
              <span className="eyebrow">LIVE ACCESS MODEL</span>
              <h1>Who can still get through?</h1>
            </div>
            <div className="map-summary">
              <span><strong>{data.households.length}</strong> households</span>
              <i />
              <span><strong>{data.shelters.length + data.hospitals.length}</strong> safe places</span>
            </div>
          </div>
          <div className="map-content">
            <IsolationMap
              boundingBox={data.boundingBox}
              roads={data.roads}
              households={scenarios}
              shelters={data.shelters}
              hospitals={data.hospitals}
              scenarioLevel={scenarioLevel}
              selectedHouseholdId={selectedHouseholdId}
              onSelectHousehold={setSelectedHouseholdId}
            />
          </div>
          <div className="map-footnote">
            <span>Road segments turn blue when their scenario threshold is reached.</span>
            <span>Map tiles © OpenStreetMap</span>
          </div>
        </section>

        <aside className="side-panel">
          <section className="scenario-control" aria-labelledby="scenario-label">
            <div className="scenario-title-row">
              <label id="scenario-label" htmlFor="scenario-slider">
                Scenario level <span>(relative index, not water depth)</span>
              </label>
              <output htmlFor="scenario-slider" className="scenario-value">{scenarioLevel}</output>
            </div>
            <input
              id="scenario-slider"
              className="scenario-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={scenarioLevel}
              style={{ '--slider-progress': `${scenarioLevel}%` } as React.CSSProperties}
              onChange={(event) => setScenarioLevel(Number(event.currentTarget.value))}
            />
            <div className="slider-scale"><span>0 · lower exposure</span><span>100 · higher exposure</span></div>
          </section>

          {selectedScenario ? (
            <WhyRankPanel
              scenario={selectedScenario}
              safePlaces={[...data.shelters, ...data.hospitals]}
              scenarioLevel={scenarioLevel}
              riseRateDefault={data.riseRateDefault}
              onBack={() => setSelectedHouseholdId(null)}
            />
          ) : (
            <RankingPanel
              scenarios={ranking}
              isolatedCount={isolatedCount}
              totalHouseholds={data.households.length}
              selectedHouseholdId={selectedHouseholdId}
              onSelectHousehold={setSelectedHouseholdId}
            />
          )}
          <footer className="side-footer">
            <span>LOCAL MODEL · NO PERSONAL DATA</span>
            <span>v0.1</span>
          </footer>
        </aside>
      </section>
    </main>
  )
}
