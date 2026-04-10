import { useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ORM_TILE = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'

const FENCE_COLOR = '#e84040'
const PENDING_COLOR = '#f5a623'

// Listens for map clicks and calls back with [lat, lng]
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function newCrossing(pointA, pointB) {
  return {
    name: '',
    type: 'line_segment',
    border_points: [
      [pointA[1], pointA[0]], // store as [lng, lat] per the JSON format
      [pointB[1], pointB[0]],
    ],
    country_north: '',
    country_south: '',
  }
}

// Convert stored [lng, lat] border_points to Leaflet [lat, lng] positions
function toLeafletPositions(border_points) {
  return border_points.map(([lng, lat]) => [lat, lng])
}

export default function App() {
  const [crossings, setCrossings] = useState([])
  const [pendingPoint, setPendingPoint] = useState(null) // first click, waiting for second
  const fileInputRef = useRef(null)

  const handleMapClick = useCallback((latLng) => {
    if (!pendingPoint) {
      setPendingPoint(latLng)
    } else {
      setCrossings((prev) => [...prev, newCrossing(pendingPoint, latLng)])
      setPendingPoint(null)
    }
  }, [pendingPoint])

  const handleCancel = useCallback(() => {
    setPendingPoint(null)
  }, [])

  const handleSave = useCallback(() => {
    const payload = JSON.stringify({ crossings }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'crossings.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [crossings])

  const handleLoad = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (Array.isArray(data.crossings)) {
          setCrossings(data.crossings)
          setPendingPoint(null)
        } else {
          alert('Invalid file: missing "crossings" array.')
        }
      } catch {
        alert('Could not parse JSON file.')
      }
    }
    reader.readAsText(file)
    // reset so the same file can be re-loaded
    e.target.value = ''
  }, [])

  const drawingMode = pendingPoint !== null

  return (
    <div className="app">
      <div className="toolbar">
        <span className="logo">SpikeMap</span>
        <div className="toolbar-actions">
          {drawingMode ? (
            <>
              <span className="hint">Click second point to finish fence</span>
              <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
            </>
          ) : (
            <span className="hint">Click two points to draw a fence</span>
          )}
          <button className="btn" onClick={handleSave} disabled={crossings.length === 0}>
            Save JSON
          </button>
          <button className="btn" onClick={() => fileInputRef.current.click()}>
            Load JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleLoad}
          />
        </div>
      </div>

      {crossings.length > 0 && (
        <div className="fence-count">{crossings.length} fence{crossings.length !== 1 ? 's' : ''}</div>
      )}

      <MapContainer
        center={[47.5, -97]}
        zoom={5}
        className="map"
        zoomControl={true}
      >
        <TileLayer
          url={OSM_TILE}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <TileLayer
          url={ORM_TILE}
          attribution='&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
          maxZoom={19}
          opacity={0.8}
        />

        <ClickHandler onMapClick={handleMapClick} />

        {/* Committed fences */}
        {crossings.map((c, i) => (
          <Polyline
            key={i}
            positions={toLeafletPositions(c.border_points)}
            pathOptions={{ color: FENCE_COLOR, weight: 3 }}
          />
        ))}

        {/* Pending first point — draw a tiny dot via a degenerate polyline */}
        {pendingPoint && (
          <Polyline
            positions={[pendingPoint, pendingPoint]}
            pathOptions={{ color: PENDING_COLOR, weight: 8 }}
          />
        )}
      </MapContainer>
    </div>
  )
}
