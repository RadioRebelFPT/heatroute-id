import { useEffect, useState } from "react";
import { Polyline, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import { shadeGapColor } from "../lib/shade";
import {
  categorizeHes,
  HES_CATEGORY_COLORS,
  segmentHes,
} from "../lib/hes";
import {
  loadShardsForBounds,
  shadeSnapshotVersion,
  type Bbox,
  type ShadeFeature,
} from "../lib/shadeData";
import { buildingShadeTimeFactor, shadeSensitivityFactor, sunAltitudeRad } from "../lib/sun";
import { weatherAt } from "../lib/weather";
import { useAppState } from "../state/AppContext";

// Below this zoom, shade-gap segments are too dense to render usefully
// (and would spawn thousands of SVG polylines). Hidden but still loadable
// via route-bbox prefetch in useRoutesEffect.
const MIN_RENDER_ZOOM = 14;

const VIEWPORT_PAD_DEG = 0.005; // ~550m of margin so panning feels seamless

// Progressive disclosure by OSM highway class: arterials at z14, neighborhood
// streets at z16, footways/paths only at z17+. Keeps the city-overview view
// readable instead of dumping every alley as a polyline.
const MIN_ZOOM_FOR_CLASS: Record<string, number> = {
  motorway: 14, motorway_link: 14,
  trunk: 14, trunk_link: 14,
  primary: 14, primary_link: 14,
  secondary: 14, secondary_link: 14,
  tertiary: 15, tertiary_link: 15,
  unclassified: 16, residential: 16,
  living_street: 17, service: 17, pedestrian: 17,
  footway: 17, path: 17, cycleway: 17, steps: 17, track: 17,
};
const DEFAULT_MIN_ZOOM = 17;

function visibleAtZoom(highway: string | undefined, zoom: number): boolean {
  const min = (highway && MIN_ZOOM_FOR_CLASS[highway]) ?? DEFAULT_MIN_ZOOM;
  return zoom >= min;
}

function boundsToBbox(b: LatLngBounds): Bbox {
  return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
}

function featureIntersectsBbox(f: ShadeFeature, bbox: Bbox): boolean {
  const [s, w, n, e] = bbox;
  for (const [lng, lat] of f.geometry.coordinates) {
    if (lat >= s && lat <= n && lng >= w && lng <= e) return true;
  }
  return false;
}

export function ShadeGapLayer({ visible }: { visible: boolean }) {
  const map = useMap();
  const { state } = useAppState();
  const weather = weatherAt(state.weather, state.departureTime);
  const altitude = sunAltitudeRad(state.departureTime);
  const bldgTimeFactor = buildingShadeTimeFactor(altitude);
  const shadeSensitivity = shadeSensitivityFactor(altitude);
  const [zoom, setZoom] = useState<number>(map.getZoom());
  const [features, setFeatures] = useState<ShadeFeature[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const refresh = () => {
      const z = map.getZoom();
      setZoom(z);
      if (z < MIN_RENDER_ZOOM) {
        setFeatures([]);
        return;
      }
      const b = map.getBounds();
      const bbox = boundsToBbox(b);
      const padded: Bbox = [
        bbox[0] - VIEWPORT_PAD_DEG,
        bbox[1] - VIEWPORT_PAD_DEG,
        bbox[2] + VIEWPORT_PAD_DEG,
        bbox[3] + VIEWPORT_PAD_DEG,
      ];
      void loadShardsForBounds(padded).then((coll) => {
        if (cancelled) return;
        const inView = coll.features.filter((f) => featureIntersectsBbox(f, padded));
        setFeatures(inView);
      });
    };
    refresh();
    return () => {
      cancelled = true;
    };
    // We refresh imperatively from useMapEvents below; keep this effect
    // for the initial mount + visibility toggle only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, map]);

  useMapEvents({
    moveend: () => {
      if (!visible) return;
      const z = map.getZoom();
      setZoom(z);
      if (z < MIN_RENDER_ZOOM) {
        setFeatures([]);
        return;
      }
      const b = map.getBounds();
      const bbox = boundsToBbox(b);
      const padded: Bbox = [
        bbox[0] - VIEWPORT_PAD_DEG,
        bbox[1] - VIEWPORT_PAD_DEG,
        bbox[2] + VIEWPORT_PAD_DEG,
        bbox[3] + VIEWPORT_PAD_DEG,
      ];
      void loadShardsForBounds(padded).then((coll) => {
        // Pull in any newly-loaded shards intersecting the current viewport.
        const inView = coll.features.filter((f) => featureIntersectsBbox(f, padded));
        setFeatures(inView);
        // Touching the version keeps lint happy and helps debugging.
        void shadeSnapshotVersion();
      });
    },
  });

  if (!visible || zoom < MIN_RENDER_ZOOM || features.length === 0) return null;

  const rendered = features.filter((f) => visibleAtZoom(f.properties.highway, zoom));
  if (rendered.length === 0) return null;

  return (
    <>
      {rendered.map((f, i) => {
        const positions = f.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        const key = f.properties.osm_id ?? `f${i}`;
        // Full HES (climate + shade + veg) once weather has loaded; falls back
        // to shade-only color in the brief window before the first weather
        // fetch resolves so the map is never blank.
        const color = weather
          ? HES_CATEGORY_COLORS[categorizeHes(segmentHes(f.properties, weather, bldgTimeFactor, shadeSensitivity))]
          : shadeGapColor(f.properties.shade_gap);
        return (
          <Polyline
            key={key}
            positions={positions}
            pathOptions={{
              color,
              weight: 4,
              opacity: 0.85,
              lineCap: "round",
            }}
          />
        );
      })}
    </>
  );
}
