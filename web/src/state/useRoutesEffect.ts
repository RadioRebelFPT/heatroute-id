import { useEffect } from "react";
import { useAppState } from "./AppContext";
import { fetchRoutes, OrsError } from "../lib/ors";
import { loadShardsForBounds, type Bbox } from "../lib/shadeData";
import { computeAndLabel } from "../lib/hes";
import type { LineString } from "geojson";
import type { LatLng } from "./types";

const ORS_API_KEY = (import.meta.env.VITE_ORS_API_KEY as string | undefined) ?? "";

const ORIGIN_DEST_PAD_DEG = 0.02; // ~2.2km cushion while routes are still in flight
const ROUTE_BBOX_PAD_DEG = 0.005; // ~550m cushion around the actual route geometry

function pinBbox(origin: LatLng, dest: LatLng): Bbox {
  const south = Math.min(origin.lat, dest.lat) - ORIGIN_DEST_PAD_DEG;
  const north = Math.max(origin.lat, dest.lat) + ORIGIN_DEST_PAD_DEG;
  const west = Math.min(origin.lng, dest.lng) - ORIGIN_DEST_PAD_DEG;
  const east = Math.max(origin.lng, dest.lng) + ORIGIN_DEST_PAD_DEG;
  return [south, west, north, east];
}

function routesBbox(geoms: LineString[]): Bbox {
  let s = Infinity;
  let n = -Infinity;
  let w = Infinity;
  let e = -Infinity;
  for (const g of geoms) {
    for (const [lng, lat] of g.coordinates) {
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lng < w) w = lng;
      if (lng > e) e = lng;
    }
  }
  return [s - ROUTE_BBOX_PAD_DEG, w - ROUTE_BBOX_PAD_DEG, n + ROUTE_BBOX_PAD_DEG, e + ROUTE_BBOX_PAD_DEG];
}

export function useRoutesEffect() {
  const { state, dispatch } = useAppState();

  useEffect(() => {
    if (!state.origin || !state.destination) return;
    const origin = state.origin;
    const destination = state.destination;

    let cancelled = false;
    dispatch({ type: "ROUTES_LOADING" });

    // Kick off the route fetch in parallel with a coarse pre-warm of the
    // shards that surround the pin pair. The route can detour, so we still
    // refine the shard set with the precise route bbox once it returns.
    const routesP = fetchRoutes(origin, destination, ORS_API_KEY);
    void loadShardsForBounds(pinBbox(origin, destination));

    routesP
      .then(async (routes) => {
        if (cancelled) return;
        const shade = await loadShardsForBounds(
          routesBbox(routes.map((r) => r.geometry)),
        );
        if (cancelled) return;
        const labeled = computeAndLabel(routes, shade);
        dispatch({ type: "ROUTES_SUCCESS", routes: labeled });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message =
          e instanceof OrsError ? e.message : (e as Error).message;
        dispatch({ type: "ROUTES_ERROR", message });
      });

    return () => {
      cancelled = true;
    };
  }, [state.origin, state.destination, dispatch]);
}
