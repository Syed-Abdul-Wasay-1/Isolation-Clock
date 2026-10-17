import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  INVALID_STRUCTURE_MESSAGE,
  validateStudyData,
} from '../src/hooks/studyDataValidation.ts'
import type { RawStudyDataFiles } from '../src/hooks/studyDataValidation.ts'
import { household, isolationRecord, shelter } from './helpers.ts'

const BOUNDING_BOX = { min_lat: 27.688, min_lon: 68.838, max_lat: 27.711, max_lon: 68.883 }

function validFiles(): RawStudyDataFiles {
  return {
    households: {
      synthetic: true,
      seed: 20261017,
      bounding_box: BOUNDING_BOX,
      households: [household({ id: 'H001' })],
    },
    shelters: {
      synthetic: true,
      seed: 20261017,
      bounding_box: BOUNDING_BOX,
      shelters: [shelter()],
    },
    hospitals: {
      synthetic: true,
      seed: 20261017,
      bounding_box: BOUNDING_BOX,
      hospitals: [shelter({ id: 'HOSP1', name: 'Hospital 1' })],
    },
    roads: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[68.85, 27.7], [68.86, 27.71]] },
          properties: { edge_id: 'edge-1', threshold: 42 },
        },
      ],
      elevation_source: 'test',
    },
    isolation: {
      config: { rise_rate_default: 10 },
      households: [isolationRecord('H001', 40)],
    },
  }
}

describe('validateStudyData', () => {
  test('assembles StudyData from valid files', () => {
    const data = validateStudyData(validFiles())
    assert.equal(data.households.length, 1)
    assert.equal(data.shelters.length, 1)
    assert.equal(data.hospitals.length, 1)
    assert.equal(data.roads.length, 1)
    assert.equal(data.riseRateDefault, 10)
    assert.equal(data.isolationByHousehold.get('H001')?.isolation_level, 40)
  })

  test('rejects a file that is not an object at all', () => {
    assert.throws(
      () => validateStudyData({ ...validFiles(), households: 'not json' }),
      new Error(INVALID_STRUCTURE_MESSAGE),
    )
  })

  test('rejects a missing collection array', () => {
    const files = validFiles()
    assert.throws(
      () => validateStudyData({ ...files, roads: { type: 'FeatureCollection' } }),
      new Error(INVALID_STRUCTURE_MESSAGE),
    )
  })

  test('rejects a shelter record with no usable id', () => {
    const files = validFiles()
    assert.throws(
      () =>
        validateStudyData({
          ...files,
          shelters: { ...(files.shelters as object), shelters: [{ lat: 27.7, lon: 68.85 }] },
        }),
      new Error(INVALID_STRUCTURE_MESSAGE),
    )
  })

  test('rejects a non-finite rise rate', () => {
    const files = validFiles()
    assert.throws(
      () =>
        validateStudyData({
          ...files,
          isolation: { config: { rise_rate_default: Number.NaN }, households: [] },
        }),
      new Error(INVALID_STRUCTURE_MESSAGE),
    )
  })

  test('rejects a zero or negative rise rate', () => {
    const files = validFiles()
    assert.throws(
      () =>
        validateStudyData({
          ...files,
          isolation: { config: { rise_rate_default: 0 }, households: [] },
        }),
      new Error(INVALID_STRUCTURE_MESSAGE),
    )
  })

  test('reports a household with no matching isolation record', () => {
    const files = validFiles()
    assert.throws(
      () => validateStudyData({ ...files, isolation: { config: { rise_rate_default: 10 }, households: [] } }),
      new Error('Isolation data is missing household H001.'),
    )
  })

  test('reports the first household whose isolation record is missing', () => {
    const files = validFiles()
    assert.throws(
      () =>
        validateStudyData({
          ...files,
          households: {
            ...(files.households as object),
            households: [household({ id: 'H002' }), household({ id: 'H003' })],
          },
        }),
      new Error('Isolation data is missing household H002.'),
    )
  })
})
