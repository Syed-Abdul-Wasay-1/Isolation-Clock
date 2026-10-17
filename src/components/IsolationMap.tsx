import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import type { HouseholdScenario } from '../simulation/householdStatus'
import type { BoundingBox, RoadFeature, SafePlace } from '../types/study'

interface IsolationMapProps {
  boundingBox: BoundingBox
  roads: RoadFeature[]
  households: HouseholdScenario[]
  shelters: SafePlace[]
  hospitals: SafePlace[]
  scenarioLevel: number
  selectedHouseholdId: string | null
  onSelectHousehold: (householdId: string) => void
}

const householdColors = {
  safe: '#26866f',
  urgent: '#e6a336',
  isolated: '#d75b52',
  unknown: '#7b8490',
} as const

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
        {households.map(({ household, status }) => (
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
            <Tooltip>{household.id}</Tooltip>
          </CircleMarker>
        ))}
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
