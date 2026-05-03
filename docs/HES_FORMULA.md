# Heat Exposure Score (HES) — Specification

> **Status:** Draft v0.1 (28 April 2026 plan). Final value akan di-tune di H2 (29 April) berdasarkan distribusi data di test bed Salemba.

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
Threshold 8 pohon per 100m diasumsikan sebagai "padat" untuk konteks trotoar Jakarta — di-tune saat melihat distribusi aktual H1.

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

1. **Bobot di-tune di H2** setelah lihat distribusi shade/veg di Salemba. Default di atas adalah hipotesis awal.
2. **Suhu, kelembapan, UV dipanggil sekali per session** (current weather di lokasi awal) — sama untuk ke-3 rute alternatif. Yang membedakan HES antar rute hanyalah `shade_gap` dan `veg_gap`.
3. **Future work** (di-mention di README + pitch deck, tidak masuk MVP):
   - Solar geometry per jam keberangkatan (sun position × building height)
   - Crowdsourced reports (warga lapor "panas banget" / "teduh")
   - Time-of-day weighted (pagi vs siang vs sore)

## Stage 2 implementation note (H3, 30 April 2026)

Implementasi Stage 2 menampilkan **empat komponen** pada per-route breakdown bar di sidebar: temperature, humidity, UV index, dan shade gap. Komponen kelima — **vegetation density** — masih bagian dari spesifikasi Stage 1 di atas, tetapi sumber datanya belum terintegrasi (belum ada vegetation polygon layer di GeoJSON yang dipakai `lib/hes.ts`). Komponen ini akan ditambahkan kembali begitu sumber data vegetasi tersedia (post-submission). Untuk Stage 2, perhitungan HES per rute hanya menggunakan `shade_gap` (lihat `computeRouteHes` di `web/src/lib/hes.ts`); cuaca (temp/humid/UV) ditampilkan sebagai konteks global yang sama untuk ketiga rute alternatif.
