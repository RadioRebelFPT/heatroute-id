const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}|${lng.toFixed(4)}`;
}

type NominatimAddress = {
  amenity?: string;
  shop?: string;
  tourism?: string;
  building?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city_district?: string;
  city?: string;
  county?: string;
};

type NominatimResponse = {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
};

function formatName(data: NominatimResponse): string | null {
  const a = data.address ?? {};
  const primary =
    a.amenity ||
    a.shop ||
    a.tourism ||
    a.building ||
    a.road ||
    a.pedestrian ||
    a.neighbourhood ||
    data.name ||
    null;
  const area =
    a.suburb || a.village || a.town || a.city_district || a.city || a.county || null;

  if (primary && area && primary !== area) return `${primary}, ${area}`;
  if (primary) return primary;
  if (area) return area;
  if (data.display_name) {
    return data.display_name.split(",").slice(0, 2).join(", ").trim();
  }
  return null;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const url = new URL(ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("zoom", "17");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "id");

  const fetchPromise = (async () => {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        cache.set(key, null);
        return null;
      }
      const data = (await res.json()) as NominatimResponse;
      const name = formatName(data);
      cache.set(key, name);
      return name;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, fetchPromise);
  return fetchPromise;
}
