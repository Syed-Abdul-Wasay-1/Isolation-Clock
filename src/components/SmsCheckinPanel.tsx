import { useState } from 'react'
import { compareHouseholdIds } from '../simulation/householdStatus'
import { formatPeopleCount } from '../simulation/population'
import type { BottleneckRoadGroup, RoadEdgeOption } from '../simulation/roadImpact'
import type {
  RoadBlockReport,
  SmsCheckinRecord,
  SmsQueuedMessage,
} from '../simulation/smsCheckins'
import type { RankedHousehold } from './RankingPanel'

/** A road-block report plus everything the panel needs to explain its impact preview. */
export interface RoadBlockReportView {
  report: RoadBlockReport
  /** Households that record this edge as their bottleneck, or null when the edge is unknown. */
  dependants: BottleneckRoadGroup | null
  /** Nearby road segments the report can be re-pointed at. */
  edgeOptions: RoadEdgeOption[]
}

interface SmsCheckinPanelProps {
  rankedHouseholds: RankedHousehold[]
  selectedHouseholdId: string
  onHouseholdChange: (householdId: string) => void
  records: SmsCheckinRecord[]
  pendingMessages: SmsQueuedMessage[]
  roadBlocks: RoadBlockReportView[]
  offlineMode: boolean
  onOfflineModeChange: (enabled: boolean) => void
  onSend: (message: SmsQueuedMessage) => void
  focusedEdgeId: string | null
  onFocusRoad: (edgeId: string | null) => void
  onRoadBlockEdgeChange: (report: RoadBlockReport, edgeId: string | null) => void
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SmsCheckinPanel({
  rankedHouseholds,
  selectedHouseholdId,
  onHouseholdChange,
  records,
  pendingMessages,
  roadBlocks,
  offlineMode,
  onOfflineModeChange,
  onSend,
  focusedEdgeId,
  onFocusRoad,
  onRoadBlockEdgeChange,
}: SmsCheckinPanelProps) {
  const [freeText, setFreeText] = useState('')
  const [messageSequence, setMessageSequence] = useState(0)
  const [householdSort, setHouseholdSort] = useState<'household' | 'priority'>('household')
  const householdRank = new Map(
    rankedHouseholds.map(({ scenario }, index) => [scenario.household.id, index + 1]),
  )
  const dropdownHouseholds = [...rankedHouseholds].sort((first, second) =>
    householdSort === 'household'
      ? compareHouseholdIds(first.scenario.household.id, second.scenario.household.id)
      : householdRank.get(first.scenario.household.id)! -
        householdRank.get(second.scenario.household.id)!,
  )
  const conversation = [
    ...records.map((record) => ({
      id: record.id,
      message: record.message,
      timestamp: record.timestamp,
      reply: record.reply,
      queued: false,
    })),
    ...pendingMessages
      .filter((message) => message.householdId === selectedHouseholdId)
      .map((message) => ({
        id: message.id,
        message: message.message,
        timestamp: message.queuedAt,
        reply: 'Queued locally. This check-in has not been applied yet.',
        queued: true,
      })),
  ].sort((first, second) => first.timestamp.localeCompare(second.timestamp))

  function sendMessage(message: string) {
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return
    const nextSequence = messageSequence + 1
    setMessageSequence(nextSequence)
    onSend({
      id: `${Date.now()}-${nextSequence}`,
      householdId: selectedHouseholdId,
      message: trimmedMessage,
      queuedAt: new Date().toISOString(),
    })
    setFreeText('')
  }

  return (
    <section className="sms-panel" aria-labelledby="sms-title">
      <div className="sms-heading">
        <div>
          <div className="eyebrow">LOCAL-ONLY DEMO</div>
          <h2 id="sms-title">SMS check-in</h2>
        </div>
        <label className="offline-toggle">
          <input
            type="checkbox"
            checked={offlineMode}
            onChange={(event) => onOfflineModeChange(event.currentTarget.checked)}
          />
          <span>Offline mode</span>
        </label>
      </div>
      {offlineMode && (
        <p className="offline-banner" role="status">
          Offline: check-ins queue locally and sync when connection returns
        </p>
      )}
      <label className="sms-sort-control">
        Sort by
        <select
          aria-label="Sort SMS households by"
          value={householdSort}
          onChange={(event) => {
            const value = event.currentTarget.value
            if (value === 'household' || value === 'priority') setHouseholdSort(value)
          }}
        >
          <option value="household">Household number</option>
          <option value="priority">Priority rank</option>
        </select>
      </label>
      <label className="sms-household-select">
        Household
        <select
          value={selectedHouseholdId}
          onChange={(event) => onHouseholdChange(event.currentTarget.value)}
        >
          {dropdownHouseholds.map(({ scenario }) => {
            const rank = householdRank.get(scenario.household.id)
            return (
              <option key={scenario.household.id} value={scenario.household.id}>
                {scenario.household.id} · rank #{rank}
              </option>
            )
          })}
        </select>
      </label>
      <div className="sms-chat" aria-live="polite" aria-label="SMS conversation">
        <div className="sms-system-bubble">
          This is a browser-only simulation. No SMS will be sent.
        </div>
        {conversation.map((message) => (
          <div className="sms-message-pair" key={message.id}>
            <div className="sms-user-bubble">
              <span>{message.message}</span>
              <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
            </div>
            <div className={`sms-system-bubble${message.queued ? ' is-queued' : ''}`}>
              <span>{message.reply}</span>
              <time dateTime={message.timestamp}>
                {message.queued ? 'Queued' : formatTime(message.timestamp)}
              </time>
            </div>
          </div>
        ))}
      </div>
      <div className="sms-quick-replies" aria-label="Quick check-in messages">
        <button type="button" onClick={() => sendMessage('1')}>1 · I am safe</button>
        <button type="button" onClick={() => sendMessage('2')}>2 · I need help</button>
        <button type="button" onClick={() => sendMessage('3')}>3 · Road is blocked</button>
        <button type="button" onClick={() => sendMessage('4')}>4 · Medical help</button>
      </div>
      <form
        className="sms-compose"
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage(freeText)
        }}
      >
        <input
          aria-label="Write a free-text SMS"
          maxLength={280}
          placeholder="Or write a short message…"
          value={freeText}
          onChange={(event) => setFreeText(event.currentTarget.value)}
        />
        <button type="submit" disabled={!freeText.trim()}>
          Send
        </button>
      </form>
      <div className="road-report-list">
        <h3>Road-block reports · unverified</h3>
        {roadBlocks.length === 0 ? (
          <p>No road-block reports yet.</p>
        ) : (
          <ul>
            {roadBlocks.map(({ report, dependants, edgeOptions }) => {
              const isFocused = focusedEdgeId !== null && focusedEdgeId === report.edgeId
              return (
                <li key={report.id}>
                  <div className="road-report-head">
                    <strong>{report.householdId}</strong>
                    <span>Unverified · {formatTime(report.timestamp)}</span>
                  </div>
                  <label className="road-report-edge">
                    Reported road
                    <select
                      value={report.edgeId ?? ''}
                      onChange={(event) =>
                        onRoadBlockEdgeChange(report, event.currentTarget.value || null)
                      }
                    >
                      <option value="">Not located in the road data</option>
                      {edgeOptions.map((option) => (
                        <option key={option.edgeId} value={option.edgeId}>
                          {option.edgeId} · {option.distanceKm.toFixed(2)} km · closes at level{' '}
                          {option.threshold.toFixed(0)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {dependants ? (
                    <p className="road-report-impact">
                      Closing this road breaks the best modelled route for{' '}
                      <strong>{dependants.households.length}</strong> households ·{' '}
                      {formatPeopleCount(dependants.people)}
                      {dependants.isolatedHouseholds > 0 &&
                        ` (${dependants.isolatedHouseholds} already isolated)`}
                      .
                    </p>
                  ) : (
                    <p className="road-report-impact">
                      {report.edgeId
                        ? 'This road is not in the shipped road data, so it is not drawn.'
                        : 'No road selected yet, so there is no impact preview to show.'}
                    </p>
                  )}
                  <div className="road-report-actions">
                    <button
                      type="button"
                      disabled={!report.edgeId}
                      onClick={() => onFocusRoad(isFocused ? null : report.edgeId)}
                    >
                      {isFocused ? 'Stop highlighting' : 'Highlight dependants'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="road-report-note">
          <strong>Impact preview, not a re-simulation.</strong> An unverified report never changes a
          household&rsquo;s isolation level or ETI. The preview only counts the households that
          recorded this road as their bottleneck, and it cannot know about routes the offline
          pipeline never enumerated.
        </p>
      </div>
    </section>
  )
}
