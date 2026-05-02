import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import { useAppState } from "../state/AppContext";
import { ShadeGapLayer } from "./ShadeGapLayer";
import { primaryColor } from "../lib/routes";

// Center: midpoint of Jakarta (~-6.18) and Depok (~-6.40); zoom 11 fits both.
const JABODETABEK_CENTER: LatLngExpression = [-6.295, 106.83];
const JABODETABEK_ZOOM = 11;

const originIcon = L.divIcon({
  className: "heatroute-pin heatroute-pin-origin",
  html: "<span>A</span>",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destinationIcon = L.divIcon({
  className: "heatroute-pin heatroute-pin-destination",
  html: "<span>B</span>",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function ClickHandler() {
  const { state, dispatch } = useAppState();
  useMapEvents({
    click(e) {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!state.origin) {
        dispatch({ type: "SET_ORIGIN", point });
      } else if (!state.destination) {
        dispatch({ type: "SET_DESTINATION", point });
      } else {
        dispatch({ type: "RESET_PINS" });
      }
    },
  });
  return null;
}

function SelectionBridge() {
  const map = useMap();
  const { state } = useAppState();
  const sel = state.selectedRouteIndex;
  useEffect(() => {
    if (sel === null || !state.routes) return;
    const route = state.routes[sel];
    if (!route) return;
    const latlngs = route.geometry.coordinates.map(([lng, lat]) =>
      L.latLng(lat, lng),
    );
    if (latlngs.length === 0) return;
    const bounds = L.latLngBounds(latlngs);
    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.5 });
  }, [sel, state.routes, map]);
  return null;
}

export function MapView() {
  const { state } = useAppState();
  return (
    <MapContainer
      center={JABODETABEK_CENTER}
      zoom={JABODETABEK_ZOOM}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ShadeGapLayer visible={state.showShadeGap} />
      {state.routes?.map((route, i) => {
        const sel = state.selectedRouteIndex;
        const isSelected = sel === i;
        const isDimmed = sel !== null && !isSelected;
        return (
          <Polyline
            key={i}
            positions={route.geometry.coordinates.map(
              ([lng, lat]) => [lat, lng] as [number, number],
            )}
            pathOptions={{
              color: primaryColor(route),
              weight: isSelected ? 7 : isDimmed ? 4 : 5,
              opacity: isDimmed ? 0.3 : 0.85,
              lineCap: "round",
            }}
          />
        );
      })}
      <ClickHandler />
      <SelectionBridge />
      {state.origin && (
        <Marker
          position={[state.origin.lat, state.origin.lng]}
          icon={originIcon}
          interactive={false}
        />
      )}
      {state.destination && (
        <Marker
          position={[state.destination.lat, state.destination.lng]}
          icon={destinationIcon}
          interactive={false}
        />
      )}
    </MapContainer>
  );
}
