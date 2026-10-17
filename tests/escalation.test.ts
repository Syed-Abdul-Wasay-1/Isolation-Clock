import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { ESCALATION_HOURS, getEscalationCurve } from '../src/simulation/escalation.ts'
import { getHouseholdScenario } from '../src/simulation/householdStatus.ts'
import type { HouseholdScenario } from '../src/simulation/householdStatus.ts'
import { household } from './helpers.ts'

function scenarioAt(
  id: string,
  isolationLevel: number | null,
  householdSize: number | null = 4,
): HouseholdScenario {
  return {
    household: household({ id, household_size: householdSize }),
    isolation: {
      id,
      road_node_id: `${id}-node`,
      isolation_level: isolationLevel,
      nearest_safe_place_id: isolationLevel === null ? null : 'S1',
      bottleneck_road: 'edge-a',
    },
    etiHours: 0,
    status: 'safe',
  }
}

const SCENARIOS: HouseholdScenario[] = [
  scenarioAt('H001', 10, 4),
  scenarioAt('H002', 30, 2),
  scenarioAt('H003', 50, 6),
  scenarioAt('H004', null, 3),
]

describe('getEscalationCurve', () => {
  test('reports every configured hour', () => {
    const curve = getEscalationCurve(SCENARIOS, 0, 10)
    assert.deepEqual(
      curve.map((point) => point.hours),
      [...ESCALATION_HOURS],
    )
  })

  test('raises the level by the rise rate for each hour', () => {
    const curve = getEscalationCurve(SCENARIOS, 5, 10, [0, 1, 2])
    assert.deepEqual(
      curve.map((point) => point.level),
      [5, 15, 25],
    )
  })

  test('caps the level at 100', () => {
    const curve = getEscalationCurve(SCENARIOS, 95, 10, [0, 1, 2])
    assert.deepEqual(
      curve.map((point) => point.level),
      [95, 100, 100],
    )
  })

  test('counts households and people cut off cumulatively', () => {
    const curve = getEscalationCurve(SCENARIOS, 0, 10, [0, 1, 3, 6])
    assert.deepEqual(
      curve.map((point) => [point.isolatedHouseholds, point.isolatedPeople]),
      [
        [0, 0],
        [1, 4],
        [2, 6],
        [3, 12],
      ],
    )
  })

  test('never counts a household with an unknown isolation level', () => {
    const curve = getEscalationCurve(SCENARIOS, 100, 10, [0])
    assert.equal(curve[0].isolatedHouseholds, 3)
    assert.equal(curve[0].isolatedPeople, 12)
  })

  test('is monotonically non-decreasing', () => {
    const curve = getEscalationCurve(SCENARIOS, 0, 10)
    for (let index = 1; index < curve.length; index += 1) {
      assert.ok(curve[index].isolatedHouseholds >= curve[index - 1].isolatedHouseholds)
      assert.ok(curve[index].isolatedPeople >= curve[index - 1].isolatedPeople)
      assert.ok(curve[index].level >= curve[index - 1].level)
    }
  })

  test('hour zero matches the households already isolated at the current level', () => {
    const scenarioLevel = 35
    const curve = getEscalationCurve(SCENARIOS, scenarioLevel, 10, [0])
    const isolated = SCENARIOS.filter(
      (scenario) =>
        getHouseholdScenario(
          scenario.household,
          scenario.isolation,
          scenarioLevel,
          10,
        ).status === 'isolated',
    )
    assert.equal(curve[0].isolatedHouseholds, isolated.length)
    assert.equal(curve[0].isolatedPeople, 6)
  })

  test('does not count households of unknown size as zero people', () => {
    const curve = getEscalationCurve([scenarioAt('H009', 5, null)], 0, 10, [1])
    assert.equal(curve[0].isolatedHouseholds, 1)
    assert.equal(curve[0].isolatedPeople, 0)
  })

  test('holds the curve flat when the rise rate is not usable', () => {
    const curve = getEscalationCurve(SCENARIOS, 20, 0, [0, 4])
    const negative = getEscalationCurve(SCENARIOS, 20, -5, [0, 4])
    assert.deepEqual(
      curve.map((point) => point.level),
      [20, 20],
    )
    assert.deepEqual(
      negative.map((point) => point.level),
      [20, 20],
    )
  })

  test('accepts a custom hour list', () => {
    const curve = getEscalationCurve(SCENARIOS, 0, 10, [0, 12])
    assert.equal(curve.length, 2)
    assert.equal(curve[1].hours, 12)
  })
})
