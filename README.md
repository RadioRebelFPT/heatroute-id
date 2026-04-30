# HeatRouteID

Heat-aware pedestrian navigation untuk kota tropis Indonesia.

> **IYREF 2026 Hackathon** · Sub-tema: Climate Resilience & Local Wisdom · Tim **Lontong Sayur** (Universitas Indonesia)

---

## Status

🚧 Stage 2 build window: **28 April – 4 Mei 2026** (final submit). Repo dalam pengembangan aktif.

## Konsep

Navigasi pejalan kaki yang membandingkan tiga pilihan rute berdasarkan **Heat Exposure Score (HES)**:

- 🏃 **Fastest Route** — rute tercepat klasik (ETA-optimized)
- 🌳 **Coolest Route** — rute paling teduh (HES-optimized)
- ⚖️ **Balanced Route** — kompromi waktu × paparan panas

Secondary output: **Shade Gap Map** yang menandai ruas jalan dengan defisit teduh — input awal untuk perencanaan penghijauan kota oleh pemda.

## Local Wisdom Connection

Orang Indonesia secara intuitif "nyari teduhan" saat jalan kaki — di emperan toko, di bawah pohon trembesi, di gang sempit yang gelap. HeatRouteID mendigitalkan kebiasaan kolektif tropis ini, sekaligus mendukung kearifan lokal menanam pohon di trotoar yang selama ini jadi praktik komunitas warga.

## Stack (planned)

- **Frontend:** React + Vite + TypeScript + Leaflet + Tailwind
- **Maps & Routing:** OpenStreetMap (basemap & data), OpenRouteService (routing)
- **Cuaca:** Open-Meteo (suhu, kelembapan, UV)
- **Shade data:** Pre-baked GeoJSON dari Overpass API (lihat `data_prep/`)
- **Deploy:** Vercel (static)

## Repo structure

```
heatroute-id/
├── README.md
├── docs/
│   ├── HES_FORMULA.md          # spesifikasi Heat Exposure Score
│   └── AURELIA_ONBOARDING.md   # panduan PM (Aurelia)
├── data_prep/
│   ├── overpass_salemba.py     # query OSM data + bake static GeoJSON
│   └── requirements.txt
├── data/
│   └── salemba_shade_gap.geojson  # output pre-baked (di-generate H1)
└── (frontend project — di-init H1)
```

## Test bed (MVP)

**Salemba area** — radius ~1.5 km dari Kampus UI Salemba. Cocok untuk persona "mahasiswa commuter": padat aktivitas, banyak transit (TJ, KRL Cikini), dan punya variasi tutupan pohon yang jelas.

## Cara menjalankan (akan diisi setelah H4)

```bash
# placeholder — final instructions akan ditulis di H4 (1 May)
```

## Tim

- **Farrel Pradipa Tjandra** — solo builder (FE, BE, data, deploy)
- **Aurelia Zafinta Riza** — Product Manager (narrative, video, deck, QA, scope guardian)

## Lisensi

MIT (sementara — final license menyusul).
