import { useEffect, useMemo, useRef, useState } from 'react'
import { IsolationMap } from '../components/IsolationMap'
import { BeforeAfterPanel } from '../components/BeforeAfterPanel'
import type { PinnedScenarioSnapshot } from '../components/BeforeAfterPanel'
import { RankingPanel } from '../components/RankingPanel'
import type { RankingTab } from '../components/RankingPanel'
import { ResourceAllocationPanel } from '../components/ResourceAllocationPanel'
import { WhyRankPanel } from '../components/WhyRankPanel'
import { useStudyData } from '../hooks/useStudyData'
import { getHouseholdScenario } from '../simulation/householdStatus'
import { compareHouseholdPriority, getPriorityScore } from '../simulation/priorityScore'
import { DEFAULT_RESOURCE_CONFIG, matchResources } from '../simulation/resourceMatching'
import type { ResourceConfig } from '../simulation/resourceMatching'

const PLAYBACK_DURATION_MS = 20_000
const PLAYBACK_TICK_MS = 100

function getPlaybackElapsed(
  elapsed: number,
  lastTick: number | null,
  speed: number,
  now: number,
): number {
  if (lastTick === null) return elapsed
  return Math.min(PLAYBACK_DURATION_MS, elapsed + Math.max(0, now - lastTick) * speed)
}

export function IsolationClockPage() {
  const dataState = useStudyData()
  const [scenarioLevel, setScenarioLevel] = useState(0)
  const [pinnedSnapshot, setPinnedSnapshot] = useState<PinnedScenarioSnapshot | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackStartLevel, setPlaybackStartLevel] = useState<number | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const playbackElapsedRef = useRef(0)
  const playbackTickRef = useRef<number | null>(null)
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RankingTab>('evacuate')
  const [resourceConfig, setResourceConfig] = useState<ResourceConfig>(DEFAULT_RESOURCE_CONFIG)

  useEffect(() => {
    if (!isPlaying || playbackStartLevel === null) return
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsed = getPlaybackElapsed(
        playbackElapsedRef.current,
        playbackTickRef.current,
        playbackSpeed,
        now,
      )
      playbackElapsedRef.current = elapsed
      playbackTickRef.current = now
      const progress = elapsed / PLAYBACK_DURATION_MS
      const level = Math.min(
        100,
        playbackStartLevel + Math.round((100 - playbackStartLevel) * progress),
      )
      setScenarioLevel((current) => current === level ? current : level)

      if (elapsed >= PLAYBACK_DURATION_MS) {
        setScenarioLevel(100)
        setIsPlaying(false)
        setPlaybackStartLevel(null)
        playbackElapsedRef.current = 0
        playbackTickRef.current = null
      }
    }, PLAYBACK_TICK_MS)
    return () => window.clearInterval(interval)
  }, [isPlaying, playbackSpeed, playbackStartLevel])

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

  const rankedHouseholds = scenarios
    .map((scenario) => ({ scenario, priority: getPriorityScore(scenario) }))
    .sort((first, second) =>
      compareHouseholdPriority(
        first.scenario,
        first.priority,
        second.scenario,
        second.priority,
      ),
    )

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
  const allocation = matchResources(
    rankedHouseholds.map(({ scenario }) => scenario),
    resourceConfig,
    data.shelters,
  )
  const isolatedHouseholds = rankedHouseholds.filter(
    ({ scenario }) => scenario.status === 'isolated',
  )
  const evacuateHouseholds = rankedHouseholds.filter(
    ({ scenario }) => scenario.status !== 'isolated',
  )
  const isolatedCount = scenarios.filter((scenario) => scenario.status === 'isolated').length
  const selectedHousehold = rankedHouseholds.find(
    ({ scenario }) => scenario.household.id === selectedHouseholdId,
  )
  const selectedGroup = selectedHousehold?.scenario.status === 'isolated'
    ? isolatedHouseholds
    : evacuateHouseholds
  const selectedIndex = selectedGroup.findIndex(
    ({ scenario }) => scenario.household.id === selectedHouseholdId,
  )

  function pinCurrentMoment() {
    setPinnedSnapshot({
      level: scenarioLevel,
      isolatedCount,
      rankedHouseholds: rankedHouseholds.map(({ scenario, priority }, index) => ({
        householdId: scenario.household.id,
        rank: index + 1,
        score: priority.total,
        status: scenario.status,
      })),
      assignments: Array.from(allocation.assignments, ([householdId, assignment]) => ({
        householdId,
        assignment: { ...assignment, shelter: { ...assignment.shelter } },
      })),
    })
  }

  function startOrResumePlayback() {
    if (playbackStartLevel === null) {
      setPlaybackStartLevel(scenarioLevel)
      playbackElapsedRef.current = 0
    }
    playbackTickRef.current = performance.now()
    setIsPlaying(true)
  }

  function pausePlayback() {
    const now = performance.now()
    const elapsed = getPlaybackElapsed(
      playbackElapsedRef.current,
      playbackTickRef.current,
      playbackSpeed,
      now,
    )
    playbackElapsedRef.current = elapsed
    playbackTickRef.current = null
    if (elapsed >= PLAYBACK_DURATION_MS) {
      setScenarioLevel(100)
      setPlaybackStartLevel(null)
      playbackElapsedRef.current = 0
    }
    setIsPlaying(false)
  }

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
              allocation={allocation}
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
              disabled={isPlaying}
              style={{ '--slider-progress': `${scenarioLevel}%` } as React.CSSProperties}
              onChange={(event) => {
                setIsPlaying(false)
                setPlaybackStartLevel(null)
                playbackElapsedRef.current = 0
                playbackTickRef.current = null
                setScenarioLevel(Number(event.currentTarget.value))
              }}
            />
            <div className="slider-scale"><span>0 · lower exposure</span><span>100 · higher exposure</span></div>
            <div className="scenario-actions">
              <div className="playback-controls">
                <button
                  className="scenario-button scenario-button-primary"
                  type="button"
                  disabled={!isPlaying && scenarioLevel >= 100}
                  onClick={() => {
                    if (isPlaying) pausePlayback()
                    else startOrResumePlayback()
                  }}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <label className="speed-control">
                  Speed
                  <select
                    aria-label="Playback speed"
                    value={playbackSpeed}
                    onChange={(event) => {
                      const now = performance.now()
                      if (isPlaying) {
                        playbackElapsedRef.current = getPlaybackElapsed(
                          playbackElapsedRef.current,
                          playbackTickRef.current,
                          playbackSpeed,
                          now,
                        )
                        playbackTickRef.current = now
                      }
                      setPlaybackSpeed(Number(event.currentTarget.value))
                    }}
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                  </select>
                </label>
              </div>
              <div className="snapshot-controls">
                <button className="scenario-button" type="button" onClick={pinCurrentMoment}>
                  Pin this moment
                </button>
                {pinnedSnapshot && (
                  <button
                    className="scenario-button scenario-button-clear"
                    type="button"
                    onClick={() => setPinnedSnapshot(null)}
                  >
                    Clear
                  </button>
                )}
              </div>
              {pinnedSnapshot && (
                <span className="pin-status">Pinned at level {pinnedSnapshot.level}</span>
              )}
            </div>
          </section>

          {pinnedSnapshot && scenarioLevel !== pinnedSnapshot.level && (
            <BeforeAfterPanel
              snapshot={pinnedSnapshot}
              currentLevel={scenarioLevel}
              currentIsolatedCount={isolatedCount}
              rankedHouseholds={rankedHouseholds}
              allocation={allocation}
            />
          )}

          <ResourceAllocationPanel
            allocation={allocation}
            config={resourceConfig}
            onConfigChange={(key, value) => {
              if (!Number.isFinite(value) || value < 0) return
              setResourceConfig((current) => ({
                ...current,
                [key]: key === 'bedCapacityMultiplier' ? value : Math.floor(value),
              }))
            }}
          />

          {selectedHousehold ? (
            <WhyRankPanel
              scenario={selectedHousehold.scenario}
              priority={selectedHousehold.priority}
              rank={selectedIndex + 1}
              safePlaces={[...data.shelters, ...data.hospitals]}
              scenarioLevel={scenarioLevel}
              riseRateDefault={data.riseRateDefault}
              resourceAssignment={allocation.assignments.get(selectedHousehold.scenario.household.id)}
              unassigned={allocation.unassigned.find(
                (item) => item.scenario.household.id === selectedHousehold.scenario.household.id,
              )}
              onBack={() => {
                setActiveTab(selectedHousehold.scenario.status === 'isolated' ? 'rescue' : 'evacuate')
                setSelectedHouseholdId(null)
              }}
            />
          ) : (
            <RankingPanel
              isolatedHouseholds={isolatedHouseholds}
              evacuateHouseholds={evacuateHouseholds}
              isolatedCount={isolatedCount}
              totalHouseholds={data.households.length}
              selectedHouseholdId={selectedHouseholdId}
              activeTab={activeTab}
              allocation={allocation}
              onTabChange={setActiveTab}
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
