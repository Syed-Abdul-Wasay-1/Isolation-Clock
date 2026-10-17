import { useEffect, useMemo } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { formatEti } from '../simulation/householdStatus'
import type { HouseholdScenario, HouseholdStatus } from '../simulation/householdStatus'
import type { ResourceAllocation } from '../simulation/resourceMatching'
import type { BoundingBox, RoadFeature, SafePlace } from '../types/study'

export interface HouseholdMapAnnotation {
  /** Rank inside the household's own tab (rescue or evacuate). */
  rank: number
  /** Top scoring factors, already turned into short human labels. */
  reasons: string[]
}

interface IsolationMapProps {
  boundingBox: BoundingBox
  roads: RoadFeature[]
  households: HouseholdScenario[]
  shelters: SafePlace[]
  hospitals: SafePlace[]
  scenarioLevel: number
  selectedHouseholdId: string | null
  onSelectHousehold: (householdId: string) => void
  allocation: ResourceAllocation
  annotations: Map<string, HouseholdMapAnnotation>
}

const householdColors = {
  safe: '#26866f',
  urgent: '#e6a336',
  isolated: '#d75b52',
  unknown: '#7b8490',
} as const

const householdStatusLabels: Record<HouseholdStatus, string> = {
  safe: 'More than 3 h to isolation',
  urgent: 'Within 3 h of isolation',
  isolated: 'Already isolated',
  unknown: 'Route unknown',
}

function FitMapToData({ boundingBox }: { boundingBox: BoundingBox }) {
  const map = useMap()
  const bounds = useMemo(
    () =>
      latLngBounds(
        [boundingBox.min_lat, boundingBox.min_lon],
        [boundingBox.max_lat, boundingBox.max_lon],
      ),
    [boundingBox],
  )

  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [bounds, map])

  return null
}

const shelterIcon = divIcon({
  className: 'safe-place-icon shelter-icon',
  html: '<span aria-hidden="true">⌂</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})
const hospitalIcon = divIcon({
  className: 'safe-place-icon hospital-icon',
  html: '<span aria-hidden="true">+</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function toRoadPositions(feature: RoadFeature): [number, number][] {
  return feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
}

export function IsolationMap({
  boundingBox,
  roads,
  households,
  shelters,
  hospitals,
  scenarioLevel,
  selectedHouseholdId,
  onSelectHousehold,
  allocation,
  annotations,
}: IsolationMapProps) {
  const center: [number, number] = [
    (boundingBox.min_lat + boundingBox.max_lat) / 2,
    (boundingBox.min_lon + boundingBox.max_lon) / 2,
  ]

  return (
    <div className="map-frame">
      <MapContainer
        center={center}
        zoom={14}
        minZoom={12}
        maxZoom={18}
        scrollWheelZoom
        className="study-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToData boundingBox={boundingBox} />
        {roads.map((road) => (
          <Polyline
            key={road.properties.edge_id}
            positions={toRoadPositions(road)}
            pathOptions={{
              color: scenarioLevel >= road.properties.threshold ? '#4385cf' : '#9aa3aa',
              weight: scenarioLevel >= road.properties.threshold ? 2.5 : 1.8,
              opacity: scenarioLevel >= road.properties.threshold ? 0.9 : 0.7,
            }}
          />
        ))}
        {households.map(({ household }) => {
          const assignment = allocation.assignments.get(household.id)
          if (!assignment) return null
          return (
            <Polyline
              key={`assignment-${household.id}`}
              positions={[
                [household.lat, household.lon],
                [assignment.shelter.lat, assignment.shelter.lon],
              ]}
              pathOptions={{
                color: assignment.resourceType === 'boat' ? '#4778c8' : '#d99a2e',
                weight: 1,
                opacity: 0.65,
                className: 'allocation-line',
              }}
            />
          )
        })}
        {shelters.map((shelter) => (
          <Marker
            key={shelter.id}
            position={[shelter.lat, shelter.lon]}
            icon={shelterIcon}
          >
            <Tooltip>{shelter.name || shelter.id} · Shelter</Tooltip>
          </Marker>
        ))}
        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            position={[hospital.lat, hospital.lon]}
            icon={hospitalIcon}
          >
            <Tooltip>{hospital.name || hospital.id} · Hospital</Tooltip>
          </Marker>
        ))}
        {households.map(({ household, status, etiHours }) => {
          const assignment = allocation.assignments.get(household.id)
          const annotation = annotations.get(household.id)
          return (
            <CircleMarker
              key={household.id}
              center={[household.lat, household.lon]}
              radius={selectedHouseholdId === household.id ? 7 : 4}
              pathOptions={{
                color: selectedHouseholdId === household.id ? '#152a31' : '#fff',
                weight: selectedHouseholdId === household.id ? 2 : 1,
                fillColor: householdColors[status],
                fillOpacity: 0.92,
              }}
              eventHandlers={{ click: () => onSelectHousehold(household.id) }}
            >
              <Popup>
                <strong>{household.id}</strong>
                {annotation ? ` · Rank #${annotation.rank}` : ''}
                <br />
                {householdStatusLabels[status]}
                <br />
                {status === 'isolated' ? 'No route out' : `${formatEti(etiHours)} to isolation`}
                {assignment ? (
                  <>
                    <br />
                    {assignment.resourceLabel} to {assignment.shelter.name || assignment.shelter.id}
                  </>
                ) : null}
                {annotation && annotation.reasons.length > 0 ? (
                  <>
                    <br />
                    Why: {annotation.reasons.join(' · ')}
                  </>
                ) : null}
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <div className="map-label">
        <span className="map-label-dot" />
        Sukkur study area
      </div>
      <div className="map-legend">
        <span><i className="legend-household legend-safe" />More than 3 h</span>
        <span><i className="legend-household legend-urgent" />Within 3 h</span>
        <span><i className="legend-household legend-isolated" />Isolated</span>
        <span><i className="legend-place legend-shelter" />Shelter</span>
        <span><i className="legend-place legend-hospital" />Hospital</span>
      </div>
      <div className="road-key">
        <span><i className="road-line road-open" />Road open</span>
        <span><i className="road-line road-closed" />Scenario-closed</span>
      </div>
    </div>
  )
}
