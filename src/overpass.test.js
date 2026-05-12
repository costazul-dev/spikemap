import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRailroad } from './overpass.js'

const mockBounds = {
  getSouth: () => 40.0,
  getWest: () => -105.0,
  getNorth: () => 42.0,
  getEast: () => -102.0,
}

const ELEMENT = {
  type: 'way',
  id: 123,
  tags: { operator: 'Union Pacific', name: 'UP Main' },
  geometry: [
    { lat: 40.1, lon: -104.9 },
    { lat: 40.2, lon: -104.8 },
    { lat: 40.3, lon: -104.7 },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchRailroad', () => {
  it('returns a GeoJSON FeatureCollection with LineString features', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [ELEMENT] }),
    }))

    const result = await fetchRailroad('Union Pacific', mockBounds)

    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(1)

    const feature = result.features[0]
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('LineString')
    expect(feature.geometry.coordinates).toEqual([
      [-104.9, 40.1],
      [-104.8, 40.2],
      [-104.7, 40.3],
    ])
    expect(feature.properties.id).toBe(123)
    expect(feature.properties.operator).toBe('Union Pacific')
  })

  it('builds the correct Overpass query and POST body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchRailroad('BNSF', mockBounds)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://overpass-api.de/api/interpreter')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    const body = decodeURIComponent(options.body.replace(/^data=/, ''))
    expect(body).toContain('[out:json]')
    expect(body).toContain('[timeout:25]')
    expect(body).toContain('"operator"~"BNSF","i"')
    expect(body).toContain('(40,')   // south
    expect(body).toContain('-105,')  // west
    expect(body).toContain(',42,')   // north
    expect(body).toContain(',-102)') // east
    expect(body).toContain('out geom')
  })

  it('returns an empty FeatureCollection when no elements match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    }))

    const result = await fetchRailroad('Nobody Railroad', mockBounds)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(0)
  })

  it('throws when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    await expect(fetchRailroad('Union Pacific', mockBounds))
      .rejects.toThrow('Overpass request failed: Network down')
  })

  it('throws when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    }))

    await expect(fetchRailroad('Union Pacific', mockBounds))
      .rejects.toThrow('Overpass returned HTTP 429')
  })

  it('throws when the response is missing "elements"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ remark: 'timeout' }),
    }))

    await expect(fetchRailroad('Union Pacific', mockBounds))
      .rejects.toThrow('Overpass response missing "elements" field')
  })
})
