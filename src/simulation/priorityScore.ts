import type { HouseholdScenario } from './householdStatus'

export const PRIORITY_WEIGHTS = {
  age65Plus: 12,
  livesAlone: 10,
  mobilityLimitation: 12,
  medicalNeed: 10,
  noPhone: 6,
} as const

export const URGENCY_MAX_POINTS = 35
export const CONFIDENCE_PENALTY_PER_MISSING_FIELD = 0.2

export type PriorityFactorKey =
  | 'urgency'
  | keyof typeof PRIORITY_WEIGHTS

export interface PriorityFactor {
  key: PriorityFactorKey
  label: string
  points: number
  maxPoints: number
}

export interface PriorityScore {
  total: number
  factors: PriorityFactor[]
  confidence: number
  confidenceLevel: 'High' | 'Medium' | 'Low'
  confidenceNotes: string[]
  missingFieldCount: number
  topFactors: PriorityFactor[]
}

export function compareHouseholdPriority(
  firstScenario: HouseholdScenario,
  firstPriority: PriorityScore,
  secondScenario: HouseholdScenario,
  secondPriority: PriorityScore,
): number {
  return secondPriority.total - firstPriority.total ||
    (firstScenario.etiHours ?? Infinity) - (secondScenario.etiHours ?? Infinity) ||
    firstPriority.missingFieldCount - secondPriority.missingFieldCount ||
    firstScenario.household.id.localeCompare(secondScenario.household.id)
}

const vulnerabilityFields = [
  {
    key: 'age65Plus',
    field: 'age_band',
    label: 'Age 65+',
    description: 'Age band',
    weight: PRIORITY_WEIGHTS.age65Plus,
    isVulnerable: (scenario: HouseholdScenario) =>
      scenario.household.age_band === '65-74' || scenario.household.age_band === '75+',
  },
  {
    key: 'livesAlone',
    field: 'lives_alone',
    label: 'Lives alone',
    description: 'Lives alone',
    weight: PRIORITY_WEIGHTS.livesAlone,
    isVulnerable: (scenario: HouseholdScenario) => scenario.household.lives_alone === true,
  },
  {
    key: 'mobilityLimitation',
    field: 'mobility',
    label: 'Mobility limitation / wheelchair',
    description: 'Mobility',
    weight: PRIORITY_WEIGHTS.mobilityLimitation,
    isVulnerable: (scenario: HouseholdScenario) =>
      scenario.household.mobility === 'limited' || scenario.household.mobility === 'wheelchair',
  },
  {
    key: 'medicalNeed',
    field: 'medical_need',
    label: 'Medical need',
    description: 'Medical need',
    weight: PRIORITY_WEIGHTS.medicalNeed,
    isVulnerable: (scenario: HouseholdScenario) => scenario.household.medical_need === true,
  },
  {
    key: 'noPhone',
    field: 'has_phone',
    label: 'No phone',
    description: 'Has phone',
    weight: PRIORITY_WEIGHTS.noPhone,
    isVulnerable: (scenario: HouseholdScenario) => scenario.household.has_phone === false,
  },
] as const

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export function getPriorityScore(scenario: HouseholdScenario): PriorityScore {
  const urgencyPoints = scenario.status === 'isolated'
    ? URGENCY_MAX_POINTS
    : scenario.etiHours === null
      ? 0
      : URGENCY_MAX_POINTS * (1 - Math.min(scenario.etiHours, 6) / 6)
  const factors: PriorityFactor[] = [
    {
      key: 'urgency',
      label: 'Urgency',
      points: urgencyPoints,
      maxPoints: URGENCY_MAX_POINTS,
    },
    ...vulnerabilityFields.map((factor) => ({
      key: factor.key,
      label: factor.label,
      points: factor.isVulnerable(scenario) ? factor.weight : 0,
      maxPoints: factor.weight,
    })),
  ]
  const total = Math.min(100, Math.max(0, factors.reduce((sum, factor) => sum + factor.points, 0)))
  const missingFields = vulnerabilityFields.filter((factor) =>
    isMissing(scenario.household[factor.field]),
  )
  const confidenceNotes = missingFields.map((factor) => `${factor.description} — missing`)
  const missingFieldCount = missingFields.length
  const confidence = Math.max(
    0,
    1 - missingFieldCount * CONFIDENCE_PENALTY_PER_MISSING_FIELD,
  )

  return {
    total,
    factors,
    confidence,
    confidenceLevel: missingFieldCount <= 1 ? 'High' : missingFieldCount <= 3 ? 'Medium' : 'Low',
    confidenceNotes,
    missingFieldCount,
    topFactors: factors
      .filter((factor) => factor.points > 0)
      .sort((first, second) => second.points - first.points)
      .slice(0, 2),
  }
}
