import { formatPeopleCount } from '../simulation/population'
import type { EscalationPoint } from '../simulation/escalation'

interface EscalationCurvePanelProps {
  points: EscalationPoint[]
  scenarioLevel: number
  riseRateDefault: number
  totalHouseholds: number
  onJumpToLevel: (level: number) => void
}

export function EscalationCurvePanel({
  points,
  scenarioLevel,
  riseRateDefault,
  totalHouseholds,
  onJumpToLevel,
}: EscalationCurvePanelProps) {
  const worst = points[points.length - 1]
  const scale = Math.max(1, ...points.map((point) => point.isolatedHouseholds))
  const now = points.find((point) => point.hours === 0)
  const inThreeHours = points.find((point) => point.hours === 3)

  return (
    <section className="escalation-panel" aria-labelledby="escalation-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">THE CLOCK</div>
          <h2 id="escalation-title">Escalation curve</h2>
        </div>
      </div>
      <p className="section-intro">
        Households cut off as the scenario level keeps rising at{' '}
        {riseRateDefault.toFixed(1)} index points per hour.
      </p>
      <ol className="escalation-chart">
        {points.map((point) => {
          const isNow = point.hours === 0
          const isCurrentHour = Math.abs(point.level - scenarioLevel) < 1e-9
          return (
            <li key={point.hours}>
              <button
                className={`escalation-bar${isNow ? ' is-now' : ''}${
                  isCurrentHour ? ' is-current' : ''
                }`}
                type="button"
                onClick={() => onJumpToLevel(point.level)}
                title={`Level ${point.level.toFixed(1)} · ${point.isolatedHouseholds} households cut off`}
                aria-label={
                  point.hours === 0
                    ? `Now: level ${point.level.toFixed(1)}, ${point.isolatedHouseholds} households isolated. Jump the scenario slider to this level.`
                    : `In ${point.hours} hours: level ${point.level.toFixed(1)}, ${point.isolatedHouseholds} households isolated. Jump the scenario slider to this level.`
                }
              >
                <span
                  className="escalation-bar-fill"
                  style={{ height: `${(point.isolatedHouseholds / scale) * 100}%` }}
                />
                <span className="escalation-bar-value">{point.isolatedHouseholds}</span>
                <span className="escalation-bar-hour">{point.hours === 0 ? 'now' : `+${point.hours}h`}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="escalation-summary">
        {now ? (
          <>
            <strong>{now.isolatedHouseholds}</strong> of {totalHouseholds} households are isolated
            right now.
          </>
        ) : null}
        {inThreeHours ? (
          <>
            {' '}
            At <strong>+3 h</strong> (level {inThreeHours.level.toFixed(1)}),{' '}
            <strong>{inThreeHours.isolatedHouseholds}</strong> households /{' '}
            <strong>{inThreeHours.isolatedPeople}</strong> people are cut off.
          </>
        ) : null}
        {worst ? (
          <>
            {' '}
            After <strong>+{worst.hours} h</strong> (level {worst.level.toFixed(1)}),{' '}
            {formatPeopleCount({
              households: worst.isolatedHouseholds,
              people: worst.isolatedPeople,
              unknownSizeHouseholds: 0,
            })}{' '}
            are cut off.
          </>
        ) : null}
      </p>
      <p className="escalation-note">
        The rise rate is the illustrative <code>rise_rate_default</code> setting
        {' '}({riseRateDefault.toFixed(1)} index points per hour), not a measured rate of flooding.
        Clicking an hour moves the scenario slider to that level.
      </p>
    </section>
  )
}
