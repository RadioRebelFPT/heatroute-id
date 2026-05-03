import { useAppState } from "../state/AppContext";
import { altitudeDegrees, sunAltitudeRad } from "../lib/sun";

const MIN_HOUR = 6;
const MAX_HOUR = 20;
const STEP_HOUR = 0.5;

function hourFloatOf(t: Date): number {
  return t.getHours() + t.getMinutes() / 60;
}

function setHourOnDate(t: Date, hourFloat: number): Date {
  const next = new Date(t);
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  next.setHours(h, m, 0, 0);
  return next;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHour(hourFloat: number): string {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  return `${pad(h)}:${pad(m)}`;
}

export function TimeSlider() {
  const { state, dispatch } = useAppState();
  const t = state.departureTime;
  const hf = hourFloatOf(t);
  const altRad = sunAltitudeRad(t);
  const altDeg = altitudeDegrees(altRad);

  const handleChange = (next: number) => {
    dispatch({ type: "SET_DEPARTURE_TIME", time: setHourOnDate(t, next) });
  };

  const handleNow = () => {
    dispatch({ type: "SET_DEPARTURE_TIME", time: new Date() });
  };

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Jam Berangkat
        </h2>
        <button
          type="button"
          onClick={handleNow}
          className="h-9 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-700 active:bg-slate-100"
        >
          Sekarang
        </button>
      </div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {formatHour(hf)}
        </span>
        <span className="text-[11px] text-slate-500">
          {altDeg > 0
            ? `Matahari ${altDeg.toFixed(0)}° atas horizon`
            : "Matahari di bawah horizon"}
        </span>
      </div>
      <input
        type="range"
        min={MIN_HOUR}
        max={MAX_HOUR}
        step={STEP_HOUR}
        value={hf}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-full accent-slate-700"
        aria-label="Jam berangkat"
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>06:00</span>
        <span>13:00</span>
        <span>20:00</span>
      </div>
    </section>
  );
}
