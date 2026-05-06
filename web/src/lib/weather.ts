export type Weather = {
  temperature: number;
  apparentTemp: number;
  humidity: number;
  uvIndex: number;
};

/** 24-entry hourly snapshot for today (local time), indexed by hour-of-day
 * (0..23). For past hours of today, Open-Meteo backfills with observed values;
 * for future hours, it returns forecast. So `weatherAt(hourly, time)` is
 * "what the climate is at that hour today" without distinguishing observed vs.
 * forecast in the UI. */
export type WeatherHourly = {
  hours: Weather[];
  fetchedAt: number;
};

const URL = "https://api.open-meteo.com/v1/forecast";
const cache = new Map<string, WeatherHourly>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}|${lng.toFixed(3)}`;
}

type OpenMeteoHourlyResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    relative_humidity_2m: number[];
    uv_index: number[];
  };
};

export async function fetchWeatherHourly(lat: number, lng: number): Promise<WeatherHourly> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly:
      "temperature_2m,apparent_temperature,relative_humidity_2m,uv_index",
    forecast_days: "2",
    timezone: "auto",
  });

  const response = await fetch(`${URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo error ${response.status}`);
  }
  const data = (await response.json()) as OpenMeteoHourlyResponse;
  const h = data.hourly;
  const hours: Weather[] = h.time.map((_, i) => ({
    temperature: h.temperature_2m[i],
    apparentTemp: h.apparent_temperature[i],
    humidity: h.relative_humidity_2m[i],
    uvIndex: h.uv_index[i],
  }));
  const out: WeatherHourly = { hours, fetchedAt: Date.now() };
  cache.set(key, out);
  return out;
}

function localDayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Pick the forecast hour matching `time` across the 2-day window. Returns
 * null if `time` is outside the fetched window. */
export function weatherAt(hourly: WeatherHourly | null, time: Date): Weather | null {
  if (!hourly) return null;
  const dayOffset = Math.round(
    (localDayStart(time) - localDayStart(new Date(hourly.fetchedAt))) / 86_400_000,
  );
  if (dayOffset < 0) return null;
  const idx = dayOffset * 24 + time.getHours();
  return hourly.hours[idx] ?? null;
}
