import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_RESOURCE_CONFIG,
  matchResources,
  type ResourceConfig,
} from '../src/simulation/resourceMatching.ts'
import { household, scenario, shelter } from './helpers.ts'

const NEAR = shelter({ id: 'shelter-near', lat: 27.7, lon: 68.85, capacity: 40 })
const FAR = shelter({ id: 'shelter-far', lat: 27.9, lon: 68.85, capacity: 40 })

describe('DEFAULT_RESOURCE_CONFIG', () => {
  test('records the documented scenario pool', () => {
    assert.deepEqual(DEFAULT_RESOURCE_CONFIG, {
      boats: 3,
      boatCapacity: 6,
      vehicles: 4,
      vehicleCapacity: 5,
      bedCapacityMultiplier: 1,
      defaultShelterCapacity: 40,
      defaultHouseholdSize: 4,
    })
  })
})

describe('matchResources', () => {
  test('sends isolated households by boat and everyone else by vehicle', () => {
    const isolated = scenario({ id: 'isolated' }, 'isolated', 0)
    const safe = scenario({ id: 'safe' }, 'safe', 5)

    const allocation = matchResources(
      [isolated, safe],
      DEFAULT_RESOURCE_CONFIG,
      [NEAR],
    )

    assert.equal(allocation.assignments.get('isolated')?.resourceType, 'boat')
    assert.equal(allocation.assignments.get('isolated')?.resourceLabel, 'Boat 1')
    assert.equal(allocation.assignments.get('safe')?.resourceType, 'vehicle')
    assert.equal(allocation.assignments.get('safe')?.resourceLabel, 'Vehicle 1')
    assert.equal(allocation.usedBoats, 1)
    assert.equal(allocation.usedVehicles, 1)
  })

  test('consumes beds equal to the household size', () => {
    const allocation = matchResources(
      [scenario({ id: 'a', household_size: 4 }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [NEAR],
    )

    assert.equal(allocation.bedsUsedByDestination.get(NEAR.id), 4)
    assert.equal(allocation.bedCapacityByDestination.get(NEAR.id), 40)
  })

  test('assigns the closest safe place with enough remaining beds', () => {
    const allocation = matchResources(
      [scenario({ id: 'a' }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [FAR, NEAR],
    )

    assert.equal(allocation.assignments.get('a')?.destination.id, NEAR.id)
  })

  test('accepts a hospital as a destination', () => {
    const hospital = shelter({ id: 'HOSP1', name: 'Hospital 1', kind: 'hospital' })
    const allocation = matchResources(
      [scenario({ id: 'a' }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [hospital],
    )

    assert.equal(allocation.assignments.get('a')?.destination.id, 'HOSP1')
    assert.equal(allocation.assignments.get('a')?.destination.kind, 'hospital')
    assert.equal(allocation.bedsUsedByDestination.get('HOSP1'), 4)
  })

  test('reports a full pool instead of assigning extra households', () => {
    const config: ResourceConfig = { ...DEFAULT_RESOURCE_CONFIG, boats: 1 }
    const allocation = matchResources(
      [
        scenario({ id: 'first' }, 'isolated', 0),
        scenario({ id: 'second' }, 'isolated', 0),
      ],
      config,
      [NEAR],
    )

    assert.equal(allocation.usedBoats, 1)
    assert.equal(allocation.unassigned.length, 1)
    assert.equal(allocation.unassigned[0].scenario.household.id, 'second')
    assert.equal(allocation.unassigned[0].reason, 'no boats left')
  })

  test('reports a household too large for any remaining vehicle', () => {
    const allocation = matchResources(
      [scenario({ id: 'big', household_size: 6 }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [NEAR],
    )

    assert.equal(allocation.assignments.size, 0)
    assert.equal(allocation.unassigned[0].reason, 'no vehicles left')
  })

  test('reports a household that fits no bed anywhere', () => {
    const tiny = shelter({ id: 'tiny', capacity: 2 })
    const allocation = matchResources(
      [scenario({ id: 'a', household_size: 4 }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [tiny],
    )

    assert.equal(allocation.unassigned[0].reason, 'no beds free at any destination')
  })

  test('falls back to the default capacity and flags the safe place', () => {
    const noCapacity = shelter({ id: 'unknown-capacity', capacity: null })

    const allocation = matchResources(
      [scenario({ id: 'a', household_size: 4 }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [noCapacity],
    )

    assert.equal(allocation.bedCapacityByDestination.get(noCapacity.id), 40)
    assert.deepEqual(allocation.destinationsUsingDefaultCapacity, [noCapacity.id])
    assert.equal(allocation.assignments.get('a')?.destination.id, noCapacity.id)
  })

  test('falls back to the default household size and counts the assumption', () => {
    const allocation = matchResources(
      [scenario({ id: 'a', household_size: null }, 'safe', 5)],
      DEFAULT_RESOURCE_CONFIG,
      [NEAR],
    )

    const assignment = allocation.assignments.get('a')

    assert.equal(assignment?.householdSize, 4)
    assert.equal(assignment?.usedDefaultHouseholdSize, true)
    assert.equal(allocation.assumedHouseholdSizeCount, 1)
  })

  test('orders unassigned households by their priority rank', () => {
    const config: ResourceConfig = { ...DEFAULT_RESOURCE_CONFIG, boats: 0 }
    const allocation = matchResources(
      [
        scenario({ id: 'rank-1' }, 'isolated', 0),
        scenario({ id: 'rank-2' }, 'isolated', 0),
        scenario({ id: 'rank-3' }, 'isolated', 0),
      ],
      config,
      [NEAR],
    )

    assert.deepEqual(
      allocation.unassigned.map((entry) => entry.scenario.household.id),
      ['rank-1', 'rank-2', 'rank-3'],
    )
  })

  test('does not modify the input scenarios', () => {
    const input = [household({ id: 'immutable', household_size: 4 })]
    matchResources([scenario({ id: 'immutable' }, 'safe', 5)], DEFAULT_RESOURCE_CONFIG, [NEAR])

    assert.equal(input[0].household_size, 4)
  })
})
