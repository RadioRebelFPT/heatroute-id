# Contributing to HeatRouteID

Terima kasih sudah tertarik berkontribusi! Repo ini dikembangkan dalam scope IYREF 2026 Hackathon, tetapi PR dari luar tim juga welcome.

## Prerequisites

- Node.js 18+ (cek `node --version`)
- npm (sudah bundled dengan Node)
- API key gratis dari [openrouteservice.org](https://openrouteservice.org/dev/#/signup)

## Local development setup

```bash
git clone https://github.com/RadioRebelFPT/heatroute-id.git
cd heatroute-id/web
npm install
cp .env.example .env.local
# edit .env.local, paste your VITE_ORS_API_KEY
npm run dev
```

App akan jalan di `http://localhost:5173` (Vite default).

## Branch naming

- `feat/<short-name>` — fitur baru
- `fix/<short-name>` — bug fix
- `docs/<short-name>` — dokumentasi atau README
- `refactor/<short-name>` — refactor tanpa perubahan behavior

## Pull request checklist

Sebelum buka PR, pastikan:

- [ ] `npm run build` di `web/` exit 0 (TypeScript + Vite build)
- [ ] `npm run lint` tidak menambah error baru
- [ ] Tested di mobile browser (Chrome iPhone view atau real device) — app ini mobile-first
- [ ] PR description menjelaskan **what** dan **why** (bukan hanya **what**)
- [ ] Reference issue terkait (jika ada)

## Scope guardian

Untuk perubahan besar (arsitektur, dependency baru, perubahan HES formula), buka issue dulu untuk diskusi sebelum coding. Untuk perubahan UI/copy/bug fix kecil, langsung PR aja.

## Code of conduct

Perlakukan kontributor lain dengan respect. Diskusi technical, bukan personal.
