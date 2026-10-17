import type { HouseholdScenario } from './householdStatus'
import { countPeople } from './population.ts'

/** Hours ahead of the current scenario level that the curve reports. */
export const ESCALATION_HOURS = [0, 1, 2, 3, 4, 6, 8, 10, 12] as const

export interface EscalationPoint {
  /** Hours from now. */
  hours: number
  /** The scenario level at that hour: `scenarioLevel + hours × riseRateDefault`, capped at 100. */
  level: number
  isolatedHouseholds: number
  isolatedPeople: number
}

/**
 * The cumulative escalation curve: how many households (and people) are cut off after `h` hours
 * if the scenario level keeps rising at `riseRateDefault`.
 *
 * `riseRateDefault` is an **illustrative** index-points-per-hour setting, not a measured rate of
 * rise. Hour 0 reproduces the set that is already isolated at the current level.
 */
export function getEscalationCurve(
  scenarios: HouseholdScenario[],
  scenarioLevel: number,
  riseRateDefault: number,
  hours: readonly number[] = ESCALATION_HOURS,
): EscalationPoint[] {
  const riseRate = Number.isFinite(riseRateDefault) && riseRateDefault > 0 ? riseRateDefault : 0

  return hours.map((hourOffset) => {
    const level = Math.min(100, Math.max(0, scenarioLevel + hourOffset * riseRate))
    const isolated = scenarios
      .filter((scenario) => {
        const isolationLevel = scenario.isolation.isolation_level
        return (
          isolationLevel !== null &&
          Number.isFinite(isolationLevel) &&
          level >= isolationLevel
        )
      })
      .map((scenario) => scenario.household)

    return {
      hours: hourOffset,
      level,
      isolatedHouseholds: isolated.length,
      isolatedPeople: countPeople(isolated).people,
    }
  })
}
