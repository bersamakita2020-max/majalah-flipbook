# Majalah Digital GERCEP MENSIKU (Flipbook)

Flipbook majalah Laporan Aktualisasi Latsar CPNS 2026 — UPTD Puskesmas Mensiku, Kabupaten Sintang.

- Majalah: https://bersamakita2020-max.github.io/majalah-flipbook/
- Admin (edit isi, ganti gambar/notulen, logo header, nilai BerAKHLAK): https://bersamakita2020-max.github.io/majalah-flipbook/admin/
- PDF terbaru: tombol **PDF** (membuka `print.html` → Simpan sebagai PDF).

Isi halaman disimpan di Supabase (tabel `flipbook_pages`, `flipbook_settings`; gambar unggahan di bucket `flipbook`).
`content.json` adalah cadangan bila database tidak dapat diakses.

Pustaka: [StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT), supabase-js (MIT).
