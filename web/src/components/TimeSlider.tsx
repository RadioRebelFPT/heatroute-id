import { useEffect, useRef, useState } from "react";
import { useAppState } from "../state/useAppState";
import { altitudeDegrees, sunAltitudeRad } from "../lib/sun";

type Mode = "now" | "today" | "tomorrow";

const MODE_LABEL: Record<Mode, string> = {
  now: "Sekarang",
  today: "Set waktu",
  tomorrow: "Besok",
};

const MODE_HINT: Record<Mode, string> = {
  now: "Pakai waktu saat ini",
  today: "Pilih jam hari ini",
  tomorrow: "Pilih jam besok",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toTimeInputValue(t: Date): string {
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

function applyTimeInput(base: Date, value: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const next = new Date(base);
  next.setHours(h, min, 0, 0);
  return next;
}

export function TimeSlider() {
  const { state, dispatch } = useAppState();
  const t = state.departureTime;
  const altRad = sunAltitudeRad(t);
  const altDeg = altitudeDegrees(altRad);
  const mode: Mode = state.departureMode;
  const showPicker = mode !== "now";

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Local draft so the user can type partial input (e.g. "14") without the
  // controlled value snapping back on each keystroke. Synced from `t` when
  // the external time changes (mode switch, "now" tick, etc.) using React's
  // "adjusting state during render" pattern so we don't trigger a cascade.
  const [draft, setDraft] = useState(toTimeInputValue(t));
  const [lastT, setLastT] = useState(t);
  if (t !== lastT) {
    setLastT(t);
    setDraft(toTimeInputValue(t));
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickMode = (next: Mode) => {
    dispatch({ type: "SET_DEPARTURE_MODE", mode: next });
    setOpen(false);
  };

  const commitDraft = (raw: string) => {
    // Allow "1430" → "14:30" so users don't have to type the colon.
    const normalized =
      /^\d{4}$/.test(raw) ? `${raw.slice(0, 2)}:${raw.slice(2)}` : raw;
    const next = applyTimeInput(t, normalized);
    if (next) {
      dispatch({ type: "SET_DEPARTURE_TIME", time: next });
      setDraft(toTimeInputValue(next));
    } else {
      setDraft(toTimeInputValue(t));
    }
  };

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Jam Berangkat
        </h2>
        <div ref={wrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm active:bg-slate-100"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span>{MODE_LABEL[mode]}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {open && (
            <ul
              role="listbox"
              className="absolute right-0 top-[calc(100%+6px)] z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => {
                const selected = m === mode;
                return (
                  <li key={m} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => pickMode(m)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${
                        selected
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex flex-col">
                        <span className="font-semibold">{MODE_LABEL[m]}</span>
                        <span className="text-[10px] text-slate-500">
                          {MODE_HINT[m]}
                        </span>
                      </span>
                      {selected && (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="h-4 w-4 text-sky-600"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        >
                          <path d="M5 10l3 3 7-7" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        {showPicker ? (
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{2}:\d{2}"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            maxLength={5}
            className="heatroute-time-input w-[6ch] rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-2xl font-semibold tabular-nums text-slate-900 focus:border-slate-500 focus:outline-none"
            aria-label="Jam berangkat (24 jam, format HH:MM)"
          />
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-right text-[11px] text-slate-500">
          {altDeg > 0
            ? `Matahari ${altDeg.toFixed(0)}° atas horizon`
            : "Matahari di bawah horizon"}
        </span>
      </div>
    </section>
  );
}
