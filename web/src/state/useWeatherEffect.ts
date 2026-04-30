import { useEffect } from "react";
import { useAppState } from "./AppContext";
import { fetchWeather } from "../lib/weather";

const SALEMBA_LAT = -6.195;
const SALEMBA_LNG = 106.845;

export function useWeatherEffect() {
  const { state, dispatch } = useAppState();
  const lat = state.origin?.lat ?? SALEMBA_LAT;
  const lng = state.origin?.lng ?? SALEMBA_LNG;

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "WEATHER_LOADING" });
    fetchWeather(lat, lng)
      .then((w) => {
        if (cancelled) return;
        dispatch({ type: "WEATHER_SUCCESS", weather: w });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        dispatch({ type: "WEATHER_ERROR", message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, dispatch]);
}
