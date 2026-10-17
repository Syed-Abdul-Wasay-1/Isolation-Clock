import type { IsolationRecord, SafePlace, StudyData } from '../types/study'

/** The five raw JSON payloads exactly as they came off the wire. */
export interface RawStudyDataFiles {
  households: unknown
  shelters: unknown
  hospitals: unknown
  roads: unknown
  isolation: unknown
}

export const INVALID_STRUCTURE_MESSAGE =
  'One or more study data files have an invalid structure.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSafePlace(value: unknown): value is SafePlace {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lon === 'number' &&
    Number.isFinite(value.lon)
  )
}

/**
 * Validates the shipped study files and assembles the `StudyData` the app runs on.
 *
 * Every failure is an explicit thrown `Error` with a message the UI can show: the app must show an
 * error state, never a crash and never a silent empty dataset.
 */
export function validateStudyData(files: RawStudyDataFiles): StudyData {
  const householdsFile = files.households
  const sheltersFile = files.shelters
  const hospitalsFile = files.hospitals
  const roadsFile = files.roads
  const isolationFile = files.isolation

  if (
    !isRecord(householdsFile) ||
    !Array.isArray(householdsFile.households) ||
    !isRecord(sheltersFile) ||
    !Array.isArray(sheltersFile.shelters) ||
    !sheltersFile.shelters.every(isSafePlace) ||
    !isRecord(hospitalsFile) ||
    !Array.isArray(hospitalsFile.hospitals) ||
    !hospitalsFile.hospitals.every(isSafePlace) ||
    !isRecord(roadsFile) ||
    !Array.isArray(roadsFile.features) ||
    !isRecord(isolationFile) ||
    !Array.isArray(isolationFile.households) ||
    !isRecord(isolationFile.config) ||
    !Number.isFinite(isolationFile.config.rise_rate_default) ||
    (isolationFile.config.rise_rate_default as number) <= 0
  ) {
    throw new Error(INVALID_STRUCTURE_MESSAGE)
  }

  const householdList = householdsFile.households as StudyData['households']
  const isolationRecords = isolationFile.households as IsolationRecord[]
  const isolationByHousehold = new Map(
    isolationRecords.map((record) => [record.id, record] as const),
  )
  const missingIsolation = householdList.find(
    (household) => typeof household?.id !== 'string' || !isolationByHousehold.has(household.id),
  )
  if (missingIsolation) {
    throw new Error(`Isolation data is missing household ${missingIsolation.id}.`)
  }

  return {
    boundingBox: householdsFile.bounding_box as StudyData['boundingBox'],
    households: householdList,
    shelters: (sheltersFile.shelters as SafePlace[]).map((place) => ({
      ...place,
      kind: 'shelter' as const,
    })),
    hospitals: (hospitalsFile.hospitals as SafePlace[]).map((place) => ({
      ...place,
      kind: 'hospital' as const,
    })),
    roads: roadsFile.features as StudyData['roads'],
    isolationByHousehold,
    riseRateDefault: isolationFile.config.rise_rate_default as number,
  }
}
