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
  /**
   * The road edge the report is attached to, if any. It defaults to the reporting household's own
   * recorded bottleneck road. A `null` edge means the report names a street the shipped road data
   * cannot locate, so it is listed but never drawn or used for the impact preview.
   */
  edgeId: string | null
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
  // A check-in can supply a *missing* value, but it must never overwrite a known one: an unverified
  // SMS is not evidence that beats a recorded field.
  const medicalNeedMissing =
    household.medical_need === null || household.medical_need === undefined
  return {
    ...household,
    ...(override.reportedFields.includes('medical_need') && medicalNeedMissing
      ? { medical_need: true }
      : {}),
    ...(override.reportedFields.includes('needs_help') && household.needs_help !== true
      ? { needs_help: true }
      : {}),
  }
}

/**
 * Re-points one road-block report at a different road edge. The report stays unverified; this only
 * changes which road the *impact preview* is drawn for.
 */
export function setRoadBlockEdge(
  overrides: SmsOverrides,
  householdId: string,
  reportId: string,
  edgeId: string | null,
): SmsOverrides {
  const override = overrides[householdId]
  if (!override) return overrides
  return {
    ...overrides,
    [householdId]: {
      ...override,
      roadBlockReports: override.roadBlockReports.map((report) =>
        report.id === reportId ? { ...report, edgeId } : report,
      ),
    },
  }
}
