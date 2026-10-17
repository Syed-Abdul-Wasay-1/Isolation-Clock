import type { Household, IsolationRecord } from '../types/study'
import { compareHouseholdPriority, getPriorityScore } from './priorityScore'

export type HouseholdStatus = 'safe' | 'urgent' | 'isolated' | 'unknown'

export interface HouseholdScenario {
  household: Household
  isolation: IsolationRecord
  etiHours: number | null
  status: HouseholdStatus
}

export function getHouseholdScenario(
  household: Household,
  isolation: IsolationRecord,
  scenarioLevel: number,
  riseRateDefault: number,
): HouseholdScenario {
  const isolationLevel = isolation.isolation_level
  if (isolationLevel === null || !Number.isFinite(isolationLevel)) {
    return { household, isolation, etiHours: null, status: 'unknown' }
  }

  const etiHours = Math.max(0, (isolationLevel - scenarioLevel) / riseRateDefault)
  const status: HouseholdStatus =
    scenarioLevel >= isolationLevel ? 'isolated' : etiHours <= 3 ? 'urgent' : 'safe'

  return { household, isolation, etiHours, status }
}

export function formatEti(etiHours: number | null): string {
  if (etiHours === null) return 'No route'
  if (etiHours < 1) {
    const minutes = Math.round(etiHours * 60)
    return etiHours > 0 && minutes === 0 ? '<1 min' : `${minutes} min`
  }
  return `${etiHours.toFixed(1)} h`
}

export function getSortedActiveHouseholds(
  scenarios: HouseholdScenario[],
): HouseholdScenario[] {
  return scenarios
    .filter((scenario) => scenario.status !== 'isolated' && scenario.status !== 'unknown')
    .sort((first, second) =>
      compareHouseholdPriority(
        first,
        getPriorityScore(first),
        second,
        getPriorityScore(second),
      ),
    )
}
