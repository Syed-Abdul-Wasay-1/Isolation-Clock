const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Straight-line (great-circle) distance in kilometres. This is **not** a routed distance and
 * never a travel time — the app has no route geometry at runtime.
 */
export function distanceInKm(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
): number {
  const latitudeDifference = toRadians(second.lat - first.lat)
  const longitudeDifference = toRadians(second.lon - first.lon)
  const firstLatitude = toRadians(first.lat)
  const secondLatitude = toRadians(second.lat)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
    Math.sin(longitudeDifference / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}
