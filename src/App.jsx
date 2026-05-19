import { useState, useCallback, useRef, useEffect, Fragment } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const CARTO_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ORM_TILE = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'

const FENCE_COLOR = '#f0b429'
const FENCE_HOVER_COLOR = '#ffd166'
const FENCE_SELECTED_COLOR = '#d97c14'
const PENDING_COLOR = '#ffffff'

function endpointIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="endpoint-marker"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function ClickHandler({ onMapClick, selectedIndex, setSelectedIndex, fenceClickedRef }) {
  useMapEvents({
    click(e) {
      if (fenceClickedRef.current) {
        fenceClickedRef.current = false
        return
      }
      if (selectedIndex !== null) {
        setSelectedIndex(null)
        return
      }
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

function FenceLayer({ crossings, setCrossings, selectedIndex, setSelectedIndex, pendingPoint, setPendingPoint, pushHistory, fenceClickedRef }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  return crossings.map((c, i) => {
    let color = FENCE_COLOR
    if (i === selectedIndex) color = FENCE_SELECTED_COLOR
    else if (i === hoveredIndex) color = FENCE_HOVER_COLOR

    return (
      <Fragment key={i}>
        <Polyline
          positions={toLeafletPositions(c.border_points)}
          pathOptions={{ color, weight: i === hoveredIndex ? 6 : 4 }}
          eventHandlers={{
            mouseover() { setHoveredIndex(i) },
            mouseout() { setHoveredIndex(null) },
            click(e) {
              fenceClickedRef.current = true
              if (pendingPoint !== null) setPendingPoint(null)
              setSelectedIndex(i)
            },
          }}
        />
        {i === selectedIndex && c.border_points.map((pt, ptIdx) => (
          <Marker
            key={ptIdx}
            position={[pt[1], pt[0]]}
            draggable
            icon={endpointIcon()}
            eventHandlers={{
              dragstart() {
                pushHistory(crossings, null)
              },
              dragend(e) {
                const { lat, lng } = e.target.getLatLng()
                setCrossings(prev => {
                  const next = [...prev]
                  const updated = { ...next[i], border_points: [...next[i].border_points] }
                  updated.border_points[ptIdx] = [lng, lat]
                  next[i] = updated
                  return next
                })
              },
            }}
          />
        ))}
      </Fragment>
    )
  })
}

function FencePanel({ crossings, setCrossings, selectedIndex, setSelectedIndex, pushHistory }) {
  if (selectedIndex === null) return null

  const crossing = crossings[selectedIndex]

  function handleNameChange(value) {
    setCrossings(prev => {
      const next = [...prev]
      next[selectedIndex] = { ...next[selectedIndex], name: value }
      return next
    })
  }

  function handleDelete() {
    pushHistory(crossings, null)
    setCrossings(prev => prev.filter((_, i) => i !== selectedIndex))
    setSelectedIndex(null)
  }

  return (
    <div className="fence-panel">
      <div className="fence-panel-title">FENCE {selectedIndex + 1}</div>
      <input
        className="fence-name-input"
        type="text"
        defaultValue={crossing.name}
        placeholder="Name…"
        onBlur={e => handleNameChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleNameChange(e.target.value)
            e.target.blur()
          }
        }}
      />
      <button className="btn btn-ghost" onClick={handleDelete}>Delete</button>
    </div>
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
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('spikemap_welcomed'))
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('spikemap_undo_history')) ?? [] } catch { return [] }
  })
  const fileInputRef = useRef(null)
  const fenceClickedRef = useRef(false)

  const pushHistory = useCallback((snapshotCrossings, snapshotPending) => {
    setHistory((prev) => {
      const next = [{ crossings: snapshotCrossings, pendingPoint: snapshotPending }, ...prev].slice(0, 100)
      localStorage.setItem('spikemap_undo_history', JSON.stringify(next))
      return next
    })
  }, [])

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const [snapshot, ...rest] = prev
      setCrossings(snapshot.crossings)
      setPendingPoint(snapshot.pendingPoint)
      localStorage.setItem('spikemap_undo_history', JSON.stringify(rest))
      return rest
    })
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo])

  const handleDismissWelcome = useCallback(() => {
    localStorage.setItem('spikemap_welcomed', '1')
    setShowWelcome(false)
  }, [])

  const handleMapClick = useCallback((latLng) => {
    if (!pendingPoint) {
      pushHistory(crossings, null)
      setPendingPoint(latLng)
    } else {
      pushHistory(crossings, pendingPoint)
      setCrossings((prev) => [...prev, newCrossing(pendingPoint, latLng)])
      setPendingPoint(null)
    }
  }, [pendingPoint, crossings, pushHistory])

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
          setHistory([])
          localStorage.removeItem('spikemap_undo_history')
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
          <button className="btn" onClick={handleUndo} disabled={history.length === 0}>Undo</button>
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

      <FencePanel
        key={selectedIndex}
        crossings={crossings}
        setCrossings={setCrossings}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        pushHistory={pushHistory}
      />

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

        <ClickHandler
          onMapClick={handleMapClick}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          fenceClickedRef={fenceClickedRef}
        />

        <FenceLayer
          crossings={crossings}
          setCrossings={setCrossings}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          pendingPoint={pendingPoint}
          setPendingPoint={setPendingPoint}
          pushHistory={pushHistory}
          fenceClickedRef={fenceClickedRef}
        />

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
