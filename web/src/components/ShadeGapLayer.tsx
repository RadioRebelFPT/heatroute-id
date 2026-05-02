import { useEffect, useState } from "react";
import { Polyline, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import { shadeGapColor } from "../lib/shade";
import {
  loadShardsForBounds,
  shadeSnapshotVersion,
  type Bbox,
  type ShadeFeature,
} from "../lib/shadeData";

// Below this zoom, shade-gap segments are too dense to render usefully
// (and would spawn thousands of SVG polylines). Hidden but still loadable
// via route-bbox prefetch in useRoutesEffect.
const MIN_RENDER_ZOOM = 14;

const VIEWPORT_PAD_DEG = 0.005; // ~550m of margin so panning feels seamless

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

  return (
    <>
      {features.map((f, i) => {
        const positions = f.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        const key = f.properties.osm_id ?? `f${i}`;
        return (
          <Polyline
            key={key}
            positions={positions}
            pathOptions={{
              color: shadeGapColor(f.properties.shade_gap),
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
