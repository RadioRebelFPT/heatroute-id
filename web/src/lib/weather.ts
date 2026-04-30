export type Weather = {
  temperature: number;
  apparentTemp: number;
  humidity: number;
  uvIndex: number;
};

const URL = "https://api.open-meteo.com/v1/forecast";
const cache = new Map<string, Weather>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}|${lng.toFixed(3)}`;
}

type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    uv_index: number;
  };
};

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,uv_index",
    timezone: "auto",
  });

  const response = await fetch(`${URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo error ${response.status}`);
  }
  const data = (await response.json()) as OpenMeteoResponse;
  const weather: Weather = {
    temperature: data.current.temperature_2m,
    apparentTemp: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    uvIndex: data.current.uv_index,
  };
  cache.set(key, weather);
  return weather;
}
