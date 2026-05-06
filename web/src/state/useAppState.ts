import { useContext } from "react";
import { AppStateContext } from "./AppStateContext";

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppProvider");
  return ctx;
}
