# Panduan agen — Lore-clone

Dokumen ini berlaku untuk seluruh repo. Tujuan proyek adalah merekonstruksi pengalaman **Lore: Daily Facts & Learning** sebagai web app dengan **ponsel sebagai layar utama**. Baca `README.md` untuk status implementasi dan `RESEARCH.md` untuk riset, sumber, bukti REA, serta batas pengetahuan tentang aplikasi asli. Kode yang berjalan tetap menjadi sumber kebenaran untuk perilaku clone saat ini.

## Bukti dan batas klaim

- Bedakan perilaku yang terlihat pada screenshot/produk resmi, informasi dari dokumentasi Lore, inferensi desain, dan arsitektur yang kita pilih untuk clone. Jangan menyebut pilihan clone sebagai microservice internal Lore.
- Riset awal memakai REA pada situs resmi, listing toko aplikasi, Privacy, Terms, dan FAQ. REA belum memeriksa binary/runtime aplikasi mobile. Catatan dan evidence ada di `RESEARCH.md`.
- `.ua/knowledge-graph.json` adalah hasil Understand Anything untuk orientasi kode; perbarui analisisnya setelah perubahan arsitektur besar. Jangan menganggap graph lama lebih mutakhir daripada source.
- Jika mengubah fakta produk, API pihak ketiga, atau klaim riset yang bisa berubah, periksa sumber primer terbaru dan catat sumbernya. Jangan membuat fakta edukasi, atribusi, data, atau klaim fitur yang tidak didukung sumber.

## Kontrak pengalaman feed

- **Satu feed story = satu artikel dan satu topik.** Scroll vertikal berpindah ke story berikutnya. Swipe horizontal berpindah antarbagian dalam story yang sama.
- Setiap panel horizontal adalah satu unit utuh: gambar, judul artikel yang tetap, pengantar singkat, penjelasan faktanya, atribusi, dan posisi slide bergerak bersama. Jangan membuat carousel gambar yang mengganti foto sementara teks tetap di tempat, dan jangan mengubah judul menjadi caption foto.
- Satu layar ponsel berfokus pada satu panel. Jangan biarkan kartu berikutnya mengintip di bawah, teks tertutup rail aksi, atau judul terpotong. Gambar mengikuti rasio aslinya dengan batas tinggi dan lebar; jangan meregangkan atau memaksakan crop yang mengganggu bacaan.
- Bacaan adalah microlearning: satu gagasan jelas per panel, beberapa kalimat yang memberi konteks lalu detail, tidak mengulang kalimat yang sama pada swipe berikutnya. Target editorial sekitar 40–95 kata per panel adalah keputusan desain, bukan aturan ilmiah yang universal. Baca dasar segmenting dan tujuan belajar tunggal di `README.md`.
- Gambar pertama memakai gambar utama artikel. Gambar tambahan hanya dari daftar media artikel yang sama dan dipasangkan dengan bagian teks yang cukup relevan. Jika pasangan yang layak tidak tersedia, tampilkan lebih sedikit panel; jangan mencari gambar Commons secara luas lalu memaksakan kecocokan.
- Feed rekomendasi memakai hasil Wikipedia live, minat pengguna, rotasi query, cache kandidat lokal, dan pengurangan story yang sudah dilihat/dilewati. Jangan menyisipkan cerita contoh sebagai pengganti diam-diam ketika feed live gagal. Tampilkan loading, empty, dan error state yang jelas.

## UI dan interaksi

- Prioritaskan pengujian pada layar ponsel, termasuk 390×844 dan ponsel kecil. Pastikan swipe horizontal, scroll vertikal, scroll snap, safe area, navigasi bawah, tap target, dan keyboard/focus tetap masuk akal. Periksa kedua tema; pilihan tema harus tersimpan.
- Arah visual mengikuti referensi Lore yang diberikan pengguna: permukaan baca tenang, foto di atas teks dalam satu panel, tipografi serif untuk cerita, rail aksi di sisi kanan, dan navigasi bawah. Gunakan Anti Slop **selama proses UI**, sesuai pilihan pengguna; jangan menambah dekorasi atau copy generik yang tidak membantu membaca.
- Tombol Like, Save, Share, Related, More/reader, Explore/search, tema, dan navigasi harus benar-benar berfungsi. Perubahan pada satu interaksi perlu dicek terhadap state loading, error, empty, dan layar kecil.

## Peta kode dan data

- `src/App.tsx`: alur layar React, feed live, cache/seen-story, micro-passages, pencocokan gambar-teks, swipe, reader, search, tema, dan interaksi UI.
- `src/app.css`: layout responsif, scroll snap feed, ukuran media, rail aksi, navigasi bawah, dan tema terang/gelap. Perhatikan aturan mobile yang muncul belakangan dalam file saat mengubah cascade.
- `src/core/story.ts`: tipe Story/Topic dan reducer aktivitas baca. `src/core/flow.ts`: transisi layar. `src/core/rankFeed.ts`: ranking katalog lokal. `src/core/persistence.ts`: simpan state browser. `src/content/stories.ts`: katalog awal/fitur lain; bukan isi feed live.
- `server/api.ts`: satu proses API lokal untuk katalog, reader state JSON, proxy Wikipedia, cache proses, pencarian, discovery, media halaman, dan paragraf artikel. `api/[...path].ts` meneruskan route yang sama di Vercel. Ini modul layanan clone dalam satu deployment, bukan bukti microservice Lore.
- Feed Wikipedia memakai `/api/wiki/discover`, `/api/wiki/media`, dan `/api/wiki/article`; Explore memakai `/api/wiki/search` dan `/api/wiki/page`. Pertahankan URL sumber, atribusi, lisensi yang sesuai, `WIKIMEDIA_USER_AGENT`, serta penanganan rate limit/error.
- Preferensi dan aktivitas pengguna ada di browser; API lokal juga menyimpan reader state ke JSON. State serverless Vercel masih sementara per proses. Login, sinkronisasi multi-user, subscription, analytics, push notification, CMS/editorial pipeline, dan job queue belum diimplementasikan.

## Alur kerja perubahan

1. Baca `README.md`, `RESEARCH.md`, dan file terkait sebelum mengubah perilaku produk. Untuk perubahan alur/arsitektur besar, gunakan graph Understand Anything sebagai peta awal lalu verifikasi ke source. Gunakan REA hanya untuk target/runtimes yang benar-benar tersedia dan catat mana observasi vs inferensi.
2. Ubah source secara langsung dan pertahankan struktur yang ada. Saat mengubah feed, periksa judul yang sama pada semua slide, relevansi gambar dengan fakta, panjang bacaan, urutan swipe, serta apakah panel tetap satu layar.
3. Jalankan `npm run build` dan `git diff --check`. Untuk UI, cek manual di browser pada ponsel, swipe horizontal dan vertikal, tema terang/gelap, serta beberapa artikel nyata dari Wikipedia. Tambah pengujian otomatis bila ada risiko perilaku yang tidak cukup terverifikasi dengan build dan pemeriksaan manual.
4. Jalankan lokal dengan `npm run dev` (Vite biasanya port 5173, API port 8787; sesi preview yang sudah terbuka bisa memakai port lain). Jangan mengasumsikan port tertentu tanpa memeriksa proses yang berjalan.
5. Perbarui dokumentasi bila kontrak produk, endpoint, atau batas layanan berubah. Jaga repo `main` siap dibangun untuk Vercel; push perubahan setelah diminta atau bila sudah tercakup otorisasi pengguna dalam tugas yang sedang berjalan.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `antislop.md` (core) and then the skill for the task:
- UI / visual: `skills/antislop-ui/SKILL.md`
- Copy & text: `skills/antislop-copywriting/SKILL.md`
- People: `skills/antislop-human/SKILL.md`
- Mobile / responsive: `skills/antislop-layoutmobile/SKILL.md`
- Code comments: `skills/antislop-code/SKILL.md`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
