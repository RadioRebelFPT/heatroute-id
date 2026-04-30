# Stage 2 Build Plan — HeatRouteID

> **Window:** 28 April – 4 Mei 2026 (7 hari) · Solo builder: Farrel · Pair: PM Aurelia (lihat `AURELIA_ONBOARDING.md`)
> **Submission:** Public GitHub repo + install docs (`.md`) + video demo. Bukan mockup — harus jalan beneran.
> **Driving constraints:** 1 builder, 1 test bed (Salemba), client-side only (tidak ada backend), close gaps dari `../../stage1_review_notes.md`.

---

## Definisi "Done" untuk Stage 2

MVP yang bisa di-demo end-to-end:
1. User input origin & destination (klik di map atau geocoder).
2. Sistem balikin **3 rute alternatif** dengan label **Fastest / Coolest / Balanced** + skor HES masing-masing.
3. Setiap rute punya **breakdown 5 komponen** HES yang bisa dilihat user (kenapa skornya tinggi/rendah).
4. Toggle **Shade Gap Map** menampilkan ruas jalan dengan defisit teduh (dual output: user + pemda).
5. **Cuaca live** dari Open-Meteo ditarik untuk titik origin.
6. Test bed: **Salemba area** (~1.5 km² di sekitar Kampus UI Salemba).
7. Deploy publik di Vercel + repo public di GitHub.
8. README lengkap + video demo 1 menit & 3 menit (Aurelia handle scripting).

## Stack final (kunci di H0)

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend framework | React 18 + Vite + TypeScript | Cepat scaffold, ekosistem map matang |
| Styling | Tailwind CSS | Cepat untuk UI iterasi |
| Map | Leaflet + react-leaflet | Open-source, basemap OSM, ringan |
| Routing | OpenRouteService Directions API (free tier) | Free + alternatif rute built-in |
| Cuaca | Open-Meteo (no auth) | Gratis, no API key |
| Shade data | Pre-baked GeoJSON dari Overpass (lihat `data_prep/`) | Hindari hit Overpass runtime (lambat/rate-limited) |
| State | React Context + `useReducer` | Cukup untuk scope segini, no Redux |
| Deploy | Vercel (static build) | Free, auto deploy on push |

---

## Day-by-day

### H0 — Hari ini (27 Apr, prep, di luar window)

Tujuan: lock semua risiko data + dependency sebelum window buka.

- [ ] Run `data_prep/overpass_salemba.py` → generate `data/salemba_shade_gap.geojson`
- [ ] Validasi bbox: cek ratio `n_features` (harapan: ≥150 ways) & distribusi `shade_gap` (harapan: spread, bukan semuanya 0.9+)
- [ ] Kalau hasil tipis → expand bbox atau pivot test bed ke Sudirman
- [ ] Tune awal bobot HES di `docs/HES_FORMULA.md` berdasar distribusi
- [ ] `npm create vite@latest heatroute-id-web -- --template react-ts` (di subfolder `web/`)
- [ ] Install: `leaflet react-leaflet @types/leaflet tailwindcss postcss autoprefixer`
- [ ] Tailwind init + Vite proxy untuk dev
- [ ] `.env.example` dengan `VITE_ORS_API_KEY=...` placeholder
- [ ] First commit ke GitHub (public repo `heatroute-id`)

**Risk gate:** kalau Overpass return <100 features atau distribusi flat, STOP dan re-scope sebelum H1.

### H1 — 28 Apr (window opens, Day 1)

Tujuan: map jalan + render shade gap layer.

- [ ] Map component: Leaflet basemap OSM, center di Salemba, zoom 16
- [ ] Load `salemba_shade_gap.geojson` sebagai LineString layer dengan color ramp by `shade_gap` (hijau→merah)
- [ ] Sidebar shell: dua slot "Dari" & "Ke" (kosong dulu, isi via click-to-set di H2)
- [ ] State management skeleton (Context + reducer)
- [ ] Deploy ke Vercel (preview build aktif)

**EOD demo:** map terbuka, ruas-ruas berwarna sesuai shade gap. Belum ada routing.

### H2 — 29 Apr (Day 2)

Tujuan: routing + 3-route comparison logic.

- [ ] **Click-to-set origin/destination** (LOCKED H0): klik pertama di map = origin (pin hijau), klik kedua = destination (pin merah), klik ketiga reset. Tidak ada text geocoding di MVP — Photon/Nominatim deferred ke Future Work.
- [ ] ORS Directions call dengan `alternative_routes={target_count: 3, share_factor: 0.5, weight_factor: 1.6}`
- [ ] Parse 3 rute, render polyline berbeda warna
- [ ] HES compute function: untuk tiap rute, intersect/segmen-match ke `shade_gap.geojson` → agregat weighted average
- [ ] Label assignment: Fastest (min duration), Coolest (min HES), Balanced (argmin 0.5×time_norm + 0.5×hes_norm)
- [ ] Pull cuaca Open-Meteo current weather di lat/lon origin

**EOD demo:** input 2 titik, dapat 3 rute dengan skor HES & label. Cuaca tampil di header.

### H3 — 30 Apr (Day 3)

Tujuan: full UX — breakdown, toggle shade gap, polish.

- [ ] Route detail panel: progress bar 5 komponen HES (temp, humid, UV, shade gap, veg gap)
- [ ] Color category badges per rute (Sejuk/Cukup nyaman/Panas/Sangat panas)
- [ ] Toggle button: tampilkan/sembunyikan layer Shade Gap Map (untuk angle pemda)
- [ ] Empty states: "Pilih titik awal dulu", error fallback ORS, loading spinner
- [ ] Klik rute di sidebar → highlight + zoom-to-fit di map
- [ ] **PM Aurelia mulai QA** dengan 5 skenario (lihat `AURELIA_ONBOARDING.md`)

**EOD demo:** end-to-end happy path bekerja, breakdown jelas, Shade Gap toggle works.

### H4 — 1 Mei (Day 4)

Tujuan: polish + dokumentasi + deploy final.

- [ ] Mobile responsive QA (Chrome DevTools mobile view, target ≥iPhone 12 width)
- [ ] Loading skeleton states, error toasts
- [ ] **README final**: install steps, env vars, HES formula link, "Local Wisdom Connection" section (Aurelia draft copy → Farrel embed), screenshot
- [ ] License (MIT), CONTRIBUTING.md singkat
- [ ] Deploy production di Vercel dengan custom domain (atau biarkan default `heatroute-id.vercel.app`)
- [ ] **Submit gap closures** vs `stage1_review_notes.md`:
  - HES formula konkret di `HES_FORMULA.md` ✓
  - Local Wisdom section di README ✓
  - Comparison table eksplisit (Google Maps / ShadeMap / HeatRouteID) di README

**EOD demo:** versi yang siap di-submit. Buffer mulai H5 untuk video & bug fix.

### H5 — 2 Mei (Day 5)

Tujuan: video production support + bug fix.

- [ ] Bantu Aurelia screen recording (set up nice demo seed: origin Halte TJ Salemba → Kampus UI, hasil 3 rute jelas berbeda)
- [ ] Tambahin tiny "Demo Mode" preset (3 origin/destination tersimpan) supaya video reproducible
- [ ] Bug fix dari QA Aurelia di H3-H4
- [ ] Capture screenshot statis untuk pitch deck Stage 3

**EOD:** video raw footage selesai, bug list zero.

### H6 — 3 Mei (Day 6)

Tujuan: code freeze + final QA.

- [ ] Code freeze 18:00 WIB. After this: only critical bug fixes.
- [ ] Tag release `v1.0-stage2`
- [ ] Cross-browser test (Chrome, Firefox, Safari iOS via TestFlight or BrowserStack free)
- [ ] Verify Vercel build production OK
- [ ] Bantu Aurelia final video edit review

**EOD:** repo & deploy sudah final, video sudah edited.

### H7 — 4 Mei (Day 7, submission)

Tujuan: submit & buffer.

- [ ] Final smoke test deploy (link, env, basic flow)
- [ ] Submit ke panitia: link repo public + link video + bukti pembayaran
- [ ] Capture submission timestamp
- [ ] Catat lessons learned di `STAGE2_RETRO.md` (untuk Stage 3 prep)

---

## Out-of-scope (tegas — jangan tergoda)

| Diluar scope | Alasan | Future-work mention |
|---|---|---|
| Solar geometry per jam (sun position × building height) | Butuh time + memory + library tambahan | Future work di README |
| Multi-city (Bandung, Surabaya, dll) | Salemba sudah cukup untuk demo | Future work di README |
| Auth / user accounts / saved routes | Bukan core value prop | Future work di README |
| Mobile native app (React Native / Flutter) | Web mobile-friendly cukup untuk MVP | Future work di pitch deck |
| Crowdsourced "panas/teduh" reports | Network effect lambat & risiko quality | Future work — slide pitch |
| Text-input geocoding (Photon/Nominatim) | Click-to-set cukup untuk demo seed; hindari API ke-3 | Future work di README |
| Time-of-day weighting (pagi/siang/sore) | Menambah kompleksitas tanpa demo value besar | Future work mention |
| Custom backend (Node/Python API) | Keep client-side. ORS, Open-Meteo, GeoJSON cukup | — |
| Database / persistence | Stateless app | — |
| Analytics, telemetry | Bukan judging criteria | — |

**Aturan main:** kalau ada ide baru muncul mid-build, masuk ke "Future Work" section di README, **jangan** dikerjakan.

---

## Risk register

| Risiko | Trigger | Mitigasi |
|---|---|---|
| Overpass return data tipis di Salemba | n_features < 100 di H0 run | Expand bbox 30%, atau pivot ke Sudirman (cek ulang H0) |
| ORS hit rate limit (free 2000/day) | Lebih dari ~200 dev requests/hari | Cache hasil routing di localStorage; throttle dev refresh |
| Open-Meteo down saat demo | API outage | Hardcode fallback weather untuk demo seed |
| HES distribusi flat (semua rute mirip) | Setelah H2 compute, range HES <10 poin | Re-tune bobot, perbesar weight `shade_gap` & `veg_gap` |
| Shade calc inaccurate (visual jelek) | QA Aurelia bilang "kelihatan random" | Smoothing visual: bin shade_gap ke 4 kategori warna saja |
| Deploy Vercel gagal di H4 | Build error di prod | Jangan lock baru di H4 sore — deploy preview tiap commit dari H1 |
| Solo builder sakit / blocker tech | Apa pun | Buffer di H5-H6 dirancang untuk absorb 1-2 hari slip |

---

## Daily ritual

- **09:00 WIB** sync 15 menit dengan Aurelia (per AURELIA_ONBOARDING.md)
- **EOD** push commit + update task list di plan ini (centang yang done)
- **Sore H4 onwards** deploy production setiap commit yang lulus smoke test

## Definisi success non-negotiable

Submitted package wajib berisi:
1. Public GitHub repo URL
2. README dengan install steps yang reproducible
3. Demo video (link YouTube/Drive, dua versi)
4. Bukti pembayaran Rp100k (di-handle di luar dev scope)

Kalau salah satu dari empat ini hilang di H7, Stage 2 dianggap fail. Semua aktivitas di plan ini diturunkan dari empat itu.
