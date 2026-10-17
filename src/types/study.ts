export interface BoundingBox {
  min_lat: number
  min_lon: number
  max_lat: number
  max_lon: number
}

export interface Household {
  id: string
  lat: number
  lon: number
  household_size?: number | null
  age_band: string | null
  mobility: string | null
  medical_need: boolean | null
  needs_help?: boolean | null
  lives_alone: boolean | null
  has_phone: boolean | null
  floor_level: string | null
  last_contact_hours: number | null
  data_completeness: number | null
}

export interface SafePlace {
  id: string
  name: string | null
  lat: number
  lon: number
  capacity?: number | null
  /**
   * Stamped at load time by `validateStudyData` so the allocator and the UI can tell a shelter bed
   * from a hospital bed. It is not part of the shipped JSON.
   */
  kind?: 'shelter' | 'hospital'
}

export interface HouseholdDataset {
  synthetic: boolean
  seed: number
  bounding_box: BoundingBox
  households: Household[]
}

export interface SafePlaceDataset {
  synthetic: boolean
  seed: number
  bounding_box: BoundingBox
  shelters?: SafePlace[]
  hospitals?: SafePlace[]
}

export interface RoadFeature {
  type: 'Feature'
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  properties: {
    edge_id: string
    threshold: number
  }
}

export interface RoadDataset {
  type: 'FeatureCollection'
  features: RoadFeature[]
  elevation_source: string
}

export interface IsolationRecord {
  id: string
  road_node_id: string
  isolation_level: number | null
  nearest_safe_place_id: string | null
  /** The bottleneck edge's id — the locatable key. Null when no route exists. */
  bottleneck_road: string | null
  /**
   * The bottleneck street's OpenStreetMap name, for display only. Present in data regenerated after
   * the pipeline fix; absent in the committed dataset, where some `bottleneck_road` values are
   * street names instead of edge ids.
   */
  bottleneck_road_name?: string | null
}

export interface IsolationDataset {
  config: {
    rise_rate_default: number
  }
  households: IsolationRecord[]
}

export interface StudyData {
  boundingBox: BoundingBox
  households: Household[]
  shelters: SafePlace[]
  hospitals: SafePlace[]
  roads: RoadFeature[]
  isolationByHousehold: Map<string, IsolationRecord>
  riseRateDefault: number
}
