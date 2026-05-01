# HeatRouteID

Heat-aware pedestrian navigation untuk kota tropis Indonesia.

> **IYREF 2026 Hackathon** · Sub-tema: Climate Resilience & Local Wisdom · Tim **Lontong Sayur** (Universitas Indonesia)

---

## Status

🚧 Stage 2 build window: **28 April – 4 Mei 2026** (final submit). Repo dalam pengembangan aktif.

![HeatRouteID — 3 rute dengan HES badge dan per-route breakdown bar](docs/screenshot.png)

## Konsep

Navigasi pejalan kaki yang membandingkan tiga pilihan rute berdasarkan **Heat Exposure Score (HES)**:

- 🏃 **Fastest Route** — rute tercepat klasik (ETA-optimized)
- 🌳 **Coolest Route** — rute paling teduh (HES-optimized)
- ⚖️ **Balanced Route** — kompromi waktu × paparan panas

Secondary output: **Shade Gap Map** yang menandai ruas jalan dengan defisit teduh — input awal untuk perencanaan penghijauan kota oleh pemda.

## Local Wisdom Connection

Orang Indonesia secara intuitif "nyari teduhan" saat jalan kaki — di emperan toko, di bawah pohon trembesi, di gang sempit yang gelap. HeatRouteID mendigitalkan kebiasaan kolektif tropis ini, sekaligus mendukung kearifan lokal menanam pohon di trotoar yang selama ini jadi praktik komunitas warga.

## Comparison vs Google Maps & ShadeMap

| Feature | Google Maps | ShadeMap | **HeatRouteID** |
|---|:---:|:---:|:---:|
| Pedestrian routing | ✅ | ❌ | ✅ |
| Multi-route comparison | ❌ (1 default) | ❌ | ✅ (3 rute) |
| Heat Exposure Score per rute | ❌ | partial (shadow only) | ✅ (suhu + lembap + UV + shade) |
| Shade-gap map untuk perencanaan kota | ❌ | ❌ (visualisasi shadow real-time) | ✅ |
| Tropical-Indonesia tuning | ❌ (general) | ❌ (NYC/SF first) | ✅ |
| Mobile-first PWA | partial | ❌ | ✅ |
| Free + open source | ❌ | partial | ✅ (MIT) |

ShadeMap unggul dalam **akurasi shadow real-time** (sun-position + LiDAR building height). HeatRouteID complementary: bukan visualisasi bayangan saat ini, tapi **rekomendasi rute berdasarkan paparan panas total** + identifikasi gap teduh sebagai input perencanaan penghijauan.

## Known limitations & future work

Stage 2 MVP punya beberapa keterbatasan yang transparan:

- **OSM pedestrian coverage di Jakarta belum lengkap.** Banyak trotoar dan gang sempit belum di-tag `highway=footway` atau `foot=yes`. Route-engine (OpenRouteService) hanya bisa pakai data yang tersedia, jadi kadang menghasilkan detour memutari area yang sebenarnya bisa dilewati.
- **Area `access=private` di-skip otomatis.** Misalnya interior kampus UI Salemba — ORS pedestrian profile menghindari semua way bertanda `access=private` walaupun pejalan kaki umum sebenarnya boleh lewat. Ini menyebabkan rute kadang memutar lewat jalan utama.
- **Single routing candidate untuk jarak pendek.** Untuk pasangan titik di bawah ~500m, ORS sering hanya mengembalikan 1 alternatif — sehingga 3-route comparison (Tercepat/Tersejuk/Seimbang) collapse jadi 1 row dengan stacked labels.
- **Shade GeoJSON pre-baked, statis.** Data teduh saat ini di-bake sekali dari Overpass API (lihat `data_prep/`). Pohon tumbang, konstruksi baru, atau pohon baru ditanam tidak ter-refresh otomatis — perlu manual rebuild.

### Roadmap (post-Stage 2)

- **Toggle "include private access"** + warning badge bila rute melewati way `access=private` — opt-in untuk pejalan kaki yang punya akses (mis. mahasiswa UI di kampus sendiri)
- **Expand coverage** dari Salemba ke Monas–Sudirman corridor (re-bake Overpass bbox) untuk multi-neighborhood comparison
- **Auto-refresh shade data** dari Overpass dengan caching layer (cron rebuild mingguan)
- **Mapillary integration** untuk inferensi sidewalk yang belum di-tag di OSM
- **Self-hosted Valhalla atau OSRM** dengan custom profile yang lebih fleksibel daripada ORS public API

## Stack

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

## Cara menjalankan

```bash
git clone https://github.com/RadioRebelFPT/heatroute-id.git
cd heatroute-id/web
npm install
cp .env.example .env.local
# edit .env.local, paste your VITE_ORS_API_KEY
npm run dev
```

Buka `http://localhost:5173`. Drop dua pin di area Salemba untuk melihat 3 rute + HES per rute.

API key: gratis di [openrouteservice.org](https://openrouteservice.org/dev/#/signup) (2,000 request/day di tier gratis — cukup untuk dev + demo).

Detail formula HES: lihat [`docs/HES_FORMULA.md`](docs/HES_FORMULA.md).

## Deploy

**Production:** [heatroute-id.vercel.app](https://heatroute-id.vercel.app/)

### Deploy fork sendiri

1. Fork repo ini
2. Import ke [vercel.com/new](https://vercel.com/new) → pilih fork-mu
3. **Root Directory** = `web` di "Configure Project"
4. Add Environment Variable: `VITE_ORS_API_KEY` (Production scope)
5. Click Deploy

Vercel auto-detect Vite preset. Build ~60 detik. Lihat [`web/vercel.json`](web/vercel.json) untuk SPA rewrite + framework config.

## Tim

- **Farrel Pradipa Tjandra** — solo builder (FE, BE, data, deploy)
- **Aurelia Zafinta Riza** — Product Manager (narrative, video, deck, QA, scope guardian)

## Credits

- **OpenStreetMap contributors** — basemap & pedestrian data ([ODbL](https://www.openstreetmap.org/copyright))
- **OpenRouteService** — Directions API (routing engine)
- **Open-Meteo** — cuaca real-time (suhu, kelembapan, UV)
- **Overpass API** — query OSM untuk pre-baked shade GeoJSON

Kontribusi welcome — lihat [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
