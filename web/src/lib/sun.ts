import SunCalc from "suncalc";

// Anchor for sun position. Jakarta is small enough vs. solar geometry that a
// single anchor is fine for the whole Jabodetabek scope at MVP precision.
const JAKARTA_LAT = -6.2;
const JAKARTA_LNG = 106.85;

export function sunAltitudeRad(when: Date, lat = JAKARTA_LAT, lng = JAKARTA_LNG): number {
  const pos = SunCalc.getPosition(when, lat, lng);
  return pos.altitude;
}

export function altitudeDegrees(altitudeRad: number): number {
  return altitudeRad * (180 / Math.PI);
}

/** Building-shade time multiplier in [0, 1].
 *  1 = sun near horizon → long shadows, building proximity gives full shade
 *  0 = sun overhead   → no shadow, building proximity does not protect the road
 *  altitude ≤ 0 (night/twilight): treat as 0 — no direct sun, no shadow asymmetry
 *
 *  Curve: 1 − sin(altitude). Reaches 0 at zenith, 1 at horizon. Smooth between. */
export function buildingShadeTimeFactor(altitudeRad: number): number {
  if (altitudeRad <= 0) return 0;
  return Math.max(0, 1 - Math.sin(altitudeRad));
}

/** How much shade & vegetation should affect heat exposure at this sun altitude.
 *  No direct sun → shade is irrelevant (pedestrians don't pick "shaded route" at night).
 *  Below horizon: 0. Above ~30° altitude: full effect. Smooth ramp between.
 *  Curve: clamp(2 × sin(altitude), 0, 1). */
export function shadeSensitivityFactor(altitudeRad: number): number {
  if (altitudeRad <= 0) return 0;
  return Math.min(1, 2 * Math.sin(altitudeRad));
}
