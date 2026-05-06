import { createContext, type Dispatch } from "react";
import type { AppAction, AppState } from "./types";

export type AppStateContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export const AppStateContext = createContext<AppStateContextValue | null>(null);
