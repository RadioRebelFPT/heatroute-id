# Heat Exposure Score (HES) — Specification

## Tujuan

HES adalah skor 0–100 yang merepresentasikan tingkat paparan panas yang akan dialami pejalan kaki saat menempuh sebuah rute. **Lower HES = lebih nyaman & lebih teduh.**

## Formula

```
HES(route) = 100 × Σᵢ (wᵢ × component_iᵢ)
```

dengan komponen yang dinormalisasi ke `[0, 1]`:

| Komponen | Bobot (wᵢ) | Sumber data | Definisi |
|---|---|---|---|
| `temp_norm` | 0.25 | Open-Meteo (current temp) | `clamp((T − 24) / (38 − 24), 0, 1)` — baseline 24°C, peak 38°C |
| `humid_norm` | 0.10 | Open-Meteo (relative humidity) | `humidity / 100` |
| `uv_norm` | 0.15 | Open-Meteo (UV index) | `clamp(uv_index / 11, 0, 1)` |
| `shade_gap` | 0.30 | Pre-baked GeoJSON | `1 − shade_coverage` per segment, agregat sepanjang rute |
| `veg_gap` | 0.20 | Pre-baked GeoJSON | `1 − vegetation_density_norm`, agregat sepanjang rute |

**Total bobot = 1.00.**

## Komponen detail

### `shade_coverage` per segment
Estimasi proporsi panjang segment yang kemungkinan teduh, dari kombinasi:
- Pohon dalam buffer 5 m dari centerline (OSM tag `natural=tree`)
- Bangunan dalam buffer 5 m yang berpotensi membayangi (proxy: `building=*` adjacency)

Formula sederhana untuk MVP:
```
shade_coverage = clamp(
    0.7 × tree_density_norm + 0.3 × building_proximity_norm,
    0, 1
)
```

### `vegetation_density` per segment
Hitungan pohon (OSM `natural=tree`) per 100 m segment, dinormalisasi:
```
vegetation_density_norm = clamp(tree_count_per_100m / 8, 0, 1)
```
Threshold 8 pohon per 100m diasumsikan sebagai "padat" untuk konteks trotoar Jakarta — di-tune setelah melihat distribusi aktual.

### Agregasi rute
Untuk satu rute (hasil ORS) yang terdiri dari N segments:
```
route.shade_gap = Σᵢ (segment_lengthᵢ × (1 − shade_coverageᵢ)) / total_length
route.veg_gap = Σᵢ (segment_lengthᵢ × (1 − veg_densityᵢ)) / total_length
```
Yaitu **weighted average by segment length**.

## Pemilihan 3 rute

Input ke ORS: `alternative_routes={target_count: 3, share_factor: 0.5, weight_factor: 1.6}` → balikin maksimal 3 rute alternatif.

Setelah masing-masing rute di-score:

| Label | Definisi |
|---|---|
| **Fastest** | Rute dengan ETA terkecil (default ORS) |
| **Coolest** | Rute dengan HES terkecil di antara kandidat |
| **Balanced** | `argmin( 0.5 × time_norm + 0.5 × hes_norm )` — kompromi |

`time_norm` dan `hes_norm` di-normalisasi relatif ke kandidat (mis. min-max scale).

**Edge case:** kalau Fastest == Coolest (sama-sama best), tampilkan 2 label di rute itu dan generate Balanced lebih agresif. Kalau cuma 1 rute alternatif yang dikembalikan ORS, fallback: tampilkan 1 rute dengan label "Single Route" + breakdown HES.

## Tampilan UX

Skor disajikan dengan kategori warna untuk readability:

| Range HES | Label | Warna |
|---|---|---|
| 0–20 | Sejuk | 🟢 hijau |
| 20–40 | Cukup nyaman | 🟢 lime |
| 40–60 | Sedang | 🟡 kuning |
| 60–80 | Panas | 🟠 oranye |
| 80–100 | Sangat panas | 🔴 merah |

Plus breakdown 5 komponen sebagai progress bar mini → user paham *kenapa* HES-nya tinggi (mis. "UV tinggi + pohon minim").

## Catatan implementasi

1. **Bobot bersifat hipotesis awal** dan dapat di-tune setelah memvalidasi distribusi shade/veg pada coverage area aktual.
2. **Cuaca diambil hourly** (Open-Meteo `forecast`), bukan single snapshot. Saat user menggeser slider waktu keberangkatan, HES re-rank pakai temp/humid/UV pada jam tersebut — bukan satu nilai untuk seluruh sesi.
3. **Sun-altitude modulation** (sudah live): bobot shade dan vegetation di-skala oleh ketinggian matahari per timestamp keberangkatan via [SunCalc](https://github.com/mourner/suncalc). Saat malam (matahari di bawah horizon), kontribusi shade/veg kolaps — HES jatuh ke pure-climate. Saat matahari overhead, building-derived shade berkurang karena bayangan jatuh tegak lurus.
4. **Vegetation density** dibawa dari pre-baked GeoJSON yang sama (`veg_density_norm` per segment) dan masuk ke per-rute HES via `computeRouteMetrics` di `web/src/lib/hes.ts`.
5. **Future work**:
   - Crowdsourced reports (warga lapor "panas banget" / "teduh")
   - Coverage area expansion (saat ini Jakarta + Depok)
   - Auto-refresh shade data dari Overpass dengan caching layer
