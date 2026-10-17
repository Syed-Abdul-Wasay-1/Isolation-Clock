import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  formatEti,
  getHouseholdScenario,
  getSortedActiveHouseholds,
} from '../src/simulation/householdStatus.ts'
import { household, isolationRecord } from './helpers.ts'

const RISE_RATE = 10

describe('getHouseholdScenario', () => {
  test('computes ETI as the remaining index gap over the rise rate', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 40),
      30,
      RISE_RATE,
    )

    assert.equal(scenario.etiHours, 1)
  })

  test('never returns a negative ETI once the household is isolated', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 40),
      75,
      RISE_RATE,
    )

    assert.equal(scenario.etiHours, 0)
    assert.equal(scenario.status, 'isolated')
  })

  test('treats the level reaching the isolation level as isolated', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 40),
      40,
      RISE_RATE,
    )

    assert.equal(scenario.status, 'isolated')
  })

  test('flags a household whose ETI is three hours or less as urgent', () => {
    const exactlyThree = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 80),
      50,
      RISE_RATE,
    )
    const justUnderThree = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 40),
      30.01,
      RISE_RATE,
    )

    assert.equal(exactlyThree.etiHours, 3)
    assert.equal(exactlyThree.status, 'urgent')
    assert.equal(justUnderThree.status, 'urgent')
  })

  test('flags a household with more than three hours left as safe', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', 100),
      50,
      RISE_RATE,
    )

    assert.equal(scenario.etiHours, 5)
    assert.equal(scenario.status, 'safe')
  })

  test('returns unknown with no ETI when the isolation level is null', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', null),
      50,
      RISE_RATE,
    )

    assert.equal(scenario.etiHours, null)
    assert.equal(scenario.status, 'unknown')
  })

  test('returns unknown when the isolation level is not finite', () => {
    const scenario = getHouseholdScenario(
      household(),
      isolationRecord('h-1', Number.NaN),
      50,
      RISE_RATE,
    )

    assert.equal(scenario.etiHours, null)
    assert.equal(scenario.status, 'unknown')
  })
})

describe('formatEti', () => {
  test('renders a missing route explicitly', () => {
    assert.equal(formatEti(null), 'No route')
  })

  test('renders whole hours to one decimal place', () => {
    assert.equal(formatEti(2), '2.0 h')
    assert.equal(formatEti(1.25), '1.3 h')
  })

  test('renders sub-hour ETI in minutes', () => {
    assert.equal(formatEti(0.5), '30 min')
    assert.equal(formatEti(0), '0 min')
  })

  test('renders a positive ETI below a minute as "<1 min"', () => {
    assert.equal(formatEti(0.004), '<1 min')
  })
})

describe('getSortedActiveHouseholds', () => {
  test('excludes isolated and unknown households', () => {
    const active = getSortedActiveHouseholds([
      getHouseholdScenario(household({ id: 'a' }), isolationRecord('a', 40), 40, RISE_RATE),
      getHouseholdScenario(household({ id: 'b' }), isolationRecord('b', null), 10, RISE_RATE),
      getHouseholdScenario(household({ id: 'c' }), isolationRecord('c', 90), 10, RISE_RATE),
    ])

    assert.deepEqual(
      active.map((entry) => entry.household.id),
      ['c'],
    )
  })

  test('orders by priority score, highest first', () => {
    const active = getSortedActiveHouseholds([
      // More vulnerable, same urgency -> should rank first.
      getHouseholdScenario(
        household({ id: 'low', age_band: 'adult' }),
        isolationRecord('low', 90),
        10,
        RISE_RATE,
      ),
      getHouseholdScenario(
        household({ id: 'high', age_band: '75+', lives_alone: true }),
        isolationRecord('high', 90),
        10,
        RISE_RATE,
      ),
    ])

    assert.deepEqual(
      active.map((entry) => entry.household.id),
      ['high', 'low'],
    )
  })

  test('breaks a score tie with the sooner ETI', () => {
    const active = getSortedActiveHouseholds([
      // Both rank beyond the six-hour urgency window, so their scores tie at the
      // vulnerability total and the sooner ETI decides the order.
      getHouseholdScenario(household({ id: 'later' }), isolationRecord('later', 100), 10, RISE_RATE),
      getHouseholdScenario(household({ id: 'sooner' }), isolationRecord('sooner', 90), 10, RISE_RATE),
    ])

    assert.deepEqual(
      active.map((entry) => entry.household.id),
      ['sooner', 'later'],
    )
  })
})
