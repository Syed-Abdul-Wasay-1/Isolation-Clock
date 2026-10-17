import type { Household, RoadFeature } from '../types/study'
import type { HouseholdScenario } from './householdStatus'
import { distanceInKm } from './geo.ts'
import { countPeople } from './population.ts'
import type { PeopleCount } from './population'

/**
 * Lookups over `roads.json`, built once per dataset. `roads.json` only ships the edge id and the
 * exposure threshold — there is no graph topology at runtime, so nothing here can re-run routing.
 */
export interface RoadEdgeIndex {
  edgeIds: ReadonlySet<string>
  thresholdByEdgeId: ReadonlyMap<string, number>
  featureByEdgeId: ReadonlyMap<string, RoadFeature>
}

export function buildRoadEdgeIndex(roads: RoadFeature[]): RoadEdgeIndex {
  const edgeIds = new Set<string>()
  const thresholdByEdgeId = new Map<string, number>()
  const featureByEdgeId = new Map<string, RoadFeature>()
  for (const road of roads) {
    const { edge_id: edgeId, threshold } = road.properties
    edgeIds.add(edgeId)
    thresholdByEdgeId.set(edgeId, threshold)
    featureByEdgeId.set(edgeId, road)
  }
  return { edgeIds, thresholdByEdgeId, featureByEdgeId }
}

export interface BottleneckRoadGroup {
  /**
   * The `bottleneck_road` value exactly as shipped. In the current dataset this is usually an edge
   * id, but for some households the pipeline recorded a street **name**, which cannot be located
   * in `roads.json`.
   */
  bottleneckRoad: string
  /** Human-readable street name when the data carries one and it differs from the key. */
  displayName: string | null
  /** True when the value matches an edge in `roads.json` and can be drawn on the map. */
  drawable: boolean
  /** The edge's threshold when `drawable`, otherwise null. */
  threshold: number | null
  /** Dependants, in the ranking order they were passed in. */
  households: Household[]
  people: PeopleCount
  /** Dependants already isolated at the level this index was built for. */
  isolatedHouseholds: number
  isolatedPeople: number
  /** Safe places these households are modelled to reach, most common first. */
  safePlaceIds: string[]
  /** The highest-ranked dependant — what the UI should open when the road is clicked. */
  topHouseholdId: string | null
}

function isIsolatedAt(scenario: HouseholdScenario, scenarioLevel: number): boolean {
  const isolationLevel = scenario.isolation.isolation_level
  return (
    isolationLevel !== null &&
    Number.isFinite(isolationLevel) &&
    scenarioLevel >= isolationLevel
  )
}

/**
 * Group households by the road that forms the bottleneck of their best modelled route.
 *
 * This is an **impact preview**, not a re-simulation: the dataset records the bottleneck of each
 * household's *best* route only, so a group is "households whose best modelled route uses this
 * road", not a proven set of households that the road's closure would isolate.
 */
export function buildBottleneckRoadIndex(
  scenarios: HouseholdScenario[],
  scenarioLevel: number,
): Map<string, BottleneckRoadGroup> {
  interface Builder {
    households: Household[]
    isolated: Household[]
    safePlaceCounts: Map<string, number>
    displayName: string | null
  }
  const builders = new Map<string, Builder>()

  for (const scenario of scenarios) {
    const bottleneckRoad = scenario.isolation.bottleneck_road
    if (!bottleneckRoad) continue
    let builder = builders.get(bottleneckRoad)
    if (!builder) {
      builder = { households: [], isolated: [], safePlaceCounts: new Map(), displayName: null }
      builders.set(bottleneckRoad, builder)
    }
    const reportedName = scenario.isolation.bottleneck_road_name
    if (!builder.displayName && reportedName && reportedName !== bottleneckRoad) {
      builder.displayName = reportedName
    }
    builder.households.push(scenario.household)
    if (isIsolatedAt(scenario, scenarioLevel)) builder.isolated.push(scenario.household)
    const safePlaceId = scenario.isolation.nearest_safe_place_id
    if (safePlaceId) {
      builder.safePlaceCounts.set(safePlaceId, (builder.safePlaceCounts.get(safePlaceId) ?? 0) + 1)
    }
  }

  const groups = new Map<string, BottleneckRoadGroup>()
  for (const [bottleneckRoad, builder] of builders) {
    groups.set(bottleneckRoad, {
      bottleneckRoad,
      displayName: builder.displayName,
      drawable: false,
      threshold: null,
      households: builder.households,
      people: countPeople(builder.households),
      isolatedHouseholds: builder.isolated.length,
      isolatedPeople: countPeople(builder.isolated).people,
      safePlaceIds: Array.from(builder.safePlaceCounts)
        .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
        .map(([safePlaceId]) => safePlaceId),
      topHouseholdId: builder.households[0]?.id ?? null,
    })
  }
  return groups
}

/** Adds `drawable` / `threshold` to the groups, using the shipped road edges. */
export function describeBottleneckRoadGroups(
  groups: Map<string, BottleneckRoadGroup>,
  roadIndex: RoadEdgeIndex,
): BottleneckRoadGroup[] {
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      drawable: roadIndex.edgeIds.has(group.bottleneckRoad),
      threshold: roadIndex.thresholdByEdgeId.get(group.bottleneckRoad) ?? null,
    }))
    .sort((first, second) =>
      second.households.length - first.households.length ||
      second.people.people - first.people.people ||
      first.bottleneckRoad.localeCompare(second.bottleneckRoad),
    )
}

/** The dependants of one road: every household whose recorded bottleneck is that road. */
export function getRoadDependants(
  bottleneckRoad: string | null,
  scenarios: HouseholdScenario[],
  scenarioLevel: number,
): BottleneckRoadGroup | null {
  if (!bottleneckRoad) return null
  return buildBottleneckRoadIndex(scenarios, scenarioLevel).get(bottleneckRoad) ?? null
}

export interface RoadEdgeOption {
  edgeId: string
  threshold: number
  distanceKm: number
}

const PREFILTER_SIZE = 40

function closestVertexDistance(
  origin: { lat: number; lon: number },
  road: RoadFeature,
): number {
  let closest = Infinity
  for (const [longitude, latitude] of road.geometry.coordinates) {
    const distance = distanceInKm(origin, { lat: latitude, lon: longitude })
    if (distance < closest) closest = distance
  }
  return closest
}

/**
 * The nearest road segments to a household, by straight-line distance to the segment's closest
 * recorded point. A `preferredEdgeId` (a household's own bottleneck road) is always included.
 */
export function findNearbyRoadEdges(
  origin: { lat: number; lon: number },
  roads: RoadFeature[],
  limit = 6,
  preferredEdgeId: string | null = null,
): RoadEdgeOption[] {
  const candidates = roads
    .map((road) => {
      const [longitude, latitude] = road.geometry.coordinates[0] ?? []
      const firstVertexDistance = typeof latitude === 'number' && typeof longitude === 'number'
        ? distanceInKm(origin, { lat: latitude, lon: longitude })
        : Infinity
      return { road, firstVertexDistance }
    })
    .sort((first, second) => first.firstVertexDistance - second.firstVertexDistance)
    .slice(0, PREFILTER_SIZE)
    .map(({ road }) => ({
      edgeId: road.properties.edge_id,
      threshold: road.properties.threshold,
      distanceKm: closestVertexDistance(origin, road),
    }))
    .sort((first, second) => first.distanceKm - second.distanceKm)

  if (!preferredEdgeId) return candidates.slice(0, limit)

  const preferred = candidates.find((candidate) => candidate.edgeId === preferredEdgeId)
  if (!preferred) return candidates.slice(0, limit)
  return [preferred, ...candidates.filter((candidate) => candidate.edgeId !== preferredEdgeId)]
    .slice(0, limit)
}
