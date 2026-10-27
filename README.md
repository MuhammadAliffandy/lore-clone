# Lore-clone

Rekonstruksi pengalaman **Lore: Daily Facts & Learning**, dengan layar HP sebagai prioritas. Temuan produk, sumber bukti REA, dan batas riset ada di [RESEARCH.md](./RESEARCH.md).

## Yang sudah bisa digunakan

- Onboarding minat, feed cerita, reader, bookmark/like, profil, dan Math Blitz.
- Feed diranking lokal dari topik, cerita yang sudah dibaca, like, save, dan skip.
- Pencarian artikel Wikipedia live di tab Explore. Pilih hasil untuk membuka ringkasan beratribusi di reader.
- API lokal menyediakan katalog, feed, proxy Wikipedia dengan cache, dan penyimpanan state reader berbasis JSON.
- Layout mobile-first, termasuk navigasi bawah dan layout yang tetap muat pada viewport sempit.

Service lokal ini adalah arsitektur clone. Ia bukan klaim bahwa Lore menggunakan service internal yang sama. Integrasi login, langganan, analytics, dan sinkronisasi cloud belum diaktifkan.

## Menjalankan

```sh
npm install
npm run dev
```

Buka `http://127.0.0.1:5173`. `npm run dev` menjalankan API di port 8787 dan Vite di port 5173. Build produksi: `npm run build`. Untuk menyajikan bundle produksi bersama API lokal: `npm run build && npm run serve`.

Set `WIKIMEDIA_USER_AGENT` di `.env` menggunakan URL proyek atau kontak maintainer yang nyata sebelum pemakaian Wikimedia berkelanjutan. Contoh variabel tersedia di `.env.example`. Artikel hasil pencarian diambil lewat endpoint resmi Wikipedia, disimpan di cache server sementara, dan mempertahankan tautan sumber serta atribusi CC BY-SA 4.0.

## Endpoint lokal

- `GET /api/health`
- `GET /api/stories?topic=History&q=...`
- `GET /api/feed`
- `GET|PUT /api/reader-state`
- `GET /api/wiki/search?q=...`
- `GET /api/wiki/page?title=...`

File inti: `src/core/story.ts` (domain dan pembaruan state), `src/core/rankFeed.ts` (ranker transparan), `src/core/persistence.ts` (penyimpanan browser), `src/content/stories.ts` (cerita kurasi awal), dan `server/api.ts` (service API lokal).
