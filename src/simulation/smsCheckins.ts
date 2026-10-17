export interface SmsQueuedMessage {
  id: string
  householdId: string
  message: string
  queuedAt: string
}

export interface SmsCheckinRecord {
  id: string
  message: string
  timestamp: string
  changes: string
  reply: string
}

export interface RoadBlockReport {
  id: string
  householdId: string
  timestamp: string
  status: 'unverified'
}

export interface SmsHouseholdOverride {
  smsStatus?: 'reported by SMS'
  reportedFields: Array<'needs_help' | 'medical_need'>
  checkIns: SmsCheckinRecord[]
  roadBlockReports: RoadBlockReport[]
}

export type SmsOverrides = Record<string, SmsHouseholdOverride>

export function getEffectiveHousehold<T extends { medical_need: boolean | null; needs_help?: boolean | null }>(
  household: T,
  override: SmsHouseholdOverride | undefined,
): T {
  if (!override || override.reportedFields.length === 0) return household
  return {
    ...household,
    ...(override.reportedFields.includes('medical_need') ? { medical_need: true } : {}),
    ...(override.reportedFields.includes('needs_help') ? { needs_help: true } : {}),
  }
}
