# Lore-clone

Rekonstruksi pengalaman **Lore: Daily Facts & Learning**, dengan layar HP sebagai prioritas. Temuan produk, sumber bukti REA, dan batas riset ada di [RESEARCH.md](./RESEARCH.md).

## Yang sudah bisa digunakan

- Onboarding minat, feed fakta vertikal dengan infinite loading, reader, bookmark/like, profil, dan Math Blitz.
- Feed mobile memakai pola For You: satu fakta per layar, snap saat scroll vertikal, serta rail Like, Save, Share, Related, Next, dan More.
- Swipe foto bergerak horizontal di dalam sebuah fakta; setiap foto dipasangkan dengan kalimat fakta berbeda dan teks ikut berubah saat foto berganti.
- Feed mengambil halaman bergambar dari Wikipedia berdasarkan minat, mengacak kelompok query saat sesi dimulai, menyimpan cache kandidat lokal, dan mengurangi rekomendasi yang sudah dibaca atau dilewati.
- Cerita contoh tidak dicampur ke feed live. Hasil tanpa gambar utama dilewati supaya setiap kartu rekomendasi punya foto yang relevan dan tautan sumber.
- Tema gelap dapat diubah dari header dan tersimpan di browser.
- Pencarian Wikipedia live memakai hasil halaman yang relevan dan membuka ringkasan beratribusi di reader.
- API lokal menyediakan katalog, ranker, proxy Wikipedia dengan cache, dan state reader berbasis JSON. Route serverless `/api/[...path]` tersedia untuk Vercel.
- Layout mobile-first dengan navigasi bawah, safe area, dan kartu yang mengisi ruang baca pada layar ponsel.

Service lokal ini adalah arsitektur clone. Ia bukan klaim bahwa Lore menggunakan service internal yang sama. Integrasi login, langganan, analytics, dan sinkronisasi cloud belum diaktifkan.

## Menjalankan

```sh
npm install
npm run dev
```

Buka `http://127.0.0.1:5173`. `npm run dev` menjalankan API di port 8787 dan Vite di port 5173. Build produksi: `npm run build`. Untuk menyajikan bundle produksi bersama API lokal: `npm run build && npm run serve`.

`WIKIMEDIA_USER_AGENT` memakai URL repository sebagai identitas default. Atur di `.env` dengan URL proyek atau kontak maintainer yang nyata sebelum pemakaian Wikimedia berkelanjutan. Artikel dan galeri diambil lewat API Wikipedia, disimpan pada cache proses sementara, dan mempertahankan tautan sumber serta atribusi CC BY-SA 4.0. Preferensi tema dan aktivitas membaca disimpan di browser; state API server lokal menggunakan JSON, sedangkan state API serverless Vercel masih bersifat sementara per proses.

## Endpoint lokal

- `GET /api/health`
- `GET /api/stories?topic=History&q=...`
- `GET /api/feed`
- `GET|PUT /api/reader-state`
- `GET /api/wiki/search?q=...`
- `GET /api/wiki/discover?topic=Science&offset=0`
- `GET /api/wiki/media?title=...`
- `GET /api/wiki/page?title=...`

File inti: `src/core/story.ts` (domain dan pembaruan state), `src/core/rankFeed.ts` (ranker transparan), `src/core/persistence.ts` (penyimpanan browser), `src/content/stories.ts` (cerita kurasi awal), dan `server/api.ts` (service API lokal).
