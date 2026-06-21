import type { Ambient } from './types'

// WMO weather codes → short text (https://open-meteo.com/en/docs)
const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { timeout: 6000, maximumAge: 600_000, enableHighAccuracy: false },
    )
  })
}

/** Best-effort current weather at the user's location. Returns null on any failure. */
export async function getAmbient(): Promise<Ambient | null> {
  if (!navigator.onLine) return null
  try {
    const p = await getPosition()
    if (!p) return null
    const lat = +p.coords.latitude.toFixed(3)
    const lon = +p.coords.longitude.toFixed(3)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!r.ok) return null
    const c = (await r.json())?.current ?? {}
    return {
      temp_c: typeof c.temperature_2m === 'number' ? c.temperature_2m : undefined,
      humidity: typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : undefined,
      weather: WMO[c.weather_code] ?? undefined,
      lat, lon,
    }
  } catch {
    return null
  }
}
