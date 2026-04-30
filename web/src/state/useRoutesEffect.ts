import { useEffect } from "react";
import { useAppState } from "./AppContext";
import { fetchRoutes, OrsError } from "../lib/ors";
import { loadShadeData } from "../lib/shadeData";
import { computeAndLabel } from "../lib/hes";

const ORS_API_KEY = (import.meta.env.VITE_ORS_API_KEY as string | undefined) ?? "";

export function useRoutesEffect() {
  const { state, dispatch } = useAppState();

  useEffect(() => {
    if (!state.origin || !state.destination) return;

    let cancelled = false;
    dispatch({ type: "ROUTES_LOADING" });

    Promise.all([
      fetchRoutes(state.origin, state.destination, ORS_API_KEY),
      loadShadeData(),
    ])
      .then(([routes, shade]) => {
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
