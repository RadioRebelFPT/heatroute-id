import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAppState } from "../state/AppContext";
import { SHADE_LEGEND } from "../lib/shade";
import { LABEL_COLORS, LABEL_NAMES, primaryColor } from "../lib/routes";
import type { LabeledRoute } from "../state/types";

type SheetState = "closed" | "peek" | "expanded";

const SHEET_HEIGHT_CLASS: Record<SheetState, string> = {
  closed: "h-[64px]",
  peek: "h-[42dvh]",
  expanded: "h-[85dvh]",
};

const TAP_THRESHOLD_PX = 6;

export function Sidebar() {
  const { state, dispatch } = useAppState();
  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const [draggingHeight, setDraggingHeight] = useState<number | null>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const isDragging = draggingHeight !== null;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const aside = e.currentTarget.closest("aside");
    if (!aside) return;
    const rect = aside.getBoundingClientRect();
    startY.current = e.clientY;
    startHeight.current = rect.height;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingHeight(rect.height);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const delta = startY.current - e.clientY;
    const next = Math.max(
      50,
      Math.min(window.innerHeight * 0.95, startHeight.current + delta),
    );
    setDraggingHeight(next);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const totalDelta = Math.abs(startY.current - e.clientY);
    if (totalDelta < TAP_THRESHOLD_PX) {
      setSheetState((s) =>
        s === "closed" ? "peek" : s === "peek" ? "expanded" : "closed",
      );
    } else {
      const vh = window.innerHeight;
      const finalHeight = draggingHeight!;
      let target: SheetState;
      if (finalHeight < vh * 0.25) target = "closed";
      else if (finalHeight < vh * 0.65) target = "peek";
      else target = "expanded";
      setSheetState(target);
    }
    setDraggingHeight(null);
  };

  const heightStyle = isDragging ? { height: `${draggingHeight}px` } : undefined;
  const heightClass = isDragging ? "" : SHEET_HEIGHT_CLASS[sheetState];
  const transitionClass = isDragging
    ? ""
    : "transition-[height] duration-300 ease-out";
  const showContent = isDragging || sheetState !== "closed";

  return (
    <aside
      className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)] ${heightClass} ${transitionClass} md:inset-x-auto md:bottom-4 md:left-4 md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[360px] md:rounded-2xl md:shadow-xl`}
      style={heightStyle}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex w-full shrink-0 touch-none items-center justify-center py-4 active:bg-slate-50 md:hidden"
        aria-label="Geser atau ketuk untuk ubah panel"
      >
        <span className="h-1.5 w-12 rounded-full bg-slate-300" />
      </button>

      {showContent && (
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-2 md:pt-5"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <section className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Rute
            </h2>
            <div className="space-y-2">
              <PinSlot label="Dari" point={state.origin} placeholder="Tap peta untuk titik awal" />
              <PinSlot label="Ke" point={state.destination} placeholder="Tap peta untuk tujuan" />
            </div>
            {state.origin && state.destination && (
              <p className="mt-2 text-[11px] text-slate-400">
                Tap peta sekali lagi untuk reset.
              </p>
            )}
          </section>

          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Shade Gap Map
              </h2>
              <button
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_SHADE_GAP" })}
                className="h-9 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-700 active:bg-slate-100"
              >
                {state.showShadeGap ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            <ul className="space-y-1.5">
              {SHADE_LEGEND.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs text-slate-700">
                  <span
                    className="inline-block h-3 w-6 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.label}</span>
                  <span className="text-slate-400">{item.range}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Cuaca
            </h2>
            <WeatherDisplay />
          </section>

          <section className="pb-2">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Hasil rute
            </h2>
            <RouteResults />
          </section>
        </div>
      )}
    </aside>
  );
}

function WeatherDisplay() {
  const { state } = useAppState();
  if (!state.weather) {
    if (state.weatherStatus === "error") {
      return <p className="text-xs text-rose-600">{state.weatherError}</p>;
    }
    return <p className="text-xs text-slate-400">Memuat cuaca...</p>;
  }
  const w = state.weather;
  return (
    <div className="grid grid-cols-4 gap-2 text-[11px]">
      <Metric label="Suhu" value={`${Math.round(w.temperature)}°`} />
      <Metric label="Terasa" value={`${Math.round(w.apparentTemp)}°`} />
      <Metric label="Lembap" value={`${Math.round(w.humidity)}%`} />
      <Metric label="UV" value={w.uvIndex.toFixed(1)} />
    </div>
  );
}

function RouteResults() {
  const { state } = useAppState();

  if (state.routesStatus === "loading") {
    return <p className="text-xs text-slate-500">Mencari rute...</p>;
  }
  if (state.routesStatus === "error") {
    return <p className="text-xs text-rose-600">{state.routesError}</p>;
  }
  if (state.routes && state.routes.length > 0) {
    return (
      <ul className="space-y-2">
        {state.routes.map((r, i) => (
          <RouteRow key={i} route={r} />
        ))}
      </ul>
    );
  }
  if (!state.origin) {
    return (
      <p className="text-xs text-slate-400">
        Tap dua titik di peta untuk dapatkan 3 alternatif rute.
      </p>
    );
  }
  if (!state.destination) {
    return (
      <p className="text-xs text-slate-400">Tap titik tujuan untuk hitung rute.</p>
    );
  }
  return null;
}

function RouteRow({ route }: { route: LabeledRoute }) {
  const color = primaryColor(route);
  const minutes = Math.round(route.duration / 60);
  const km = (route.distance / 1000).toFixed(2);
  const hesPct = Math.round(route.hes * 100);
  return (
    <li className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-6 shrink-0 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <div className="flex flex-wrap gap-1">
          {route.isFastest && (
            <Chip color={LABEL_COLORS.fastest} label={LABEL_NAMES.fastest} />
          )}
          {route.isCoolest && (
            <Chip color={LABEL_COLORS.coolest} label={LABEL_NAMES.coolest} />
          )}
          {route.isBalanced && (
            <Chip color={LABEL_COLORS.balanced} label={LABEL_NAMES.balanced} />
          )}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Metric label="Durasi" value={`${minutes} mnt`} />
        <Metric label="Jarak" value={`${km} km`} />
        <Metric label="Panas" value={`${hesPct}%`} />
      </div>
    </li>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-xs font-medium text-slate-700">{value}</div>
    </div>
  );
}

function PinSlot({
  label,
  point,
  placeholder,
}: {
  label: string;
  point: { lat: number; lng: number } | null;
  placeholder: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xs text-slate-700">
        {point
          ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : <span className="text-slate-400">{placeholder}</span>}
      </div>
    </div>
  );
}
