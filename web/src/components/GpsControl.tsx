import { useAppState } from "../state/useAppState";

const STATUS_LABEL: Record<string, string> = {
  idle: "Aktifkan GPS",
  requesting: "Mencari lokasi",
  tracking: "Matikan GPS",
  denied: "Coba GPS lagi",
  unavailable: "Coba GPS lagi",
  error: "Coba GPS lagi",
};

export function GpsControl() {
  const { state, dispatch } = useAppState();
  const isActive =
    state.gpsStatus === "requesting" || state.gpsStatus === "tracking";

  const onClick = () => {
    dispatch({ type: isActive ? "GPS_STOP" : "GPS_START" });
  };

  return (
    <div className="pointer-events-none absolute right-3 top-[76px] z-[1000] flex items-end gap-2">
      {state.gpsError && (
        <div className="pointer-events-auto max-w-[180px] rounded-full bg-white/95 px-3 py-2 text-[11px] font-medium text-rose-600 shadow-md backdrop-blur">
          {state.gpsError}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`pointer-events-auto grid h-11 w-11 place-items-center rounded-full border shadow-md backdrop-blur transition active:scale-95 ${
          isActive
            ? "border-sky-500 bg-sky-500 text-white"
            : "border-slate-200 bg-white/95 text-slate-700"
        }`}
        aria-label={STATUS_LABEL[state.gpsStatus]}
        title={STATUS_LABEL[state.gpsStatus]}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${state.gpsStatus === "requesting" ? "animate-pulse" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </button>
    </div>
  );
}
