import type { Household } from '../types/study'

/**
 * A headcount for a set of households. `people` deliberately **excludes** households whose
 * `household_size` is missing: an unknown size is never silently counted as one person.
 */
export interface PeopleCount {
  households: number
  people: number
  /** Households with no usable `household_size`, so their people are not counted. */
  unknownSizeHouseholds: number
}

export function countPeople(households: Household[]): PeopleCount {
  let people = 0
  let unknownSizeHouseholds = 0
  for (const household of households) {
    const size = household.household_size
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
      people += Math.round(size)
    } else {
      unknownSizeHouseholds += 1
    }
  }
  return { households: households.length, people, unknownSizeHouseholds }
}

/** "1043 people", or "1043 people + 2 households of unknown size" when some sizes are missing. */
export function formatPeopleCount(count: PeopleCount): string {
  const people = `${count.people} ${count.people === 1 ? 'person' : 'people'}`
  if (count.unknownSizeHouseholds === 0) return people
  return (
    `${people} + ${count.unknownSizeHouseholds} household` +
    `${count.unknownSizeHouseholds === 1 ? '' : 's'} of unknown size`
  )
}

/** "412 households (1043 people)" — the standard headline for a set of households. */
export function formatHouseholdsAndPeople(count: PeopleCount): string {
  const households = `${count.households} household${count.households === 1 ? '' : 's'}`
  if (count.unknownSizeHouseholds === count.households) return households
  return `${households} (${formatPeopleCount(count)})`
}
