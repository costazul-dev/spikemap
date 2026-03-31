# SpikeMap

A browser-based geo-fence drawing tool built around railroad context. Click two points on a map overlaid with real railroad data and instantly produce a named border crossing — a `line_segment` fence that can be saved, loaded, and refined over time.

## What it does

- Renders a Leaflet map with OpenRailwayMap tile overlay
- Two-click mode to draw `line_segment` geo-fences
- Save fences to a portable JSON file
- Load existing fence collections and render them as polylines

## Geo-fence format

```json
{
  "crossings": [
    {
      "name": "Windsor, ON / Detroit, MI",
      "type": "line_segment",
      "border_points": [
        [-83.079, 42.329],
        [-83.033, 42.247]
      ],
      "country_north": "CAN",
      "country_south": "USA"
    }
  ]
}
```

## Stack

- **Vite + React** — fast dev/build
- **react-leaflet** — map components
- **OpenRailwayMap** — free OSM-based railroad tile layer
- **Overpass API** — on-demand railroad GeoJSON (Phase 2)
- Pure frontend — no backend, no database

## Status

Phase 1 in progress. See [CHANGELOG.md](CHANGELOG.md) for history.
