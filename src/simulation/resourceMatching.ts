import type { HouseholdScenario } from './householdStatus'
import { distanceInKm } from './geo.ts'
import type { SafePlace } from '../types/study'

export interface ResourceConfig {
  boats: number
  boatCapacity: number
  vehicles: number
  vehicleCapacity: number
  bedCapacityMultiplier: number
  defaultShelterCapacity: number
  defaultHouseholdSize: number
}

export const DEFAULT_RESOURCE_CONFIG: ResourceConfig = {
  boats: 3,
  boatCapacity: 6,
  vehicles: 4,
  vehicleCapacity: 5,
  bedCapacityMultiplier: 1,
  defaultShelterCapacity: 40,
  defaultHouseholdSize: 4,
}

export type AllocationReason =
  | 'no boats left'
  | 'no vehicles left'
  | 'no beds free at any destination'

export interface ResourceAssignment {
  resourceType: 'boat' | 'vehicle'
  resourceLabel: string
  /** The shelter or hospital the household is sent to. */
  destination: SafePlace
  distanceKm: number
  householdSize: number
  usedDefaultHouseholdSize: boolean
}

export interface UnassignedHousehold {
  scenario: HouseholdScenario
  reason: AllocationReason
  householdSize: number
  usedDefaultHouseholdSize: boolean
}

export interface ResourceAllocation {
  assignments: Map<string, ResourceAssignment>
  unassigned: UnassignedHousehold[]
  usedBoats: number
  usedVehicles: number
  bedsUsedByDestination: Map<string, number>
  bedCapacityByDestination: Map<string, number>
  destinationsUsingDefaultCapacity: string[]
  assumedHouseholdSizeCount: number
}

function getHouseholdSize(
  scenario: HouseholdScenario,
  defaultHouseholdSize: number,
): { size: number; usedDefault: boolean } {
  const size = scenario.household.household_size
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    return { size, usedDefault: false }
  }
  return { size: defaultHouseholdSize, usedDefault: true }
}

function getBedCapacity(destination: SafePlace, config: ResourceConfig): number {
  const capacity = destination.capacity
  const baseCapacity =
    typeof capacity === 'number' && Number.isFinite(capacity) && capacity >= 0
      ? capacity
      : config.defaultShelterCapacity
  return baseCapacity * config.bedCapacityMultiplier
}

/**
 * Greedy, priority-first allocation of boats, vehicles and beds.
 *
 * `destinations` is every reachable safe place — shelters **and** hospitals. The isolation model
 * already routes a household to whichever it can reach, so a hospital that a household is routed to
 * must also be able to receive it here; otherwise the two panels contradict each other.
 */
export function matchResources(
  rankedHouseholds: HouseholdScenario[],
  config: ResourceConfig,
  destinations: SafePlace[],
): ResourceAllocation {
  const assignments = new Map<string, ResourceAssignment>()
  const unassigned: UnassignedHousehold[] = []
  const bedCapacityByDestination = new Map(
    destinations.map((destination) => [destination.id, getBedCapacity(destination, config)]),
  )
  const bedsRemainingByDestination = new Map(bedCapacityByDestination)
  const bedsUsedByDestination = new Map(destinations.map((destination) => [destination.id, 0]))
  const destinationsUsingDefaultCapacity = destinations
    .filter((destination) =>
      typeof destination.capacity !== 'number' ||
      !Number.isFinite(destination.capacity) ||
      destination.capacity < 0,
    )
    .map((destination) => destination.id)
  const assumedHouseholdSizeCount = rankedHouseholds.filter((scenario) =>
    getHouseholdSize(scenario, config.defaultHouseholdSize).usedDefault,
  ).length
  const queues = [
    {
      type: 'boat' as const,
      label: 'Boat',
      households: rankedHouseholds.filter((scenario) => scenario.status === 'isolated'),
      count: Math.max(0, Math.floor(config.boats)),
      capacity: config.boatCapacity,
    },
    {
      type: 'vehicle' as const,
      label: 'Vehicle',
      households: rankedHouseholds.filter((scenario) => scenario.status !== 'isolated'),
      count: Math.max(0, Math.floor(config.vehicles)),
      capacity: config.vehicleCapacity,
    },
  ]
  let usedBoats = 0
  let usedVehicles = 0

  for (const queue of queues) {
    let usedResources = 0
    for (const scenario of queue.households) {
      const householdSize = getHouseholdSize(scenario, config.defaultHouseholdSize)
      const remaining = queue.count - usedResources
      if (remaining <= 0 || householdSize.size > queue.capacity) {
        unassigned.push({
          scenario,
          reason: queue.type === 'boat' ? 'no boats left' : 'no vehicles left',
          householdSize: householdSize.size,
          usedDefaultHouseholdSize: householdSize.usedDefault,
        })
        continue
      }

      const nearestAvailableDestination = destinations
        .filter((destination) =>
          (bedsRemainingByDestination.get(destination.id) ?? 0) >= householdSize.size,
        )
        .map((destination) => ({
          destination,
          distanceKm: distanceInKm(scenario.household, destination),
        }))
        .sort((first, second) =>
          first.distanceKm - second.distanceKm ||
          first.destination.id.localeCompare(second.destination.id),
        )[0]

      if (!nearestAvailableDestination) {
        unassigned.push({
          scenario,
          reason: 'no beds free at any destination',
          householdSize: householdSize.size,
          usedDefaultHouseholdSize: householdSize.usedDefault,
        })
        continue
      }

      usedResources += 1
      const resourceLabel = `${queue.label} ${usedResources}`
      const destination = nearestAvailableDestination.destination
      assignments.set(scenario.household.id, {
        resourceType: queue.type,
        resourceLabel,
        destination,
        distanceKm: nearestAvailableDestination.distanceKm,
        householdSize: householdSize.size,
        usedDefaultHouseholdSize: householdSize.usedDefault,
      })
      bedsRemainingByDestination.set(
        destination.id,
        (bedsRemainingByDestination.get(destination.id) ?? 0) - householdSize.size,
      )
      bedsUsedByDestination.set(
        destination.id,
        (bedsUsedByDestination.get(destination.id) ?? 0) + householdSize.size,
      )
    }

    if (queue.type === 'boat') usedBoats = usedResources
    else usedVehicles = usedResources
  }

  const priorityIndexByHousehold = new Map(
    rankedHouseholds.map((scenario, index) => [scenario.household.id, index]),
  )
  unassigned.sort((first, second) =>
    (priorityIndexByHousehold.get(first.scenario.household.id) ?? Infinity) -
    (priorityIndexByHousehold.get(second.scenario.household.id) ?? Infinity),
  )

  return {
    assignments,
    unassigned,
    usedBoats,
    usedVehicles,
    bedsUsedByDestination,
    bedCapacityByDestination,
    destinationsUsingDefaultCapacity,
    assumedHouseholdSizeCount,
  }
}
