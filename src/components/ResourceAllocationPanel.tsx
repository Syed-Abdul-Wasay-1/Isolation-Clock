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
            onChange={(event) => onConfigChange('boats', event.currentTarget.valueAsNumber)}
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
            onChange={(event) => onConfigChange('vehicles', event.currentTarget.valueAsNumber)}
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
              onConfigChange('bedCapacityMultiplier', event.currentTarget.valueAsNumber)
            }
          />
        </label>
      </div>
      <div className="allocation-totals">
        <div><strong>{allocation.usedBoats}</strong><span>boats used / {config.boats}</span></div>
        <div><strong>{allocation.usedVehicles}</strong><span>vehicles used / {config.vehicles}</span></div>
        <div><strong>{allocation.unassigned.length}</strong><span>unassigned</span></div>
      </div>
      <div className="allocation-beds">
        <strong>Beds used per shelter</strong>
        {Array.from(allocation.bedsUsedByShelter, ([shelterId, bedsUsed]) => (
          <div key={shelterId}>
            <span>{shelterId}</span>
            <span>
              {bedsUsed} / {allocation.bedCapacityByShelter.get(shelterId) ?? 0}
            </span>
          </div>
        ))}
      </div>
      {allocation.sheltersUsingDefaultCapacity.length > 0 && (
        <p className="allocation-note">
          Missing shelter capacity for {allocation.sheltersUsingDefaultCapacity.join(', ')};
          assuming {config.defaultShelterCapacity} beds per shelter before the multiplier.
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
        Shelter assignment uses straight-line distance, not road routes.
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
