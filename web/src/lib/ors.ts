import type { LineString } from "geojson";
import type { LatLng, RouteSummary } from "../state/types";

const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

const cache = new Map<string, RouteSummary[]>();

function cacheKey(o: LatLng, d: LatLng): string {
  return `${o.lat.toFixed(5)}|${o.lng.toFixed(5)}|${d.lat.toFixed(5)}|${d.lng.toFixed(5)}`;
}

export class OrsError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OrsError";
    this.status = status;
  }
}

type OrsFeature = {
  geometry: LineString;
  properties: { summary: { duration: number; distance: number } };
};

type OrsResponse = { features: OrsFeature[] };

export async function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
): Promise<RouteSummary[]> {
  const key = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached) return cached;

  if (!apiKey) {
    throw new OrsError("VITE_ORS_API_KEY belum di-set di .env.local");
  }

  const body = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    alternative_routes: {
      target_count: 3,
      share_factor: 0.5,
      weight_factor: 1.6,
    },
    instructions: false,
  };

  let response: Response;
  try {
    response = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        Accept: "application/geo+json,application/json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new OrsError(`Network error: ${(e as Error).message}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new OrsError("ORS API key invalid (401) — cek .env.local", 401);
    }
    if (response.status === 429) {
      throw new OrsError("ORS rate limit (429) — coba lagi 1 menit", 429);
    }
    if (response.status === 404) {
      throw new OrsError(
        "Tidak ada rute pejalan kaki antara titik tersebut",
        404,
      );
    }
    const text = await response.text().catch(() => "");
    throw new OrsError(
      `ORS error ${response.status}: ${text.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as OrsResponse;
  const routes: RouteSummary[] = data.features.map((f) => ({
    geometry: f.geometry,
    duration: f.properties.summary.duration,
    distance: f.properties.summary.distance,
  }));

  cache.set(key, routes);
  return routes;
}
