import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import type { PathOptions } from "leaflet";
import { shadeGapColor } from "../lib/shade";
import { loadShadeData, type ShadeCollection, type ShadeFeature } from "../lib/shadeData";

export function ShadeGapLayer({ visible }: { visible: boolean }) {
  const [data, setData] = useState<ShadeCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadShadeData()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    console.error("[ShadeGapLayer]", error);
    return null;
  }
  if (!data || !visible) return null;

  const styleFn = (feature?: ShadeFeature): PathOptions => {
    const gap = feature?.properties?.shade_gap ?? 1;
    return {
      color: shadeGapColor(gap),
      weight: 4,
      opacity: 0.85,
      lineCap: "round",
    };
  };

  return <GeoJSON data={data} style={styleFn as never} />;
}
