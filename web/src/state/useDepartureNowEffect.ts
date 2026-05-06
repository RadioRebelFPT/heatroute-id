import { useEffect } from "react";
import { useAppState } from "./useAppState";

const TICK_MS = 60_000;

export function useDepartureNowEffect() {
  const { state, dispatch } = useAppState();

  useEffect(() => {
    if (state.departureMode !== "now") return;

    const id = window.setInterval(() => {
      dispatch({ type: "SET_DEPARTURE_TIME", time: new Date() });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [state.departureMode, dispatch]);
}
