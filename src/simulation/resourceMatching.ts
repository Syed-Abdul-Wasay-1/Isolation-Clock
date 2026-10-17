import type { HouseholdScenario } from './householdStatus'
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

export type AllocationReason = 'no boats left' | 'no vehicles left' | 'no beds free at any shelter'

export interface ResourceAssignment {
  resourceType: 'boat' | 'vehicle'
  resourceLabel: string
  shelter: SafePlace
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
  bedsUsedByShelter: Map<string, number>
  bedCapacityByShelter: Map<string, number>
  sheltersUsingDefaultCapacity: string[]
  assumedHouseholdSizeCount: number
}

function distanceInKm(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDifference = radians(second.lat - first.lat)
  const longitudeDifference = radians(second.lon - first.lon)
  const firstLatitude = radians(first.lat)
  const secondLatitude = radians(second.lat)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
    Math.sin(longitudeDifference / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
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

function getBedCapacity(shelter: SafePlace, config: ResourceConfig): number {
  const capacity = shelter.capacity
  const baseCapacity =
    typeof capacity === 'number' && Number.isFinite(capacity) && capacity >= 0
      ? capacity
      : config.defaultShelterCapacity
  return baseCapacity * config.bedCapacityMultiplier
}

export function matchResources(
  rankedHouseholds: HouseholdScenario[],
  config: ResourceConfig,
  shelters: SafePlace[],
): ResourceAllocation {
  const assignments = new Map<string, ResourceAssignment>()
  const unassigned: UnassignedHousehold[] = []
  const bedCapacityByShelter = new Map(
    shelters.map((shelter) => [shelter.id, getBedCapacity(shelter, config)]),
  )
  const bedsRemainingByShelter = new Map(bedCapacityByShelter)
  const bedsUsedByShelter = new Map(shelters.map((shelter) => [shelter.id, 0]))
  const sheltersUsingDefaultCapacity = shelters
    .filter((shelter) =>
      typeof shelter.capacity !== 'number' ||
      !Number.isFinite(shelter.capacity) ||
      shelter.capacity < 0,
    )
    .map((shelter) => shelter.id)
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

      const nearestAvailableShelter = shelters
        .filter((shelter) =>
          (bedsRemainingByShelter.get(shelter.id) ?? 0) >= householdSize.size,
        )
        .map((shelter) => ({
          shelter,
          distanceKm: distanceInKm(scenario.household, shelter),
        }))
        .sort((first, second) =>
          first.distanceKm - second.distanceKm ||
          first.shelter.id.localeCompare(second.shelter.id),
        )[0]

      if (!nearestAvailableShelter) {
        unassigned.push({
          scenario,
          reason: 'no beds free at any shelter',
          householdSize: householdSize.size,
          usedDefaultHouseholdSize: householdSize.usedDefault,
        })
        continue
      }

      usedResources += 1
      const resourceLabel = `${queue.label} ${usedResources}`
      const shelter = nearestAvailableShelter.shelter
      assignments.set(scenario.household.id, {
        resourceType: queue.type,
        resourceLabel,
        shelter,
        distanceKm: nearestAvailableShelter.distanceKm,
        householdSize: householdSize.size,
        usedDefaultHouseholdSize: householdSize.usedDefault,
      })
      bedsRemainingByShelter.set(
        shelter.id,
        (bedsRemainingByShelter.get(shelter.id) ?? 0) - householdSize.size,
      )
      bedsUsedByShelter.set(
        shelter.id,
        (bedsUsedByShelter.get(shelter.id) ?? 0) + householdSize.size,
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
    bedsUsedByShelter,
    bedCapacityByShelter,
    sheltersUsingDefaultCapacity,
    assumedHouseholdSizeCount,
  }
}
