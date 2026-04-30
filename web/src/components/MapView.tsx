import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import { useAppState } from "../state/AppContext";
import { ShadeGapLayer } from "./ShadeGapLayer";
import { primaryColor } from "../lib/routes";

const SALEMBA_CENTER: LatLngExpression = [-6.195, 106.845];
const SALEMBA_ZOOM = 16;

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

export function MapView() {
  const { state } = useAppState();
  return (
    <MapContainer
      center={SALEMBA_CENTER}
      zoom={SALEMBA_ZOOM}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ShadeGapLayer visible={state.showShadeGap} />
      {state.routes?.map((route, i) => (
        <Polyline
          key={i}
          positions={route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          )}
          pathOptions={{
            color: primaryColor(route),
            weight: 5,
            opacity: 0.85,
            lineCap: "round",
          }}
        />
      ))}
      <ClickHandler />
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
