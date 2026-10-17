import { useEffect, useState } from 'react'
import type {
  HouseholdDataset,
  IsolationDataset,
  RoadDataset,
  SafePlace,
  SafePlaceDataset,
  StudyData,
} from '../types/study'

type StudyDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StudyData }

// Resolve data paths against the deployed base so the app also works when it is
// hosted under a sub-path (for example a GitHub Pages project site).
const DATA_BASE = import.meta.env.BASE_URL

async function loadJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${DATA_BASE}${path}`, { signal })
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status} ${response.statusText}).`)
  }
  return response.json() as Promise<T>
}

function isSafePlace(value: unknown): value is SafePlace {
  if (typeof value !== 'object' || value === null) return false
  const place = value as Record<string, unknown>
  return (
    typeof place.id === 'string' &&
    typeof place.lat === 'number' &&
    Number.isFinite(place.lat) &&
    typeof place.lon === 'number' &&
    Number.isFinite(place.lon)
  )
}

export function useStudyData(): StudyDataState {
  const [state, setState] = useState<StudyDataState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [householdData, shelterData, hospitalData, roadData, isolationData] =
          await Promise.all([
            loadJson<HouseholdDataset>('data/households.json', controller.signal),
            loadJson<SafePlaceDataset>('data/shelters.json', controller.signal),
            loadJson<SafePlaceDataset>('data/hospitals.json', controller.signal),
            loadJson<RoadDataset>('data/roads.json', controller.signal),
            loadJson<IsolationDataset>('data/isolation.json', controller.signal),
          ])

        if (
          !Array.isArray(householdData.households) ||
          !Array.isArray(shelterData.shelters) ||
          !shelterData.shelters.every(isSafePlace) ||
          !Array.isArray(hospitalData.hospitals) ||
          !hospitalData.hospitals.every(isSafePlace) ||
          !Array.isArray(roadData.features) ||
          !Array.isArray(isolationData.households) ||
          !Number.isFinite(isolationData.config?.rise_rate_default) ||
          isolationData.config.rise_rate_default <= 0
        ) {
          throw new Error('One or more study data files have an invalid structure.')
        }

        const isolationByHousehold = new Map(
          isolationData.households.map((record) => [record.id, record]),
        )
        const missingIsolation = householdData.households.find(
          (household) => !isolationByHousehold.has(household.id),
        )
        if (missingIsolation) {
          throw new Error(`Isolation data is missing household ${missingIsolation.id}.`)
        }

        setState({
          status: 'ready',
          data: {
            boundingBox: householdData.bounding_box,
            households: householdData.households,
            shelters: shelterData.shelters,
            hospitals: hospitalData.hospitals,
            roads: roadData.features,
            isolationByHousehold,
            riseRateDefault: isolationData.config.rise_rate_default,
          },
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'An unknown data-loading error occurred.',
        })
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  return state
}
