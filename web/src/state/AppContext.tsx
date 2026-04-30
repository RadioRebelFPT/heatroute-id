import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import { appReducer, initialState, type AppAction, type AppState } from "./types";

type Ctx = { state: AppState; dispatch: Dispatch<AppAction> };

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used inside AppProvider");
  return ctx;
}
