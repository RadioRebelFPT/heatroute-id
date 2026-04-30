# Onboarding PM — Aurelia Zafinta Riza

Halo Lia! Ini panduan singkat peran Product Manager (PM) untuk Stage 2 & Stage 3 IYREF Hackathon. Roadmap sudah dijadwalkan supaya kerjamu paralel dengan Farrel yang ngoding solo.

## TL;DR peranmu

- **Bukan ngoding.** Kamu jadi *scope guardian*, *narrative lead*, *demo producer*, dan *deck owner*.
- **Output utamamu:** demo script video, voice-over narration BI, README copywriting, pitch deck Stage 3, QA testing.
- **Senjata utamamu:** sudut **Local Wisdom** yang sengaja kita angkat — kebiasaan orang Indonesia "nyari teduhan" jadi narasi pemersatu.

## Timeline tugas

### Stage 2 build window (28 April – 4 Mei)

| Tanggal | Tugas | Deliverable |
|---|---|---|
| **28 Apr (H1)** | Drafting demo storyboard + persona walkthrough | `docs/DEMO_STORYBOARD.md` (template di bawah) |
| **29 Apr (H2)** | Tulis narration BI (1 menit + 3 menit version) | `docs/VIDEO_SCRIPT.md` |
| **30 Apr (H3)** | QA testing FE — coba tap 5 pasang origin-destination, kasih feedback UX | issue list |
| **1 Mei (H4)** | Review README final + Local Wisdom section + screenshot caption | README sign-off |
| **2 Mei (H5)** | Voice-over recording + B-roll planning di Salemba | audio file `narration_final.wav` + shot list |
| **3 Mei (H6)** | Review video edit Farrel + final approval | sign-off |
| **4 Mei (H7)** | Submit window — kamu QA submission package | sign-off |

### Stage 3 (HackDay 15–16 Mei)

| Tanggal | Tugas | Deliverable |
|---|---|---|
| **5–11 Mei** | Pitch deck v1 (mengacu SCQA + STP + 3P Impact dari proposal) | deck draft |
| **12 Mei** | Technical Meeting — catat semua arahan juri/panitia | meeting notes |
| **13–14 Mei** | Pitch deck final + rehearsal narrasi | deck v.final |
| **15 Mei** | HackDay onsite ITB (improvement based on juri feedback) | revised deck/system |
| **16 Mei** | Submit pitch deck + Final Pitching | DONE |

## Demo Storyboard template (H1)

Bikin file `docs/DEMO_STORYBOARD.md` dengan struktur:

```markdown
# Video Demo HeatRouteID — Storyboard

## Durasi target: 3 menit (long), 1 menit (short cut untuk IG/TikTok)

## Persona pembuka
- Nama: [contoh: Rara, mahasiswa UI semester 4]
- Aktivitas: jalan dari Halte TJ Salemba ke Kampus UI Salemba (~700m)
- Pain: setiap siang kepanasan, baju basah, sampai kelas udah lelah

## Babak 1 — Hook (0:00–0:20)
- Visual: B-roll Rara jalan di siang bolong, keringetan
- Narasi: "Setiap hari, jutaan orang Indonesia jalan kaki di tengah kota tropis yang makin panas..."

## Babak 2 — Problem (0:20–0:50)
- Visual: layar HP buka Google Maps → cuma kasih rute tercepat yang lewat jalan terbuka
- Narasi: data BMKG +0,4°C, 36 juta penumpang transit Jakarta, dst.

## Babak 3 — Solution (0:50–2:00)
- Screen recording HeatRouteID:
  - Input start + tujuan
  - Tampil 3 rute (Fastest/Coolest/Balanced) dengan HES warna-warna
  - Klik Coolest → highlight rute lewat pohon
  - Toggle Shade Gap Map → tunjuk ruas merah-merah (defisit teduh)
- Narasi: cara kerja, HES formula simplified, Local Wisdom angle

## Babak 4 — Impact + CTA (2:00–3:00)
- Visual: 3P Impact (People, Planet, Place) animation
- Narasi: dampak jangka panjang, ajakan kolaborasi pemda
```

## Video Script template (H2)

Bikin file `docs/VIDEO_SCRIPT.md` dengan dua versi narasi:

### Versi 3 menit (full demo)
- Tone: hangat, percaya diri, sedikit naratif/storytelling
- Hindari jargon teknis berlebihan — sebut "Heat Exposure Score" sekali, lalu pakai "skor panas" / "skor teduh" untuk repetisi
- Selipkan local wisdom: "Sebenarnya kita semua udah punya insting nyari teduhan — HeatRouteID cuma bantu mendigitalkan kebiasaan tropis itu"

### Versi 1 menit (cut pendek)
- Hook keras 5 detik pertama
- Demo cepat
- Tagline penutup: "HeatRouteID — biar jalan kaki tetap nyaman walau bumi makin panas."

## README copy yang harus kamu tulis (H4)

Section di README yang aku titip ke kamu:

1. **"Mengapa HeatRouteID"** — 2-3 paragraf storytelling, pakai persona
2. **"Local Wisdom Connection"** — 1 paragraf eksplisit hubungkan ke kebiasaan tropis Indonesia. Wajib disebut: pohon trembesi/asem di trotoar, emperan toko, gang teduh, budaya "sore-sore" jalan kaki menghindari panas
3. **"Untuk siapa"** — refresh persona dari proposal Stage 1 (mahasiswa, pekerja, lansia, pengguna transit)
4. **"Apa selanjutnya"** — roadmap visioner (5 bullet points)

Style: bahasa Indonesia mengalir, hindari ke-corporate-an. Boleh sedikit pakai "kita" untuk inclusive feel.

## QA Checklist (H3)

Coba 5 skenario ini di laptop, catat issue di Notion / Google Doc:

- [ ] Skenario 1: Kampus UI Salemba → Halte TJ Galur. Apakah 3 rute muncul? HES masuk akal?
- [ ] Skenario 2: RS Cipto → Stasiun Cikini. Apakah Coolest beneda dari Fastest?
- [ ] Skenario 3: Klik Shade Gap toggle — visualisasi clear nggak?
- [ ] Skenario 4: Coba zoom in/out — UI break atau lancar?
- [ ] Skenario 5: Coba di mobile browser (Chrome HP) — usable atau cuma desktop?

Format issue: **[Severity] [Halaman] - deskripsi - expected behavior**.

## Pitch Deck Stage 3 — outline (mulai 5 Mei)

Reuse framework yang udah work di proposal Stage 1:

1. **Cover** — HeatRouteID, tim, tagline
2. **Hook** — SCQA dari proposal (kota tropis makin panas)
3. **Problem** — data BMKG, BPS, persona pain
4. **Solution overview** — 3-route compare + Shade Gap Map
5. **Demo screencast** — 30 detik
6. **HES formula** — visualisasi sederhana
7. **Local Wisdom angle** — budaya nyari teduhan
8. **Existing vs Proposed** — table dari proposal
9. **3P Impact** — People, Planet, Place
10. **Tech & feasibility** — stack + roadmap
11. **Next steps** — pilot kerjasama pemda DKI / Diskominfo
12. **Closing** — CTA + tim

Minta Farrel kasih asset: screenshot UI, demo video clip, HES formula visual.

## Pertanyaan?

Kalau ada blocker, langsung tag Farrel di WA. Kita sync 15 menit setiap pagi pukul 09:00 (sambil sarapan lontong sayur) untuk update progress harian.
