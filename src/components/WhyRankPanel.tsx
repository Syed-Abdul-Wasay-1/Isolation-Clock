import type { HouseholdScenario } from '../simulation/householdStatus'
import { formatEti } from '../simulation/householdStatus'
import type { PriorityFactor, PriorityScore } from '../simulation/priorityScore'
import type { SafePlace } from '../types/study'
import type { ResourceAssignment, UnassignedHousehold } from '../simulation/resourceMatching'
import type { BottleneckRoadLabel } from '../simulation/roadImpact'
import type { SmsCheckinRecord } from '../simulation/smsCheckins'

interface WhyRankPanelProps {
  scenario: HouseholdScenario
  priority: PriorityScore
  rank: number
  safePlaces: SafePlace[]
  scenarioLevel: number
  riseRateDefault: number
  /** How the household's recorded bottleneck road should read (street name, or an honest fallback). */
  bottleneckRoadLabel: BottleneckRoadLabel | null
  resourceAssignment: ResourceAssignment | undefined
  unassigned: UnassignedHousehold | undefined
  smsStatus: 'reported by SMS' | undefined
  smsReportedFields: Array<'needs_help' | 'medical_need'>
  smsCheckins: SmsCheckinRecord[]
  onBack: () => void
}

const vulnerabilityFields = [
  ['household_size', 'Household size'],
  ['age_band', 'Age band'],
  ['mobility', 'Mobility'],
  ['medical_need', 'Medical need'],
  ['needs_help', 'Needs help'],
  ['lives_alone', 'Lives alone'],
  ['has_phone', 'Has phone'],
  ['floor_level', 'Floor level'],
  ['last_contact_hours', 'Hours since contact'],
  ['data_completeness', 'Data completeness'],
] as const

function displayValue(value: unknown, asPercentage = false): string {
  if (value === null || value === undefined || value === '') return 'Not reported'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && asPercentage) return `${Math.round(value * 100)}%`
  return String(value)
}

export function WhyRankPanel({
  scenario,
  priority,
  rank,
  safePlaces,
  scenarioLevel,
  riseRateDefault,
  bottleneckRoadLabel,
  resourceAssignment,
  unassigned,
  smsStatus,
  smsReportedFields,
  smsCheckins,
  onBack,
}: WhyRankPanelProps) {
  const { household, isolation } = scenario
  const safePlace = safePlaces.find((place) => place.id === isolation.nearest_safe_place_id)
  const reasonForFactor = (factor: PriorityFactor): string => {
    switch (factor.key) {
      case 'urgency':
        return scenario.status === 'isolated'
          ? 'it is already isolated'
          : scenario.etiHours === null
            ? 'its time to cut-off is unknown'
            : `it is cut off in ${formatEti(scenario.etiHours)}`
      case 'age65Plus':
        return 'the resident is aged 65 or older'
      case 'livesAlone':
        return 'the resident lives alone'
      case 'mobilityLimitation':
        return 'the resident has a mobility limitation or uses a wheelchair'
      case 'medicalNeed':
        return 'the household has a medical need'
      case 'needsHelp':
        return 'the household requested help by SMS (unverified)'
      case 'noPhone':
        return 'the household has no phone'
    }
  }
  const reasons = priority.topFactors.map(reasonForFactor)
  const explanation = reasons.length
    ? `Ranked #${rank} mainly because ${reasons.join(' and ')}.`
    : `Ranked #${rank} because no urgency or vulnerability factors currently add points.`
  // `needs_help` only ever arrives from an SMS check-in, so it is absent for almost every
  // household. Do not report it as missing data (the score's confidence already ignores it).
  const missingFields = vulnerabilityFields
    .filter(([field]) => field !== 'needs_help')
    .filter(([field]) => household[field] === null || household[field] === undefined)
    .map(([, label]) => label)

  return (
    <section className="why-panel" aria-labelledby="why-title">
      <button className="back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to ranking
      </button>
      <div className="why-header">
        <div className="eyebrow">HOUSEHOLD DETAIL</div>
        <h2 id="why-title">{household.id}</h2>
        <div className="why-score">
          <strong>Priority score {priority.total.toFixed(1)} / 100</strong>
          <span className={`confidence-badge confidence-${priority.confidenceLevel.toLowerCase()}`}>
            {priority.confidenceLevel} confidence · {Math.round(priority.confidence * 100)}%
          </span>
        </div>
        <p className="rank-explanation">{explanation}</p>
        <span className={`detail-status status-pill status-${scenario.status}`}>
          {scenario.status === 'isolated'
            ? 'Isolated'
            : scenario.status === 'urgent'
              ? 'Urgent · within 3 h'
              : scenario.status === 'safe'
                ? 'More than 3 h'
                : 'Route unknown'}
        </span>
        {smsStatus && (
          <span className="status-pill status-sms">
            {smsStatus} · unverified
          </span>
        )}
      </div>
      <div className="detail-metrics">
        <div>
          <span>Estimated time to isolation</span>
          <strong>{formatEti(scenario.etiHours)}</strong>
        </div>
        <div>
          <span>Isolation level</span>
          <strong>
            {isolation.isolation_level === null
              ? 'Unknown'
              : isolation.isolation_level.toFixed(1)}
          </strong>
        </div>
      </div>
      <section className="score-breakdown" aria-label="Priority score breakdown">
        <h3>Why this rank</h3>
        {priority.factors.map((factor) => (
          <div className="score-factor" key={factor.key}>
            <span>{factor.label}</span>
            <span className="score-factor-bar" aria-hidden="true">
              <i style={{ width: `${(factor.points / factor.maxPoints) * 100}%` }} />
            </span>
            <strong>{factor.points.toFixed(1)}</strong>
          </div>
        ))}
        <div className="score-total">
          <span>Total</span>
          <strong>{priority.total.toFixed(1)} / 100</strong>
        </div>
        <div className="resource-explanation">
          <strong>Resource allocation</strong>
          {resourceAssignment ? (
            <p>
              {resourceAssignment.resourceLabel} →{' '}
              {resourceAssignment.destination.name || resourceAssignment.destination.id}
              {resourceAssignment.destination.kind === 'hospital' ? ' (hospital)' : ''}
              {' '}({resourceAssignment.distanceKm.toFixed(1)} km straight-line)
              {resourceAssignment.usedDefaultHouseholdSize &&
                ` · assumed ${resourceAssignment.householdSize} people`}
            </p>
          ) : (
            <p>{unassigned?.reason ?? 'No resource assignment is available.'}</p>
          )}
        </div>
      </section>
      {smsCheckins.length > 0 && (
        <section className="sms-history" aria-label="SMS check-in history">
          <h3>SMS check-in</h3>
          <ol>
            {smsCheckins.map((checkin) => (
              <li key={checkin.id}>
                <div>
                  <strong>“{checkin.message}”</strong>
                  <time dateTime={checkin.timestamp}>
                    {new Date(checkin.timestamp).toLocaleString()}
                  </time>
                </div>
                <p>{checkin.changes}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="data-quality score-confidence">
        <div className="quality-heading">
          <span className="quality-icon">i</span>
          <strong>
            Confidence · {priority.confidenceLevel} · {priority.missingFieldCount} of 5 missing
          </strong>
        </div>
        <p>
          Confidence depends only on missing vulnerability fields. SMS check-ins are unverified and
          do not raise it; they are tracked separately as verification.
        </p>
        <p>
          Verification:{' '}
          <strong>
            {priority.unverifiedReportCount === 0
              ? 'no unverified SMS reports'
              : `${priority.unverifiedReportCount} unverified SMS ${
                  priority.unverifiedReportCount === 1 ? 'report' : 'reports'
                }`}
          </strong>
          .
        </p>
        {priority.confidenceNotes.length > 0 ? (
          <ul>
            {priority.confidenceNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : <p>Missing vulnerability fields: none.</p>}
      </div>
      <div className="detail-route">
        <div className="eyebrow">BEST MODELLED ROUTE</div>
        <div className="route-item">
          <span className="route-icon route-road">↗</span>
          <span>
            <small>Bottleneck road</small>
            <strong>{bottleneckRoadLabel ? bottleneckRoadLabel.label : 'Not available'}</strong>
            {bottleneckRoadLabel?.edgeId && (
              <span className="road-edge-id">{bottleneckRoadLabel.edgeId}</span>
            )}
          </span>
        </div>
        <div className="route-item">
          <span className="route-icon route-safe">＋</span>
          <span>
            <small>Nearest safe place</small>
            <strong>
              {safePlace
                ? `${safePlace.name || safePlace.id} · ${safePlace.id}`
                : isolation.nearest_safe_place_id || 'Not available'}
            </strong>
          </span>
        </div>
      </div>
      <div className="vulnerability-section">
        <div className="detail-section-title">
          <div>
            <div className="eyebrow">HOUSEHOLD PROFILE</div>
            <h3>Vulnerability information</h3>
          </div>
        </div>
        <dl className="vulnerability-grid">
          {vulnerabilityFields.map(([field, label]) => {
            const value = household[field]
            // Hide the SMS-only field unless a check-in actually supplied it.
            if (field === 'needs_help' && (value === null || value === undefined)) return null
            return (
              <div key={field}>
                <dt>{label}</dt>
                <dd>
                  {displayValue(value, field === 'data_completeness')}
                  {smsReportedFields.some((reportedField) => reportedField === field) &&
                    ' · SMS-reported, unverified'}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
      <div className="data-quality">
        <div className="quality-heading">
          <span className="quality-icon">i</span>
          <strong>Data quality &amp; assumptions</strong>
        </div>
        <p>
          All household fields are synthetic and unverified; data completeness is not an
          independent verification score. ETI is calculated in-browser as
          max(0, (isolation level − scenario level) ÷{' '}
          {riseRateDefault.toFixed(2)}).
        </p>
        <p>
          Current scenario: <strong>{scenarioLevel}</strong> relative index.
        </p>
        <p>
          Missing or unreported: <strong>{missingFields.length ? missingFields.join(', ') : 'None'}</strong>
        </p>
      </div>
    </section>
  )
}
