import type { Household, IsolationRecord, SafePlace } from '../src/types/study.ts'
import type { HouseholdScenario, HouseholdStatus } from '../src/simulation/householdStatus.ts'

/**
 * A well-populated household with no vulnerability signals, so tests only have
 * to override the field they care about.
 */
export const BASE_HOUSEHOLD: Household = {
  id: 'h-1',
  lat: 27.7,
  lon: 68.85,
  household_size: 4,
  age_band: 'adult',
  mobility: 'none',
  medical_need: false,
  lives_alone: false,
  has_phone: true,
  floor_level: 'ground',
  last_contact_hours: 1,
  data_completeness: 1,
}

export function household(overrides: Partial<Household> = {}): Household {
  return { ...BASE_HOUSEHOLD, ...overrides }
}

export function isolationRecord(
  id: string,
  isolationLevel: number | null,
): IsolationRecord {
  return {
    id,
    road_node_id: `${id}-node`,
    isolation_level: isolationLevel,
    nearest_safe_place_id: isolationLevel === null ? null : 'shelter-1',
    bottleneck_road: isolationLevel === null ? null : 'edge-1',
  }
}

export function shelter(overrides: Partial<SafePlace> = {}): SafePlace {
  return {
    id: 'shelter-1',
    name: 'Shelter 1',
    lat: 27.7,
    lon: 68.85,
    capacity: 40,
    ...overrides,
  }
}

/**
 * Build a scenario directly, for scoring tests that do not care how ETI was derived.
 */
export function scenario(
  overrides: Partial<Household> = {},
  status: HouseholdStatus = 'safe',
  etiHours: number | null = 6,
  isolationLevel: number | null = 50,
): HouseholdScenario {
  const record = household(overrides)
  return {
    household: record,
    isolation: isolationRecord(record.id, isolationLevel),
    etiHours,
    status,
  }
}

/** A household with every vulnerability signal set, for maximum-score tests. */
export function vulnerableHousehold(overrides: Partial<Household> = {}): Household {
  return household({
    age_band: '75+',
    lives_alone: true,
    mobility: 'wheelchair',
    medical_need: true,
    has_phone: false,
    ...overrides,
  })
}
