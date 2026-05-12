const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/**
 * Fetches railroad ways for a given operator within a bounding box.
 *
 * @param {string} operator - The railroad operator name (e.g., "Union Pacific")
 * @param {L.LatLngBounds} bounds - A Leaflet LatLngBounds object
 * @returns {Promise<GeoJSON.FeatureCollection>} GeoJSON FeatureCollection of LineString features
 */
export async function fetchRailroad(operator, bounds) {
  const s = bounds.getSouth()
  const w = bounds.getWest()
  const n = bounds.getNorth()
  const e = bounds.getEast()

  const query = `[out:json][timeout:25]; way["railway"="rail"]["operator"~"${operator}","i"](${s},${w},${n},${e}); out geom;`

  const body = 'data=' + encodeURIComponent(query)

  let response
  try {
    response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (err) {
    throw new Error(`Overpass request failed: ${err.message}`)
  }

  if (!response.ok) {
    throw new Error(`Overpass returned HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.elements) {
    throw new Error('Overpass response missing "elements" field')
  }

  const features = data.elements.map((element) => ({
    type: 'Feature',
    properties: { id: element.id, ...element.tags },
    geometry: {
      type: 'LineString',
      coordinates: element.geometry.map(({ lon, lat }) => [lon, lat]),
    },
  }))

  return {
    type: 'FeatureCollection',
    features,
  }
}
