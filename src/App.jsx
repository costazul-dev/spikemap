import { useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const CARTO_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ORM_TILE = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'

const FENCE_COLOR = '#f0b429'
const PENDING_COLOR = '#ffffff'

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
      [pointA[1], pointA[0]],
      [pointB[1], pointB[0]],
    ],
    country_north: '',
    country_south: '',
  }
}

function toLeafletPositions(border_points) {
  return border_points.map(([lng, lat]) => [lat, lng])
}

function SpikeIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="10" height="3" />
      <rect x="3" y="3" width="4" height="9" />
      <polygon points="3,12 7,12 5,16" />
    </svg>
  )
}

function WelcomeModal({ onDismiss }) {
  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <h2 className="welcome-title"><SpikeIcon />SpikeMap</h2>
        <p className="welcome-body">
          SpikeMap is a tool for logging railroad grade crossing fences along the U.S.-Mexico and U.S.-Canada borders.
          Click two points on the map to draw a fence segment. Save your work as JSON to pick up where you left off.
        </p>
        <p className="welcome-credit">
          Built by Esteban — <a href="#" className="welcome-link">personal website</a>
        </p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [crossings, setCrossings] = useState([])
  const [pendingPoint, setPendingPoint] = useState(null)
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('spikemap_welcomed'))
  const fileInputRef = useRef(null)

  const handleDismissWelcome = useCallback(() => {
    localStorage.setItem('spikemap_welcomed', '1')
    setShowWelcome(false)
  }, [])

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
    e.target.value = ''
  }, [])

  const drawingMode = pendingPoint !== null
  const fenceS = crossings.length !== 1 ? 'S' : ''

  return (
    <div className="app">
      {showWelcome && <WelcomeModal onDismiss={handleDismissWelcome} />}
      <div className="toolbar">
        <span className="logo">
          <SpikeIcon />
          SpikeMap
        </span>
        <div className="toolbar-actions">
          {drawingMode ? (
            <>
              <span className="hint">Click second point to finish fence</span>
              <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
            </>
          ) : (
            <span className="hint">Click two points to draw a fence</span>
          )}
          <button className="btn" aria-label="About SpikeMap" onClick={() => setShowWelcome(true)}>
            ⓘ
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={crossings.length === 0}>
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
        <div className="fence-count">{crossings.length} FENCE{fenceS} LOGGED</div>
      )}

      <MapContainer
        center={[47.5, -97]}
        zoom={5}
        className={`map${drawingMode ? ' map-drawing' : ''}`}
        zoomControl={true}
      >
        <TileLayer
          url={CARTO_TILE}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />
        <TileLayer
          url={ORM_TILE}
          attribution='&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
          maxZoom={19}
          opacity={0.6}
        />

        <ClickHandler onMapClick={handleMapClick} />

        {crossings.map((c, i) => (
          <Polyline
            key={i}
            positions={toLeafletPositions(c.border_points)}
            pathOptions={{ color: FENCE_COLOR, weight: 4 }}
          />
        ))}

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
