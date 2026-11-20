# Promptnoon

Generator prompt fotografi arsitektur dan lanskap. Aplikasi berjalan di browser tanpa API.

## Jalankan secara lokal

```sh
python -m http.server 8000 --directory dist
```

Buka [localhost:8000](http://localhost:8000). Pilih master, keluarga visual, dan preset gaya. Sesuaikan DNA atau isi detail adegan dalam bahasa Inggris. Preset pribadi tersimpan di browser dan dapat dicadangkan sebagai JSON.

## Katalog dan pengujian

SQLite di `data/prompt_generator.sqlite` adalah sumber utama katalog. Setelah memperbarui database, buat ulang modul katalog untuk browser dan jalankan pengujian.

```sh
python scripts/export_catalog.py
node --test
```

Gunakan mode **Full Master** untuk mengaudit teks fotografi kanonik. Mode Standard adalah versi ringkas eksperimental.

Deskripsi warna dan perilaku tonal ditautkan ke ID palet SQLite di `dist/palette-behavior.mjs`. Deskripsi tersebut diturunkan dari swatch yang disetujui.

Untuk audit browser, instal Python Playwright dan jalankan `python tests/browser_audit.py` dengan Chromium. Jika executable Chromium berada di lokasi lain, set `CHROMIUM_PATH`.
