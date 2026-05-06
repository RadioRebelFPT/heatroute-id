import { useEffect, useRef } from "react";
import { useAppState } from "./useAppState";
import type { LatLng } from "./types";

const MIN_UPDATE_DISTANCE_M = 50;
const MIN_ACCURACY_CHANGE_M = 25;

function distanceMeters(a: LatLng, b: LatLng) {
  const radiusM = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function shouldAcceptUpdate(
  next: LatLng,
  nextAccuracy: number | null,
  prev: LatLng | null,
  prevAccuracy: number | null,
) {
  if (!prev) return true;
  if (distanceMeters(prev, next) >= MIN_UPDATE_DISTANCE_M) return true;
  if (nextAccuracy === null || prevAccuracy === null) return false;
  return Math.abs(nextAccuracy - prevAccuracy) >= MIN_ACCURACY_CHANGE_M;
}

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return {
      status: "denied" as const,
      message: "Izin lokasi ditolak.",
    };
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return {
      status: "unavailable" as const,
      message: "Lokasi tidak tersedia.",
    };
  }
  return {
    status: "error" as const,
    message: "GPS belum berhasil membaca lokasi.",
  };
}

export function useGeolocationEffect() {
  const { state, dispatch } = useAppState();
  const lastPoint = useRef<LatLng | null>(null);
  const lastAccuracy = useRef<number | null>(null);

  useEffect(() => {
    const shouldTrack =
      state.gpsStatus === "requesting" || state.gpsStatus === "tracking";
    if (!shouldTrack) return;

    if (state.gpsStatus === "requesting") {
      lastPoint.current = null;
      lastAccuracy.current = null;
    }

    if (!("geolocation" in navigator)) {
      dispatch({
        type: "GPS_ERROR",
        status: "unavailable",
        message: "GPS tidak tersedia di browser ini.",
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? position.coords.accuracy
          : null;

        if (
          shouldAcceptUpdate(
            point,
            accuracy,
            lastPoint.current,
            lastAccuracy.current,
          )
        ) {
          lastPoint.current = point;
          lastAccuracy.current = accuracy;
          dispatch({ type: "GPS_POSITION", point, accuracy });
        }
      },
      (error) => {
        const mapped = geolocationMessage(error);
        dispatch({ type: "GPS_ERROR", ...mapped });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 12_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [state.gpsStatus, dispatch]);
}
