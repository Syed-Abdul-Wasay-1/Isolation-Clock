import { useEffect, useMemo, useRef, useState } from 'react'
import { IsolationMap } from '../components/IsolationMap'
import type { HouseholdMapAnnotation } from '../components/IsolationMap'
import { BeforeAfterPanel } from '../components/BeforeAfterPanel'
import type { PinnedScenarioSnapshot } from '../components/BeforeAfterPanel'
import { CriticalRoadsPanel } from '../components/CriticalRoadsPanel'
import { EscalationCurvePanel } from '../components/EscalationCurvePanel'
import { RankingPanel } from '../components/RankingPanel'
import type { RankingSort, RankingTab } from '../components/RankingPanel'
import { ResourceAllocationPanel } from '../components/ResourceAllocationPanel'
import { SmsCheckinPanel } from '../components/SmsCheckinPanel'
import type { RoadBlockReportView } from '../components/SmsCheckinPanel'
import { WhyRankPanel } from '../components/WhyRankPanel'
import { useStudyData } from '../hooks/useStudyData'
import { getEscalationCurve } from '../simulation/escalation'
import { getHouseholdScenario } from '../simulation/householdStatus'
import { countPeople } from '../simulation/population'
import { DEFAULT_RESOURCE_CONFIG, matchResources } from '../simulation/resourceMatching'
import type { ResourceConfig } from '../simulation/resourceMatching'
import {
  buildBottleneckRoadIndex,
  buildRoadEdgeIndex,
  describeBottleneckRoad,
  describeBottleneckRoadGroups,
  findNearbyRoadEdges,
} from '../simulation/roadImpact'
import type { RoadEdgeOption } from '../simulation/roadImpact'
import { setRoadBlockEdge } from '../simulation/smsCheckins'
import type { RoadBlockReport, SmsOverrides, SmsQueuedMessage } from '../simulation/smsCheckins'
import { applySmsMessages, getRankedHouseholds } from '../simulation/smsOverrides'

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

function hasMissingVulnerabilityData(
  household: ReturnType<typeof getHouseholdScenario>['household'],
): boolean {
  return [
    household.age_band,
    household.lives_alone,
    household.mobility,
    household.medical_need,
    household.has_phone,
  ].some((value) => value === null || value === undefined || value === '')
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
  const [rankingSort, setRankingSort] = useState<RankingSort>('priority')
  const [resourceConfig, setResourceConfig] = useState<ResourceConfig>(DEFAULT_RESOURCE_CONFIG)
  const [smsOverrides, setSmsOverrides] = useState<SmsOverrides>({})
  const [smsHouseholdId, setSmsHouseholdId] = useState<string | null>(null)
  const [offlineMode, setOfflineMode] = useState(false)
  const [pendingSmsMessages, setPendingSmsMessages] = useState<SmsQueuedMessage[]>([])
  const [focusedRoad, setFocusedRoad] = useState<string | null>(null)
  /** Nearby road segments per household, cached because `roads.json` never changes after load. */
  const nearbyEdgesRef = useRef(new Map<string, RoadEdgeOption[]>())

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

  const roadIndex = useMemo(
    () => (dataState.status === 'ready' ? buildRoadEdgeIndex(dataState.data.roads) : null),
    [dataState],
  )

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

  const bottleneckGroups = useMemo(() => {
    if (!roadIndex) return []
    return describeBottleneckRoadGroups(
      buildBottleneckRoadIndex(scenarios, scenarioLevel),
      roadIndex,
    )
  }, [roadIndex, scenarios, scenarioLevel])

  const escalationPoints = useMemo(
    () =>
      getEscalationCurve(
        scenarios,
        scenarioLevel,
        dataState.status === 'ready' ? dataState.data.riseRateDefault : 10,
      ),
    [scenarios, scenarioLevel, dataState],
  )

  const rankedHouseholds = getRankedHouseholds(scenarios, smsOverrides)

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
    [...data.shelters, ...data.hospitals],
  )
  const isolatedHouseholds = rankedHouseholds.filter(
    ({ scenario }) => scenario.status === 'isolated',
  )
  const evacuateHouseholds = rankedHouseholds.filter(
    ({ scenario }) => scenario.status !== 'isolated',
  )
  const isolatedCount = scenarios.filter((scenario) => scenario.status === 'isolated').length
  /**
   * A household's rank is always *within its own tab* — rescue (already isolated) or evacuate — so
   * the ranking row number, the "why this rank" panel and the map popup all show the same number.
   * The before/after panel is the one cross-tab surface and labels its numbers "overall".
   */
  const priorityRankInTab = new Map<string, number>()
  const mapAnnotations = new Map<string, HouseholdMapAnnotation>()
  for (const group of [isolatedHouseholds, evacuateHouseholds]) {
    for (const [index, { scenario, priority }] of group.entries()) {
      priorityRankInTab.set(scenario.household.id, index + 1)
      mapAnnotations.set(scenario.household.id, {
        rank: index + 1,
        reasons: priority.topFactors.map((factor) => factor.label),
      })
    }
  }
  const selectedHousehold = rankedHouseholds.find(
    ({ scenario }) => scenario.household.id === selectedHouseholdId,
  )
  const selectedGroup = selectedHousehold?.scenario.status === 'isolated'
    ? isolatedHouseholds
    : evacuateHouseholds
  const selectedIndex = selectedGroup.findIndex(
    ({ scenario }) => scenario.household.id === selectedHouseholdId,
  )
  const defaultSmsHouseholdId = rankedHouseholds.find(({ scenario }) =>
    scenario.household.has_phone !== true || hasMissingVulnerabilityData(scenario.household),
  )?.scenario.household.id ?? rankedHouseholds[0]?.scenario.household.id ?? ''
  const selectedSmsHouseholdId = smsHouseholdId &&
    rankedHouseholds.some(({ scenario }) => scenario.household.id === smsHouseholdId)
    ? smsHouseholdId
    : defaultSmsHouseholdId
  const roadBlockReports: RoadBlockReport[] = Object.values(smsOverrides)
    .flatMap((override) => override.roadBlockReports)
    .sort((first, second) => second.timestamp.localeCompare(first.timestamp))

  const totalPeople = countPeople(data.households)
  const isolatedPeople = countPeople(
    isolatedHouseholds.map(({ scenario }) => scenario.household),
  )
  const evacuatePeople = countPeople(
    evacuateHouseholds.map(({ scenario }) => scenario.household),
  )
  const bottleneckGroupsByRoad = new Map(
    bottleneckGroups.map((group) => [group.bottleneckRoad, group]),
  )
  const householdsWithoutBottleneck = countPeople(
    scenarios
      .filter((scenario) => !scenario.isolation.bottleneck_road)
      .map((scenario) => scenario.household),
  )
  const focusedGroup = focusedRoad ? bottleneckGroupsByRoad.get(focusedRoad) ?? null : null
  const focusedHouseholdIds = new Set(
    focusedGroup ? focusedGroup.households.map((household) => household.id) : [],
  )
  const previewClosedEdgeIds = new Set(
    Object.values(smsOverrides)
      .flatMap((override) => override.roadBlockReports)
      .map((report) => report.edgeId)
      .filter(
        (edgeId): edgeId is string =>
          edgeId !== null && roadIndex !== null && roadIndex.edgeIds.has(edgeId),
      ),
  )
  const roadBlocks: RoadBlockReportView[] = roadBlockReports.map((report) => ({
    report,
    dependants: report.edgeId ? bottleneckGroupsByRoad.get(report.edgeId) ?? null : null,
    edgeOptions: getNearbyEdges(report.householdId),
  }))
  /** Edge ids that exist in `roads.json`; used to decide whether a reported road can be drawn. */
  const roadEdgeIds = roadIndex ? roadIndex.edgeIds : null
  /** The selected household's bottleneck road, labelled so a bare edge id is never the headline. */
  const selectedBottleneckRoad = selectedHousehold?.scenario.isolation.bottleneck_road ?? null
  const selectedBottleneckRoadLabel = selectedBottleneckRoad
    ? describeBottleneckRoad(
        selectedBottleneckRoad,
        selectedHousehold?.scenario.isolation.bottleneck_road_name,
        roadEdgeIds?.has(selectedBottleneckRoad) ?? false,
      )
    : null

  /** Nearest road segments to a household, computed once per household and then cached. */
  function getNearbyEdges(householdId: string): RoadEdgeOption[] {
    const cached = nearbyEdgesRef.current.get(householdId)
    if (cached) return cached
    const household = data.households.find((item) => item.id === householdId)
    if (!household || !roadIndex) return []
    const bottleneckRoad = data.isolationByHousehold.get(householdId)?.bottleneck_road ?? null
    const preferred = bottleneckRoad && roadIndex.edgeIds.has(bottleneckRoad) ? bottleneckRoad : null
    const options = findNearbyRoadEdges(household, data.roads, 6, preferred)
    nearbyEdgesRef.current.set(householdId, options)
    return options
  }

  function handleRoadBlockEdgeChange(report: RoadBlockReport, edgeId: string | null) {
    setSmsOverrides((current) =>
      setRoadBlockEdge(current, report.householdId, report.id, edgeId),
    )
  }

  function jumpToLevel(level: number) {
    setIsPlaying(false)
    setPlaybackStartLevel(null)
    playbackElapsedRef.current = 0
    playbackTickRef.current = null
    setScenarioLevel(Math.min(100, Math.max(0, Math.round(level))))
  }

  function handleSmsSend(message: SmsQueuedMessage) {
    setSmsHouseholdId(message.householdId)
    if (offlineMode) {
      setPendingSmsMessages((current) => [...current, message])
      return
    }
    setSmsOverrides(applySmsMessages(scenarios, smsOverrides, [message], roadEdgeIds))
  }

  function handleOfflineModeChange(enabled: boolean) {
    if (offlineMode && !enabled && pendingSmsMessages.length > 0) {
      setSmsOverrides(applySmsMessages(scenarios, smsOverrides, pendingSmsMessages, roadEdgeIds))
      setPendingSmsMessages([])
    }
    setOfflineMode(enabled)
  }

  function pinCurrentMoment() {
    setPinnedSnapshot({
      level: scenarioLevel,
      isolatedCount,
      isolatedPeople: isolatedPeople.people,
      rankedHouseholds: rankedHouseholds.map(({ scenario, priority }, index) => ({
        householdId: scenario.household.id,
        rank: index + 1,
        score: priority.total,
        status: scenario.status,
      })),
      assignments: Array.from(allocation.assignments, ([householdId, assignment]) => ({
        householdId,
        assignment: { ...assignment, destination: { ...assignment.destination } },
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
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-copy">
            <strong>ISOLATION<span> CLOCK</span></strong>
            <small>COMMUNITY RESILIENCE · SUKKUR</small>
          </span>
          <span className="sr-only">home</span>
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
              <span>
                <strong>{data.households.length}</strong> households ·{' '}
                <strong>{totalPeople.people}</strong> people
              </span>
              <i />
              <span><strong>{data.shelters.length + data.hospitals.length}</strong> safe places</span>
            </div>
          </div>
          <div className="map-content">
            <IsolationMap
              boundingBox={data.boundingBox}
              roads={data.roads}
              households={rankedHouseholds.map(({ scenario }) => scenario)}
              shelters={data.shelters}
              hospitals={data.hospitals}
              scenarioLevel={scenarioLevel}
              selectedHouseholdId={selectedHouseholdId}
              onSelectHousehold={setSelectedHouseholdId}
              allocation={allocation}
              annotations={mapAnnotations}
              previewClosedEdgeIds={previewClosedEdgeIds}
              focusedEdgeId={
                focusedRoad && roadIndex && roadIndex.edgeIds.has(focusedRoad) ? focusedRoad : null
              }
              focusedHouseholdIds={focusedHouseholdIds}
            />
          </div>
          <div className="map-footnote">
            <span>Road segments turn blue when their scenario threshold is reached.</span>
            <span>
              Dashed purple segments are unverified road-block reports — a preview, not a closed road.
            </span>
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

          <EscalationCurvePanel
            points={escalationPoints}
            scenarioLevel={scenarioLevel}
            riseRateDefault={data.riseRateDefault}
            totalHouseholds={data.households.length}
            onJumpToLevel={jumpToLevel}
          />

          {selectedHousehold ? (
            <WhyRankPanel
              scenario={selectedHousehold.scenario}
              priority={selectedHousehold.priority}
              rank={selectedIndex + 1}
              safePlaces={[...data.shelters, ...data.hospitals]}
              scenarioLevel={scenarioLevel}
              riseRateDefault={data.riseRateDefault}
              bottleneckRoadLabel={selectedBottleneckRoadLabel}
              resourceAssignment={allocation.assignments.get(selectedHousehold.scenario.household.id)}
              unassigned={allocation.unassigned.find(
                (item) => item.scenario.household.id === selectedHousehold.scenario.household.id,
              )}
              smsStatus={smsOverrides[selectedHousehold.scenario.household.id]?.smsStatus}
              smsReportedFields={smsOverrides[selectedHousehold.scenario.household.id]?.reportedFields ?? []}
              smsCheckins={smsOverrides[selectedHousehold.scenario.household.id]?.checkIns ?? []}
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
              isolatedPeople={isolatedPeople}
              totalPeople={totalPeople}
              activeIsolatedPeople={activeTab === 'rescue' ? isolatedPeople : evacuatePeople}
              selectedHouseholdId={selectedHouseholdId}
              priorityRankInTab={priorityRankInTab}
              activeTab={activeTab}
              allocation={allocation}
              onTabChange={setActiveTab}
              onSelectHousehold={setSelectedHouseholdId}
              sortBy={rankingSort}
              onSortChange={setRankingSort}
            />
          )}

          <CriticalRoadsPanel
            groups={bottleneckGroups}
            withoutBottleneckCount={householdsWithoutBottleneck.households}
            withoutBottleneckPeople={householdsWithoutBottleneck.people}
            focusedBottleneckRoad={focusedRoad}
            onFocusRoad={setFocusedRoad}
            onSelectHousehold={setSelectedHouseholdId}
          />

          <SmsCheckinPanel
            rankedHouseholds={rankedHouseholds}
            selectedHouseholdId={selectedSmsHouseholdId}
            onHouseholdChange={setSmsHouseholdId}
            records={smsOverrides[selectedSmsHouseholdId]?.checkIns ?? []}
            pendingMessages={pendingSmsMessages}
            roadBlocks={roadBlocks}
            offlineMode={offlineMode}
            onOfflineModeChange={handleOfflineModeChange}
            onSend={handleSmsSend}
            focusedEdgeId={focusedRoad}
            onFocusRoad={setFocusedRoad}
            onRoadBlockEdgeChange={handleRoadBlockEdgeChange}
          />

          {pinnedSnapshot && scenarioLevel !== pinnedSnapshot.level && (
            <BeforeAfterPanel
              snapshot={pinnedSnapshot}
              currentLevel={scenarioLevel}
              currentIsolatedCount={isolatedCount}
              currentIsolatedPeople={isolatedPeople.people}
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

          <footer className="side-footer">
            <span>LOCAL MODEL · NO PERSONAL DATA</span>
            <span>v0.1</span>
          </footer>
        </aside>
      </section>
    </main>
  )
}
