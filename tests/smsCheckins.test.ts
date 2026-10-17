import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getEffectiveHousehold, setRoadBlockEdge } from '../src/simulation/smsCheckins.ts'
import type { SmsHouseholdOverride, SmsOverrides, SmsQueuedMessage } from '../src/simulation/smsCheckins.ts'
import { applySmsMessages, getRankedHouseholds } from '../src/simulation/smsOverrides.ts'
import { household, scenario } from './helpers.ts'
import type { HouseholdScenario } from '../src/simulation/householdStatus.ts'

const FIXED_TIME = '2026-10-17T09:00:00.000Z'
const now = () => FIXED_TIME

function message(id: string, householdId: string, text: string): SmsQueuedMessage {
  return { id, householdId, message: text, queuedAt: FIXED_TIME }
}

function override(overrides: Partial<SmsHouseholdOverride> = {}): SmsHouseholdOverride {
  return { reportedFields: [], checkIns: [], roadBlockReports: [], ...overrides }
}

describe('getEffectiveHousehold', () => {
  test('returns the household untouched when there is no override', () => {
    const base = household()
    assert.equal(getEffectiveHousehold(base, undefined), base)
    assert.equal(getEffectiveHousehold(base, override()), base)
  })

  test('applies an unverified help request', () => {
    const effective = getEffectiveHousehold(
      household({ needs_help: null }),
      override({ reportedFields: ['needs_help'] }),
    )
    assert.equal(effective.needs_help, true)
  })

  test('fills a missing medical need', () => {
    const effective = getEffectiveHousehold(
      household({ medical_need: null }),
      override({ reportedFields: ['medical_need'] }),
    )
    assert.equal(effective.medical_need, true)
  })

  test('never overwrites a known medical need', () => {
    const effective = getEffectiveHousehold(
      household({ medical_need: false }),
      override({ reportedFields: ['medical_need'] }),
    )
    assert.equal(effective.medical_need, false)
  })

  test('does not mutate the household it is given', () => {
    const base = household({ medical_need: null })
    getEffectiveHousehold(base, override({ reportedFields: ['medical_need'] }))
    assert.equal(base.medical_need, null)
  })
})

describe('setRoadBlockEdge', () => {
  test('re-points a single report and leaves the others alone', () => {
    const overrides: SmsOverrides = {
      'H001': override({
        roadBlockReports: [
          { id: 'r1', householdId: 'H001', timestamp: FIXED_TIME, status: 'unverified', edgeId: 'edge-a' },
          { id: 'r2', householdId: 'H001', timestamp: FIXED_TIME, status: 'unverified', edgeId: 'edge-b' },
        ],
      }),
    }
    const next = setRoadBlockEdge(overrides, 'H001', 'r1', 'edge-c')
    assert.deepEqual(
      next['H001'].roadBlockReports.map((report) => [report.id, report.edgeId]),
      [['r1', 'edge-c'], ['r2', 'edge-b']],
    )
  })

  test('ignores an unknown household or report', () => {
    const overrides: SmsOverrides = {}
    assert.equal(setRoadBlockEdge(overrides, 'H999', 'r1', 'edge-a'), overrides)
  })
})

describe('applySmsMessages', () => {
  const scenarios: HouseholdScenario[] = [
    scenario({ id: 'H001', medical_need: null }, 'safe', 6, 40),
    scenario({ id: 'H002', medical_need: false }, 'safe', 6, 30),
  ]
  const roadEdgeIds = new Set(['edge-1'])

  test('a 2 records needs_help and marks the status unverified', () => {
    const overrides = applySmsMessages(scenarios, {}, [message('m1', 'H001', '2')], roadEdgeIds, now)
    const applied = overrides['H001']
    assert.deepEqual(applied.reportedFields, ['needs_help'])
    assert.equal(applied.smsStatus, 'reported by SMS')
    assert.match(applied.checkIns[0].reply, /ranked #\d+/)
    assert.match(applied.checkIns[0].changes, /unverified/)
  })

  test('a 4 fills a missing medical need', () => {
    const overrides = applySmsMessages(scenarios, {}, [message('m1', 'H001', '4')], roadEdgeIds, now)
    assert.deepEqual(overrides['H001'].reportedFields, ['medical_need'])
  })

  test('a 4 does not overwrite a known medical need', () => {
    const overrides = applySmsMessages(scenarios, {}, [message('m1', 'H002', '4')], roadEdgeIds, now)
    const applied = overrides['H002']
    assert.deepEqual(applied.reportedFields, [])
    assert.match(applied.checkIns[0].changes, /without replacing the existing medical-need value/)
    assert.equal(getEffectiveHousehold(scenarios[1].household, applied).medical_need, false)
  })

  test('a 3 adds an unverified road-block report and changes no household field', () => {
    const overrides = applySmsMessages(scenarios, {}, [message('m1', 'H001', '3')], roadEdgeIds, now)
    const applied = overrides['H001']
    assert.equal(applied.roadBlockReports.length, 1)
    assert.equal(applied.roadBlockReports[0].status, 'unverified')
    assert.equal(applied.roadBlockReports[0].edgeId, 'edge-1')
    assert.deepEqual(applied.reportedFields, [])
    assert.equal(getEffectiveHousehold(scenarios[0].household, applied), scenarios[0].household)
    assert.match(applied.checkIns[0].changes, /changes no isolation level/)
  })

  test('a 3 whose recorded bottleneck is not a known edge gets a null edge', () => {
    const named: HouseholdScenario = {
      ...scenarios[0],
      isolation: { ...scenarios[0].isolation, bottleneck_road: 'Cinema Road' },
    }
    const overrides = applySmsMessages([named], {}, [message('m1', 'H001', '3')], roadEdgeIds, now)
    assert.equal(overrides['H001'].roadBlockReports[0].edgeId, null)
    assert.match(overrides['H001'].checkIns[0].changes, /cannot be drawn/)
  })

  test('reportedFields marks exactly the fields the check-ins supplied', () => {
    const overrides = applySmsMessages(
      scenarios,
      {},
      [message('m1', 'H001', '2'), message('m2', 'H001', '4'), message('m3', 'H001', '1')],
      roadEdgeIds,
      now,
    )
    assert.deepEqual(overrides['H001'].reportedFields, ['needs_help', 'medical_need'])
    assert.equal(overrides['H001'].checkIns.length, 3)
  })

  test('free text records a check-in without touching any field', () => {
    const overrides = applySmsMessages(scenarios, {}, [message('m1', 'H001', 'water rising')], roadEdgeIds, now)
    assert.deepEqual(overrides['H001'].reportedFields, [])
    assert.match(overrides['H001'].checkIns[0].changes, /Free text recorded/)
  })

  test('a queued batch applies in order and equals sending each message live', () => {
    const batch = [message('m1', 'H001', '2'), message('m2', 'H001', '4'), message('m3', 'H002', '3')]
    const queued = applySmsMessages(scenarios, {}, batch, roadEdgeIds, now)

    let live: SmsOverrides = {}
    for (const item of batch) {
      live = applySmsMessages(scenarios, live, [item], roadEdgeIds, now)
    }

    assert.deepEqual(queued, live)
  })

  test('the order of a queued batch is observable in reportedFields', () => {
    const helpFirst = applySmsMessages(
      scenarios,
      {},
      [message('m1', 'H001', '2'), message('m2', 'H001', '4')],
      roadEdgeIds,
      now,
    )
    const medicalFirst = applySmsMessages(
      scenarios,
      {},
      [message('m1', 'H001', '4'), message('m2', 'H001', '2')],
      roadEdgeIds,
      now,
    )
    assert.deepEqual(helpFirst['H001'].reportedFields, ['needs_help', 'medical_need'])
    assert.deepEqual(medicalFirst['H001'].reportedFields, ['medical_need', 'needs_help'])
  })

  test('throws when a message names an unknown household', () => {
    assert.throws(
      () => applySmsMessages(scenarios, {}, [message('m1', 'H999', '2')], roadEdgeIds, now),
      /Could not find household H999/,
    )
  })

  test('does not mutate the starting overrides', () => {
    const starting: SmsOverrides = { H001: override() }
    const before = structuredClone(starting)
    applySmsMessages(scenarios, starting, [message('m1', 'H001', '2')], roadEdgeIds, now)
    assert.deepEqual(starting, before)
  })
})

describe('getRankedHouseholds', () => {
  test('folds an applied override into the household it ranks', () => {
    const scenarios: HouseholdScenario[] = [scenario({ id: 'H001', needs_help: null })]
    const ranked = getRankedHouseholds(scenarios, {
      H001: override({ reportedFields: ['needs_help'] }),
    })
    assert.equal(ranked[0].scenario.household.needs_help, true)
    assert.equal(
      ranked[0].priority.factors.find((factor) => factor.key === 'needsHelp')?.points,
      10,
    )
  })

  test('counts applied check-ins as unverified reports without raising confidence', () => {
    const scenarios: HouseholdScenario[] = [scenario({ id: 'H001', needs_help: null })]
    const ranked = getRankedHouseholds(scenarios, {
      H001: override({
        reportedFields: ['needs_help'],
        checkIns: [
          { id: 'm1', message: '2', timestamp: FIXED_TIME, changes: '', reply: '' },
        ],
      }),
    })
    assert.equal(ranked[0].priority.unverifiedReportCount, 1)
    assert.equal(ranked[0].priority.confidence, 1)
  })
})
