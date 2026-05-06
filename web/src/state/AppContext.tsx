import { useReducer, type ReactNode } from "react";
import { AppStateContext } from "./AppStateContext";
import { appReducer, initialState } from "./types";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}
