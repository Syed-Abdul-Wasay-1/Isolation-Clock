import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  UNNAMED_ROAD_LABEL,
  buildBottleneckRoadIndex,
  buildRoadEdgeIndex,
  describeBottleneckRoad,
  describeBottleneckRoadGroups,
  findNearbyRoadEdges,
  getRoadDependants,
} from '../src/simulation/roadImpact.ts'
import type { HouseholdScenario } from '../src/simulation/householdStatus.ts'
import type { RoadFeature } from '../src/types/study.ts'
import { household } from './helpers.ts'

function scenarioAt(
  id: string,
  bottleneckRoad: string | null,
  isolationLevel: number | null,
  overrides: Parameters<typeof household>[0] = {},
): HouseholdScenario {
  return {
    household: household({ id, ...overrides }),
    isolation: {
      id,
      road_node_id: `${id}-node`,
      isolation_level: isolationLevel,
      nearest_safe_place_id: isolationLevel === null ? null : 'S1',
      bottleneck_road: bottleneckRoad,
    },
    etiHours: 0,
    status: 'safe',
  }
}

function road(edgeId: string, threshold: number, coordinates: [number, number][]): RoadFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: { edge_id: edgeId, threshold },
  }
}

const RANKED: HouseholdScenario[] = [
  scenarioAt('H001', 'edge-a', 30, { household_size: 4 }),
  scenarioAt('H002', 'edge-a', 30, { household_size: 2 }),
  scenarioAt('H003', 'edge-b', 20, { household_size: 4 }),
  scenarioAt('H004', null, 10, { household_size: 3 }),
  scenarioAt('H005', 'edge-b', 50, { household_size: null }),
]

describe('buildRoadEdgeIndex', () => {
  test('indexes edges by id with their threshold and geometry', () => {
    const features = [road('edge-a', 42, [[68.85, 27.7]]), road('edge-b', 7, [[68.86, 27.71]])]
    const index = buildRoadEdgeIndex(features)
    assert.equal(index.edgeIds.has('edge-a'), true)
    assert.equal(index.thresholdByEdgeId.get('edge-b'), 7)
    assert.equal(index.featureByEdgeId.get('edge-a')?.properties.threshold, 42)
  })
})

describe('buildBottleneckRoadIndex', () => {
  const atTwentyFive = buildBottleneckRoadIndex(RANKED, 25)

  test('groups households by their recorded bottleneck road', () => {
    assert.equal(atTwentyFive.size, 2)
    assert.deepEqual(
      atTwentyFive.get('edge-a')?.households.map((item) => item.id),
      ['H001', 'H002'],
    )
  })

  test('skips households with no recorded bottleneck road', () => {
    assert.equal(
      Array.from(atTwentyFive.values()).some((group) =>
        group.households.some((item) => item.id === 'H004'),
      ),
      false,
    )
  })

  test('counts people and flags households of unknown size', () => {
    const groupA = atTwentyFive.get('edge-a')
    const groupB = atTwentyFive.get('edge-b')
    assert.deepEqual(groupA?.people, { households: 2, people: 6, unknownSizeHouseholds: 0 })
    assert.deepEqual(groupB?.people, { households: 2, people: 4, unknownSizeHouseholds: 1 })
  })

  test('counts households already isolated at the level it was built for', () => {
    assert.equal(atTwentyFive.get('edge-a')?.isolatedHouseholds, 0)
    assert.equal(atTwentyFive.get('edge-b')?.isolatedHouseholds, 1)
    assert.equal(atTwentyFive.get('edge-b')?.isolatedPeople, 4)
  })

  test('recomputes the isolated count for a higher level', () => {
    const atFifty = buildBottleneckRoadIndex(RANKED, 50)
    assert.equal(atFifty.get('edge-a')?.isolatedHouseholds, 2)
    assert.equal(atFifty.get('edge-b')?.isolatedHouseholds, 2)
  })

  test('records the first (highest-ranked) household of each group', () => {
    assert.equal(atTwentyFive.get('edge-a')?.topHouseholdId, 'H001')
  })

  test('carries a display street name when the data provides one', () => {
    const named: HouseholdScenario[] = [
      {
        ...scenarioAt('H050', 'edge-a', 40),
        isolation: { ...scenarioAt('H050', 'edge-a', 40).isolation, bottleneck_road_name: 'Cinema Road' },
      },
    ]
    const groups = buildBottleneckRoadIndex(named, 0)
    assert.equal(groups.get('edge-a')?.displayName, 'Cinema Road')
  })

  test('does not repeat the key as a display name', () => {
    const same: HouseholdScenario[] = [
      {
        ...scenarioAt('H051', 'edge-a', 40),
        isolation: { ...scenarioAt('H051', 'edge-a', 40).isolation, bottleneck_road_name: 'edge-a' },
      },
    ]
    assert.equal(buildBottleneckRoadIndex(same, 0).get('edge-a')?.displayName, null)
  })
})

describe('describeBottleneckRoadGroups', () => {
  const roadIndex = buildRoadEdgeIndex([
    road('edge-a', 42, [[68.85, 27.7]]),
    road('edge-b', 7, [[68.86, 27.71]]),
  ])

  test('marks which bottleneck values can actually be drawn', () => {
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(RANKED, 25), roadIndex)
    assert.equal(groups.find((group) => group.bottleneckRoad === 'edge-a')?.drawable, true)
    assert.equal(groups.find((group) => group.bottleneckRoad === 'edge-a')?.threshold, 42)
  })

  test('marks a street-name bottleneck as not drawable', () => {
    const named = [scenarioAt('H010', 'Cinema Road', 40)]
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(named, 25), roadIndex)
    assert.equal(groups[0].drawable, false)
    assert.equal(groups[0].threshold, null)
  })

  test('sorts by households, then people, then road id', () => {
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(RANKED, 25), roadIndex)
    assert.deepEqual(groups.map((group) => group.bottleneckRoad), ['edge-a', 'edge-b'])
  })

  test('breaks a tie on people before road id', () => {
    const tie: HouseholdScenario[] = [
      scenarioAt('H020', 'edge-b', 40, { household_size: 6 }),
      scenarioAt('H021', 'edge-a', 40, { household_size: 1 }),
    ]
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(tie, 0), roadIndex)
    assert.deepEqual(groups.map((group) => group.bottleneckRoad), ['edge-b', 'edge-a'])
  })

  test('breaks a full tie on road id', () => {
    const tie: HouseholdScenario[] = [
      scenarioAt('H030', 'edge-b', 40, { household_size: 2 }),
      scenarioAt('H031', 'edge-a', 40, { household_size: 2 }),
    ]
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(tie, 0), roadIndex)
    assert.deepEqual(groups.map((group) => group.bottleneckRoad), ['edge-a', 'edge-b'])
  })

  test('reports the safe places a group routes to, most common first', () => {
    const mixed: HouseholdScenario[] = [
      scenarioAt('H040', 'edge-a', 40),
      { ...scenarioAt('H041', 'edge-a', 40), isolation: { ...scenarioAt('H041', 'edge-a', 40).isolation, nearest_safe_place_id: 'HOSP1' } },
      scenarioAt('H042', 'edge-a', 40),
    ]
    const groups = describeBottleneckRoadGroups(buildBottleneckRoadIndex(mixed, 0), roadIndex)
    assert.deepEqual(groups[0].safePlaceIds, ['S1', 'HOSP1'])
  })
})

describe('describeBottleneckRoad', () => {
  test('prefers the street name and keeps the edge id as the locatable key', () => {
    assert.deepEqual(describeBottleneckRoad('edge-a', 'Cinema Road', true), {
      label: 'Cinema Road',
      edgeId: 'edge-a',
      nameOnly: false,
    })
  })

  test('names an unnamed but locatable edge honestly instead of printing its id', () => {
    assert.deepEqual(describeBottleneckRoad('4011856400-4011856423-0', null, true), {
      label: UNNAMED_ROAD_LABEL,
      edgeId: '4011856400-4011856423-0',
      nameOnly: false,
    })
  })

  test('treats the pipeline fallback (name === edge id) as unnamed', () => {
    assert.deepEqual(describeBottleneckRoad('edge-a', 'edge-a', true), {
      label: UNNAMED_ROAD_LABEL,
      edgeId: 'edge-a',
      nameOnly: false,
    })
  })

  test('keeps a legacy street-name value, and says it has no edge geometry', () => {
    assert.deepEqual(describeBottleneckRoad('Cinema Road', undefined, false), {
      label: 'Cinema Road',
      edgeId: null,
      nameOnly: true,
    })
  })
})

describe('getRoadDependants', () => {
  test('returns the group for a road households depend on', () => {
    assert.equal(getRoadDependants('edge-a', RANKED, 25)?.households.length, 2)
  })

  test('returns null for a road no household depends on', () => {
    assert.equal(getRoadDependants('edge-zzz', RANKED, 25), null)
  })

  test('returns null for a null road', () => {
    assert.equal(getRoadDependants(null, RANKED, 25), null)
  })
})

describe('findNearbyRoadEdges', () => {
  const origin = { lat: 27.7, lon: 68.85 }
  const roads = [
    road('edge-far', 90, [[69.1, 28.2]]),
    road('edge-near', 20, [[68.8502, 27.7002]]),
    road('edge-middle', 50, [[68.88, 27.73]]),
  ]

  test('orders road segments by straight-line distance', () => {
    const options = findNearbyRoadEdges(origin, roads, 3)
    assert.deepEqual(options.map((option) => option.edgeId), [
      'edge-near',
      'edge-middle',
      'edge-far',
    ])
    assert.ok(options[0].distanceKm > 0)
    assert.equal(options[0].threshold, 20)
  })

  test('honours the limit', () => {
    assert.equal(findNearbyRoadEdges(origin, roads, 2).length, 2)
  })

  test('always includes a preferred edge even when it is not the nearest', () => {
    const options = findNearbyRoadEdges(origin, roads, 2, 'edge-far')
    assert.deepEqual(options.map((option) => option.edgeId), ['edge-far', 'edge-near'])
  })

  test('ignores a preferred edge that is not in the road data', () => {
    const options = findNearbyRoadEdges(origin, roads, 2, 'edge-missing')
    assert.deepEqual(options.map((option) => option.edgeId), ['edge-near', 'edge-middle'])
  })

  test('returns an empty list when there are no roads', () => {
    assert.deepEqual(findNearbyRoadEdges(origin, [], 6), [])
  })
})
