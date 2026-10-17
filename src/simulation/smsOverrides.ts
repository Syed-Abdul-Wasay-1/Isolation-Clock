import type { HouseholdScenario } from './householdStatus'
import type { PriorityScore } from './priorityScore'
import { compareHouseholdPriority, getPriorityScore } from './priorityScore.ts'
import { getEffectiveHousehold } from './smsCheckins.ts'
import type {
  RoadBlockReport,
  SmsCheckinRecord,
  SmsHouseholdOverride,
  SmsOverrides,
  SmsQueuedMessage,
} from './smsCheckins'

export interface RankedScenario {
  scenario: HouseholdScenario
  priority: PriorityScore
}

/**
 * Ranks every household for the current scenario level, with applied SMS overrides folded into the
 * household record first. Unverified check-ins are passed to the score as a separate count, so they
 * never raise confidence.
 */
export function getRankedHouseholds(
  scenarios: HouseholdScenario[],
  overrides: SmsOverrides,
): RankedScenario[] {
  return scenarios
    .map((scenario) => {
      const override = overrides[scenario.household.id]
      const effectiveScenario = {
        ...scenario,
        household: getEffectiveHousehold(scenario.household, override),
      }
      return {
        scenario: effectiveScenario,
        priority: getPriorityScore(effectiveScenario, override?.checkIns.length ?? 0),
      }
    })
    .sort((first, second) =>
      compareHouseholdPriority(
        first.scenario,
        first.priority,
        second.scenario,
        second.priority,
      ),
    )
}

/**
 * Applies a batch of SMS messages, in order, to the override state.
 *
 * The batch is applied in the order given, so replaying an offline queue produces the same state as
 * sending each message live. Nothing here changes `isolation_level` or ETI: a `3` only adds an
 * unverified road-block report.
 */
export function applySmsMessages(
  scenarios: HouseholdScenario[],
  startingOverrides: SmsOverrides,
  messages: SmsQueuedMessage[],
  roadEdgeIds: ReadonlySet<string> | null,
  now: () => string = () => new Date().toISOString(),
): SmsOverrides {
  let nextOverrides = startingOverrides

  for (const message of messages) {
    const scenario = scenarios.find((item) => item.household.id === message.householdId)
    if (!scenario) throw new Error(`Could not find household ${message.householdId} for SMS check-in.`)

    const existing = nextOverrides[message.householdId]
    const effectiveHousehold = getEffectiveHousehold(scenario.household, existing)
    const reportedFields = new Set(existing?.reportedFields ?? [])
    const checkInTime = now()
    const kind = message.message.trim()
    let smsStatus = existing?.smsStatus
    let changes: string
    let roadBlockReports = existing?.roadBlockReports ?? []

    if (kind === '1') {
      changes = 'Safe check-in recorded; no scenario fields changed.'
    } else if (kind === '2') {
      smsStatus = 'reported by SMS'
      if (effectiveHousehold.needs_help !== true) {
        reportedFields.add('needs_help')
        changes = 'Status marked SMS-reported, unverified; needs help set to yes (+10 priority points).'
      } else {
        changes = 'Status marked SMS-reported, unverified; help request recorded.'
      }
    } else if (kind === '3') {
      const bottleneckRoad = scenario.isolation.bottleneck_road
      const report: RoadBlockReport = {
        id: `${message.id}-road-block`,
        householdId: message.householdId,
        timestamp: checkInTime,
        status: 'unverified',
        edgeId:
          bottleneckRoad && roadEdgeIds?.has(bottleneckRoad) ? bottleneckRoad : null,
      }
      roadBlockReports = [...roadBlockReports, report]
      changes = report.edgeId
        ? 'Added an unverified road-block report; it drives an impact preview only and changes no isolation level.'
        : 'Added an unverified road-block report; the recorded street is not in the shipped road data, so it cannot be drawn.'
    } else if (kind === '4') {
      smsStatus = 'reported by SMS'
      if (effectiveHousehold.medical_need === null || effectiveHousehold.medical_need === undefined) {
        reportedFields.add('medical_need')
        changes = 'Status marked SMS-reported, unverified; medical need set to yes (+10 priority points).'
      } else {
        changes = 'Status marked SMS-reported, unverified; medical-help request recorded without replacing the existing medical-need value.'
      }
    } else {
      changes = 'Free text recorded; no scenario fields changed.'
    }

    changes += ' Recorded as an unverified check-in; it does not change confidence.'
    const record: SmsCheckinRecord = {
      id: message.id,
      message: message.message,
      timestamp: checkInTime,
      changes,
      reply: '',
    }
    const override: SmsHouseholdOverride = {
      ...(smsStatus ? { smsStatus } : {}),
      reportedFields: Array.from(reportedFields),
      checkIns: [...(existing?.checkIns ?? []), record],
      roadBlockReports,
    }
    const overridesWithCheckin = { ...nextOverrides, [message.householdId]: override }
    const rankIndex = getRankedHouseholds(scenarios, overridesWithCheckin).findIndex(
      ({ scenario: rankedScenario }) => rankedScenario.household.id === message.householdId,
    )
    if (rankIndex < 0) {
      throw new Error(`Could not rank household ${message.householdId} after SMS check-in.`)
    }
    const reply = kind === '2' || kind === '4'
      ? `Received. Your household is ranked #${rankIndex + 1} overall. Help is being prioritised.`
      : `Received. Your household is ranked #${rankIndex + 1} overall. Your check-in is recorded.`
    const completedRecord = { ...record, reply }
    const completedOverride: SmsHouseholdOverride = {
      ...override,
      checkIns: [...override.checkIns.slice(0, -1), completedRecord],
    }
    nextOverrides = { ...overridesWithCheckin, [message.householdId]: completedOverride }
  }

  return nextOverrides
}
