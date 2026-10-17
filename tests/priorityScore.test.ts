import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compareHouseholdPriority,
  getPriorityScore,
  PRIORITY_WEIGHTS,
  URGENCY_MAX_POINTS,
} from '../src/simulation/priorityScore.ts'
import { household, scenario, vulnerableHousehold } from './helpers.ts'

function assertClose(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  )
}

describe('urgency points', () => {
  test('awards the maximum to an already-isolated household', () => {
    const score = getPriorityScore(scenario({}, 'isolated', 0))

    assert.equal(score.factors[0].points, URGENCY_MAX_POINTS)
  })

  test('scales linearly inside the six-hour window', () => {
    assertClose(getPriorityScore(scenario({}, 'safe', 3)).factors[0].points, 17.5)
    assertClose(getPriorityScore(scenario({}, 'safe', 1.5)).factors[0].points, 26.25)
  })

  test('awards nothing at six hours or beyond', () => {
    assert.equal(getPriorityScore(scenario({}, 'safe', 6)).factors[0].points, 0)
    assert.equal(getPriorityScore(scenario({}, 'safe', 40)).factors[0].points, 0)
  })

  test('awards nothing when ETI is unavailable', () => {
    const score = getPriorityScore(scenario({}, 'unknown', null))

    assert.equal(score.factors[0].points, 0)
    assert.equal(score.total, 0)
  })
})

describe('vulnerability points', () => {
  test('adds the configured weight for each known signal', () => {
    const score = getPriorityScore(
      scenario({
        age_band: '75+',
        lives_alone: true,
        mobility: 'limited',
        medical_need: true,
        has_phone: false,
      }),
    )
    const points = new Map(score.factors.map((factor) => [factor.key, factor.points]))

    assert.equal(points.get('age65Plus'), PRIORITY_WEIGHTS.age65Plus)
    assert.equal(points.get('livesAlone'), PRIORITY_WEIGHTS.livesAlone)
    assert.equal(points.get('mobilityLimitation'), PRIORITY_WEIGHTS.mobilityLimitation)
    assert.equal(points.get('medicalNeed'), PRIORITY_WEIGHTS.medicalNeed)
    assert.equal(points.get('noPhone'), PRIORITY_WEIGHTS.noPhone)
  })

  test('counts both older age bands and the wheelchair mobility state', () => {
    assert.equal(
      getPriorityScore(scenario({ age_band: '65-74' })).factors.find((f) => f.key === 'age65Plus')
        ?.points,
      12,
    )
    assert.equal(
      getPriorityScore(scenario({ mobility: 'wheelchair' })).factors.find(
        (f) => f.key === 'mobilityLimitation',
      )?.points,
      12,
    )
  })

  test('gives zero points to signals that are present but not vulnerable', () => {
    const score = getPriorityScore(
      scenario({ age_band: 'adult', mobility: 'none', has_phone: true }),
    )

    assert.equal(score.total, 0)
  })

  test('caps the practical maximum at 85', () => {
    const score = getPriorityScore({
      ...scenario(vulnerableHousehold(), 'isolated', 0),
    })

    assert.equal(score.total, 85)
  })
})

describe('confidence', () => {
  test('stays at one when nothing is missing', () => {
    const score = getPriorityScore(scenario())

    assertClose(score.confidence, 1)
    assert.equal(score.confidenceLevel, 'High')
    assert.deepEqual(score.confidenceNotes, [])
  })

  test('drops by 0.2 per missing vulnerability field and floors at zero', () => {
    const one = getPriorityScore(scenario({ age_band: null }))
    const two = getPriorityScore(scenario({ age_band: null, mobility: null }))
    const three = getPriorityScore(scenario({ age_band: null, mobility: null, medical_need: null }))
    const four = getPriorityScore(
      scenario({ age_band: null, mobility: null, medical_need: null, lives_alone: null }),
    )
    const five = getPriorityScore(
      scenario({
        age_band: null,
        mobility: null,
        medical_need: null,
        lives_alone: null,
        has_phone: null,
      }),
    )

    assertClose(one.confidence, 0.8)
    assertClose(two.confidence, 0.6)
    assertClose(three.confidence, 0.4)
    assertClose(four.confidence, 0.2)
    assertClose(five.confidence, 0)
  })

  test('bands the confidence level by the number of missing fields', () => {
    assert.equal(getPriorityScore(scenario({ age_band: null })).confidenceLevel, 'High')
    assert.equal(
      getPriorityScore(scenario({ age_band: null, mobility: null })).confidenceLevel,
      'Medium',
    )
    assert.equal(
      getPriorityScore(scenario({ age_band: null, mobility: null, medical_need: null }))
        .confidenceLevel,
      'Medium',
    )
    assert.equal(
      getPriorityScore(
        scenario({ age_band: null, mobility: null, medical_need: null, lives_alone: null }),
      ).confidenceLevel,
      'Low',
    )
  })

  test('names the missing fields in the notes', () => {
    const score = getPriorityScore(scenario({ age_band: null, has_phone: null }))

    assert.equal(score.missingFieldCount, 2)
    assert.deepEqual(score.confidenceNotes, ['Age band — missing', 'Has phone — missing'])
  })

  test('a missing field adds no vulnerability points', () => {
    const missing = getPriorityScore(scenario({ age_band: null }))
    const present = getPriorityScore(scenario({ age_band: '75+' }))

    assert.equal(missing.total, 0)
    assert.equal(present.total, 12)
  })
})

describe('top factors', () => {
  test('reports the two heaviest positive contributors', () => {
    const score = getPriorityScore(scenario(vulnerableHousehold(), 'isolated', 0))

    assert.deepEqual(
      score.topFactors.map((factor) => factor.label),
      ['Urgency', 'Age 65+'],
    )
  })

  test('omits factors worth nothing', () => {
    const score = getPriorityScore(scenario({ medical_need: true }))

    assert.deepEqual(
      score.topFactors.map((factor) => factor.key),
      ['medicalNeed'],
    )
  })
})

describe('compareHouseholdPriority', () => {
  test('orders by total score descending', () => {
    const higher = scenario({ age_band: '75+' })
    const lower = scenario({ age_band: 'adult' })

    assert.ok(
      compareHouseholdPriority(higher, getPriorityScore(higher), lower, getPriorityScore(lower)) < 0,
    )
  })

  test('breaks a score tie with the sooner ETI', () => {
    const sooner = scenario({}, 'safe', 1)
    const later = scenario({}, 'safe', 2)

    assert.ok(
      compareHouseholdPriority(sooner, getPriorityScore(sooner), later, getPriorityScore(later)) < 0,
    )
  })

  test('breaks a further tie with fewer missing fields', () => {
    // Same score (no vulnerable signals) but one household has a blank field.
    const complete = scenario({ age_band: 'adult' })
    const incomplete = scenario({ age_band: null })

    assert.ok(
      compareHouseholdPriority(
        complete,
        getPriorityScore(complete),
        incomplete,
        getPriorityScore(incomplete),
      ) < 0,
    )
  })

  test('breaks the final tie by household id', () => {
    const first = scenario({ id: 'a-household' })
    const second = scenario({ id: 'b-household' })

    assert.ok(
      compareHouseholdPriority(first, getPriorityScore(first), second, getPriorityScore(second)) < 0,
    )
    assert.ok(
      compareHouseholdPriority(second, getPriorityScore(second), first, getPriorityScore(first)) > 0,
    )
  })
})

test('household helper only changes the requested field', () => {
  const record = household({ id: 'custom' })

  assert.equal(record.id, 'custom')
  assert.equal(record.household_size, 4)
})
