import { useState } from 'react'
import type { ResourceAllocation, ResourceConfig } from '../simulation/resourceMatching'

type EditableResourceConfig = Pick<
  ResourceConfig,
  'boats' | 'vehicles' | 'bedCapacityMultiplier'
>

interface ResourceAllocationPanelProps {
  allocation: ResourceAllocation
  config: ResourceConfig
  onConfigChange: (key: keyof EditableResourceConfig, value: number) => void
}

export function ResourceAllocationPanel({
  allocation,
  config,
  onConfigChange,
}: ResourceAllocationPanelProps) {
  const [inputMessage, setInputMessage] = useState<string | null>(null)
  const assignedPeople = Array.from(allocation.assignments.values()).reduce(
    (sum, assignment) => sum + assignment.householdSize,
    0,
  )
  const unassignedPeople = allocation.unassigned.reduce(
    (sum, item) => sum + item.householdSize,
    0,
  )

  /**
   * The page ignores non-finite or negative values and floors the rest, which used to happen
   * silently. Say what was rejected or rounded instead of letting the field snap back unexplained.
   */
  function commit(key: keyof EditableResourceConfig, label: string, raw: number) {
    if (!Number.isFinite(raw) || raw < 0) {
      setInputMessage(`${label} must be a number of 0 or more — the previous value was kept.`)
      return
    }
    const rounded = key === 'bedCapacityMultiplier' ? raw : Math.floor(raw)
    setInputMessage(
      rounded === raw ? null : `${label} must be a whole number — rounded down to ${rounded}.`,
    )
    onConfigChange(key, raw)
  }

  return (
    <section className="allocation-panel" aria-labelledby="allocation-title">
      <div className="allocation-heading">
        <div>
          <div className="eyebrow">CURRENT SCENARIO LEVEL</div>
          <h2 id="allocation-title">Resource allocation</h2>
        </div>
      </div>
      <div className="allocation-controls">
        <label>
          Boats
          <input
            aria-label="Number of boats"
            type="number"
            min="0"
            step="1"
            value={config.boats}
            onChange={(event) => commit('boats', 'Boats', event.currentTarget.valueAsNumber)}
          />
        </label>
        <label>
          Vehicles
          <input
            aria-label="Number of vehicles"
            type="number"
            min="0"
            step="1"
            value={config.vehicles}
            onChange={(event) => commit('vehicles', 'Vehicles', event.currentTarget.valueAsNumber)}
          />
        </label>
        <label>
          Bed capacity multiplier
          <input
            aria-label="Bed capacity multiplier"
            type="number"
            min="0"
            step="0.1"
            value={config.bedCapacityMultiplier}
            onChange={(event) =>
              commit('bedCapacityMultiplier', 'Bed capacity multiplier', event.currentTarget.valueAsNumber)
            }
          />
        </label>
      </div>
      <p className="allocation-message" role="status">
        {inputMessage ?? ''}
      </p>
      <div className="allocation-totals">
        <div><strong>{allocation.usedBoats}</strong><span>boats used / {config.boats}</span></div>
        <div><strong>{allocation.usedVehicles}</strong><span>vehicles used / {config.vehicles}</span></div>
        <div><strong>{assignedPeople}</strong><span>people assigned</span></div>
        <div>
          <strong>{allocation.unassigned.length}</strong>
          <span>households unassigned · {unassignedPeople} people</span>
        </div>
      </div>
      <div className="allocation-beds">
        <strong>Beds used per shelter / hospital</strong>
        {Array.from(allocation.bedsUsedByDestination, ([destinationId, bedsUsed]) => (
          <div key={destinationId}>
            <span>{destinationId}</span>
            <span>
              {bedsUsed} / {allocation.bedCapacityByDestination.get(destinationId) ?? 0}
            </span>
          </div>
        ))}
      </div>
      {allocation.destinationsUsingDefaultCapacity.length > 0 && (
        <p className="allocation-note">
          Missing capacity for {allocation.destinationsUsingDefaultCapacity.join(', ')};
          assuming {config.defaultShelterCapacity} beds per safe place before the multiplier.
        </p>
      )}
      {allocation.assumedHouseholdSizeCount > 0 && (
        <p className="allocation-note">
          {allocation.assumedHouseholdSizeCount} household size(s) missing; assuming{' '}
          {config.defaultHouseholdSize} people.
        </p>
      )}
      <p className="allocation-note">
        Boats carry up to {config.boatCapacity} people and vehicles up to {config.vehicleCapacity}.
        Shelter and hospital assignment uses straight-line distance, not road routes.
      </p>
      <div className="unassigned-list">
        <strong>First 10 unassigned households</strong>
        {allocation.unassigned.length === 0 ? (
          <p>All households are assigned at this scenario level.</p>
        ) : (
          <ul>
            {allocation.unassigned.slice(0, 10).map((item) => (
              <li key={item.scenario.household.id}>
                <span>
                  {item.scenario.household.id}
                  {item.usedDefaultHouseholdSize && ` · assumed ${item.householdSize} people`}
                </span>
                <span>{item.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
