import type { LineString } from "geojson";
import type { WeatherHourly } from "../lib/weather";
import type { HesCategory } from "../lib/hes";

export type LatLng = { lat: number; lng: number };
export type GpsStatus =
  | "idle"
  | "requesting"
  | "tracking"
  | "denied"
  | "unavailable"
  | "error";

export type RouteSummary = {
  geometry: LineString;
  duration: number;
  distance: number;
};

export type LabeledRoute = RouteSummary & {
  hes: number;
  hesCategory: HesCategory;
  isFastest: boolean;
  isCoolest: boolean;
  isBalanced: boolean;
};

export type RoutesStatus = "idle" | "loading" | "error";
export type WeatherStatus = "idle" | "loading" | "success" | "error";

export type AppState = {
  origin: LatLng | null;
  destination: LatLng | null;
  showShadeGap: boolean;
  gpsPosition: LatLng | null;
  gpsAccuracy: number | null;
  gpsStatus: GpsStatus;
  gpsError: string | null;
  routes: LabeledRoute[] | null;
  routesStatus: RoutesStatus;
  routesError: string | null;
  selectedRouteIndex: number | null;
  weather: WeatherHourly | null;
  weatherStatus: WeatherStatus;
  weatherError: string | null;
  departureTime: Date;
  departureMode: "now" | "today" | "tomorrow";
};

export type AppAction =
  | { type: "SET_ORIGIN"; point: LatLng | null }
  | { type: "SET_DESTINATION"; point: LatLng | null }
  | { type: "RESET_PINS" }
  | { type: "TOGGLE_SHADE_GAP" }
  | { type: "GPS_START" }
  | { type: "GPS_STOP" }
  | { type: "GPS_POSITION"; point: LatLng; accuracy: number | null }
  | {
      type: "GPS_ERROR";
      status: Exclude<
        GpsStatus,
        "idle" | "requesting" | "tracking"
      >;
      message: string;
    }
  | { type: "ROUTES_LOADING" }
  | { type: "ROUTES_SUCCESS"; routes: LabeledRoute[] }
  | { type: "ROUTES_ERROR"; message: string }
  | { type: "SELECT_ROUTE"; index: number | null }
  | { type: "WEATHER_LOADING" }
  | { type: "WEATHER_SUCCESS"; weather: WeatherHourly }
  | { type: "WEATHER_ERROR"; message: string }
  | { type: "SET_DEPARTURE_TIME"; time: Date }
  | { type: "SET_DEPARTURE_MODE"; mode: "now" | "today" | "tomorrow" };

export const initialState: AppState = {
  origin: null,
  destination: null,
  showShadeGap: true,
  gpsPosition: null,
  gpsAccuracy: null,
  gpsStatus: "idle",
  gpsError: null,
  routes: null,
  routesStatus: "idle",
  routesError: null,
  selectedRouteIndex: null,
  weather: null,
  weatherStatus: "idle",
  weatherError: null,
  departureTime: new Date(),
  departureMode: "now",
};

const cleared = {
  routes: null,
  routesStatus: "idle" as const,
  routesError: null,
  selectedRouteIndex: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_ORIGIN":
      return { ...state, origin: action.point, ...cleared };
    case "SET_DESTINATION":
      return { ...state, destination: action.point, ...cleared };
    case "RESET_PINS":
      return { ...state, origin: null, destination: null, ...cleared };
    case "TOGGLE_SHADE_GAP":
      return { ...state, showShadeGap: !state.showShadeGap };
    case "GPS_START":
      return { ...state, gpsStatus: "requesting", gpsError: null };
    case "GPS_STOP":
      return {
        ...state,
        gpsPosition: null,
        gpsAccuracy: null,
        gpsStatus: "idle",
        gpsError: null,
      };
    case "GPS_POSITION":
      return {
        ...state,
        gpsPosition: action.point,
        gpsAccuracy: action.accuracy,
        gpsStatus: "tracking",
        gpsError: null,
      };
    case "GPS_ERROR":
      return {
        ...state,
        gpsPosition: null,
        gpsAccuracy: null,
        gpsStatus: action.status,
        gpsError: action.message,
      };
    case "ROUTES_LOADING":
      return { ...state, routesStatus: "loading", routesError: null };
    case "ROUTES_SUCCESS":
      return {
        ...state,
        routes: action.routes,
        routesStatus: "idle",
        routesError: null,
        selectedRouteIndex: null,
      };
    case "ROUTES_ERROR":
      return {
        ...state,
        routesStatus: "error",
        routesError: action.message,
        routes: null,
        selectedRouteIndex: null,
      };
    case "SELECT_ROUTE":
      return { ...state, selectedRouteIndex: action.index };
    case "WEATHER_LOADING":
      return { ...state, weatherStatus: "loading", weatherError: null };
    case "WEATHER_SUCCESS":
      return {
        ...state,
        weather: action.weather,
        weatherStatus: "success",
        weatherError: null,
      };
    case "WEATHER_ERROR":
      return {
        ...state,
        weatherStatus: "error",
        weatherError: action.message,
      };
    case "SET_DEPARTURE_TIME":
      return { ...state, departureTime: action.time };
    case "SET_DEPARTURE_MODE": {
      if (action.mode === "now") {
        return {
          ...state,
          departureMode: "now",
          departureTime: new Date(),
        };
      }
      const base = new Date();
      if (action.mode === "tomorrow") base.setDate(base.getDate() + 1);
      base.setHours(
        state.departureTime.getHours(),
        state.departureTime.getMinutes(),
        0,
        0,
      );
      return { ...state, departureMode: action.mode, departureTime: base };
    }
  }
}
