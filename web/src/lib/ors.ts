import type { LineString } from "geojson";
import type { LatLng, RouteSummary } from "../state/types";

// Routes through /api/ors-proxy so the ORS API key stays server-side.
// Dev: vite.config.ts proxies this path to ORS with the key.
// Prod: web/api/ors-proxy.ts (Vercel serverless) does the same.
const ORS_PROXY_URL = "/api/ors-proxy";

// Cache the in-flight Promise so concurrent callers (e.g. the routes effect
// re-running when weather/time change before the first response lands) share
// a single network request instead of double-hitting the ORS quota.
const cache = new Map<string, Promise<RouteSummary[]>>();

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

export function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
): Promise<RouteSummary[]> {
  const key = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = doFetchRoutes(origin, destination);
  cache.set(key, promise);
  // Don't sticky-cache failures — drop on rejection so the next caller retries.
  promise.catch(() => cache.delete(key));
  return promise;
}

async function doFetchRoutes(
  origin: LatLng,
  destination: LatLng,
): Promise<RouteSummary[]> {
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
    response = await fetch(ORS_PROXY_URL, {
      method: "POST",
      headers: {
        Accept: "application/geo+json,application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new OrsError(`Network error: ${(e as Error).message}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new OrsError(
        "ORS API key invalid (401) — cek konfigurasi server (ORS_API_KEY)",
        401,
      );
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
    if (response.status === 500) {
      // Could be the proxy itself returning 500 because key isn't configured.
      const text = await response.text().catch(() => "");
      throw new OrsError(
        text.includes("ORS_API_KEY")
          ? "Server proxy belum dikonfigurasi — set ORS_API_KEY di environment"
          : `ORS error 500: ${text.slice(0, 200)}`,
        500,
      );
    }
    const text = await response.text().catch(() => "");
    throw new OrsError(
      `ORS error ${response.status}: ${text.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as OrsResponse;
  return data.features.map((f) => ({
    geometry: f.geometry,
    duration: f.properties.summary.duration,
    distance: f.properties.summary.distance,
  }));
}
