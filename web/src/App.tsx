import { AppProvider, useAppState } from "./state/AppContext";
import { useRoutesEffect } from "./state/useRoutesEffect";
import { useWeatherEffect } from "./state/useWeatherEffect";
import { weatherAt } from "./lib/weather";
import { MapView } from "./components/MapView";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  return (
    <AppProvider>
      <Effects />
      <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100">
        <div className="absolute inset-0">
          <MapView />
        </div>
        <TopBar />
        <Sidebar />
      </div>
    </AppProvider>
  );
}

function Effects() {
  useRoutesEffect();
  useWeatherEffect();
  return null;
}

function TopBar() {
  const { state } = useAppState();
  const w = weatherAt(state.weather, state.departureTime);
  const subtitle = w
    ? `${Math.round(w.temperature)}°C · ${Math.round(w.humidity)}% · UV ${w.uvIndex.toFixed(1)}`
    : "Jakarta + Depok";

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-end p-3"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-auto rounded-full bg-white/95 px-4 py-2 shadow-md backdrop-blur">
        <h1 className="text-sm font-semibold text-slate-900">HeatRouteID</h1>
        <p className="text-[10px] leading-tight text-slate-500">{subtitle}</p>
      </div>
    </header>
  );
}
