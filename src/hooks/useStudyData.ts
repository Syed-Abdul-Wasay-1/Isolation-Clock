import { useEffect, useState } from 'react'
import { validateStudyData } from './studyDataValidation'
import type { StudyData } from '../types/study'

type StudyDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StudyData }

// Resolve data paths against the deployed base so the app also works when it is
// hosted under a sub-path (for example a GitHub Pages project site).
const DATA_BASE = import.meta.env.BASE_URL

async function loadJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${DATA_BASE}${path}`, { signal })
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status} ${response.statusText}).`)
  }
  return response.json() as Promise<unknown>
}

export function useStudyData(): StudyDataState {
  const [state, setState] = useState<StudyDataState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [households, shelters, hospitals, roads, isolation] = await Promise.all([
          loadJson('data/households.json', controller.signal),
          loadJson('data/shelters.json', controller.signal),
          loadJson('data/hospitals.json', controller.signal),
          loadJson('data/roads.json', controller.signal),
          loadJson('data/isolation.json', controller.signal),
        ])

        setState({
          status: 'ready',
          data: validateStudyData({ households, shelters, hospitals, roads, isolation }),
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
