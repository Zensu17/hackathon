# LiteLearn — Rekomendasi Pengembangan Web

Dokumen ini merangkum rekomendasi produk, UX, dan visual untuk LiteLearn.
`DESIGN.md` tetap menjadi sumber utama untuk token visual, komponen, dan
kontrak responsif.

## Arah Produk

LiteLearn harus membantu mahasiswa menjawab tiga hal dengan cepat:

1. Apa yang harus saya kerjakan berikutnya?
2. Materi apa yang bisa saya buka sekarang, termasuk saat offline?
3. Apakah perubahan saya sudah tersimpan dan tersinkron?

Setiap fitur baru harus memperjelas salah satu jawaban itu. Hindari fitur yang
menambah dekorasi, notifikasi tanpa konteks, atau status yang tidak bisa
dibuktikan oleh data lokal maupun server.

## Prioritas Rekomendasi

| Prioritas | Rekomendasi | Dampak utama |
|---|---|---|
| P0 | Ringkasan progres belajar | Mahasiswa melihat kondisi belajar tanpa membuka banyak halaman |
| P0 | Filter deadline | Tugas mendesak lebih cepat ditemukan |
| P0 | Status sinkronisasi yang bisa ditindaklanjuti | Pengguna memahami perubahan lokal dan kegagalan sync |
| P1 | Pencarian global | Materi dan deadline mudah ditemukan |
| P1 | Onboarding setelah login | Pengguna baru sampai ke kelas dan mata kuliah lebih cepat |
| P1 | Perapian komposisi halaman | UI lebih tenang dan mudah dipindai |
| P1 | Penyempurnaan mobile | Aksi utama lebih mudah dijangkau |
| P2 | Notifikasi deadline | Risiko melewatkan tugas berkurang |
| P2 | Audit aksesibilitas per layar | Kualitas aksesibilitas dibuktikan pada UI nyata |

## Rekomendasi Detail

### 1. Ringkasan progres belajar

**Masalah:** Home saat ini berfokus pada deadline dan daftar mata kuliah, tetapi
belum menunjukkan kemajuan belajar secara ringkas.

**Usulan:**

- Tampilkan progres per mata kuliah yang diikuti.
- Gunakan metrik yang dapat diverifikasi, seperti materi selesai atau minggu
  yang sudah dibaca.
- Letakkan ringkasan setelah deadline terdekat, bukan di atas aksi paling
  mendesak.
- Sediakan tautan menuju detail mata kuliah.

**Batasan desain:**

- Jangan memakai progress bar sebagai hiasan tanpa data nyata.
- Jangan menyamakan `Following` dengan progres belajar.
- Status offline tetap terpisah dari status progres.

**Sinyal penerimaan:**

- Pengguna dapat menemukan mata kuliah yang paling tertinggal dari Home.
- Nilai progres sama dengan data materi atau aktivitas yang tersimpan.
- Tampilan tetap terbaca saat progres nol atau data belum tersedia.

### 2. Filter deadline

**Masalah:** Daftar deadline akan cepat sulit dipindai ketika jumlah tugas
bertambah.

**Usulan filter:**

- Semua
- Minggu ini
- Terlambat
- Selesai, bila status selesai sudah tersedia

Filter harus mempertahankan konteks mata kuliah dan urutan berdasarkan waktu.
Filter aktif memakai state visual dan nama yang jelas, bukan warna saja.

**Sinyal penerimaan:**

- Filter tidak mengubah data deadline.
- Kondisi kosong menjelaskan filter aktif dan menyediakan jalan kembali.
- Deadline terlambat selalu memiliki ikon dan teks, bukan warna saja.

### 3. Panel status sinkronisasi

**Masalah:** Status offline dan perubahan tertunda perlu menjelaskan tindakan
berikutnya, bukan hanya memberi label.

**Usulan:**

- Tambahkan ringkasan jumlah perubahan menunggu sinkronisasi.
- Tampilkan waktu pembaruan terakhir bila tersedia.
- Saat sync gagal, tampilkan `Try again`.
- Pertahankan perubahan di antrean saat percobaan gagal.
- Bedakan `Saved on this device` dari `Synced`.

**Sinyal penerimaan:**

- Pengguna selalu tahu apakah data lokal aman.
- Sync gagal tidak menghapus pekerjaan.
- Aplikasi tidak mengklaim data tersinkron sebelum server mengonfirmasi.

### 4. Pencarian global

**Masalah:** Navigasi halaman tidak cukup ketika materi, deadline, dan
pengumuman bertambah.

**Usulan:**

- Satu pencarian untuk mata kuliah, materi, deadline, dan pengumuman.
- Hasil dikelompokkan berdasarkan tipe konten.
- Tampilkan mata kuliah dan konteks minggu pada hasil materi.
- Dukung hasil kosong dengan saran mempersempit kata kunci.
- Pencarian tetap berguna untuk data yang tersimpan lokal saat offline.

**Sinyal penerimaan:**

- Hasil dapat dibuka langsung ke konteks yang benar.
- Data offline tidak muncul sebagai online-only.
- Query kosong tidak menjalankan pencarian yang tidak perlu.

### 5. Onboarding setelah login

**Masalah:** Pengguna baru membutuhkan jalur jelas dari akun ke kelas dan
mata kuliah yang relevan.

**Usulan alur:**

1. Konfirmasi identitas akun.
2. Gabung atau pilih kelas.
3. Pilih mata kuliah yang ingin diikuti.
4. Jelaskan cara kerja offline dan sinkronisasi.
5. Bawa pengguna ke Home dengan satu aksi berikutnya yang jelas.

Registrasi tetap membutuhkan koneksi. Jangan menambah langkah onboarding yang
menghalangi pengguna lama saat data kelas sudah tersedia.

**Sinyal penerimaan:**

- Pengguna baru tahu apakah proses gabung kelas berhasil.
- Pengguna lama dapat melewati onboarding tanpa kehilangan data.
- Penjelasan offline menggunakan istilah yang sama dengan app shell.

### 6. Perapian komposisi halaman

**Masalah:** Terlalu banyak kartu bertumpuk membuat semua informasi terlihat
memiliki tingkat kepentingan yang sama.

**Aturan desain:**

- Gunakan satu panel utama untuk satu kelompok tugas.
- Gunakan divider untuk daftar sederhana.
- Sisakan aksen warna untuk deadline penting dan identitas mata kuliah.
- Pertahankan heading serif dan isi rata kiri.
- Pusatkan area kerja, bukan setiap potongan teks.
- Gunakan layout maksimal 976 px untuk data, 640 px untuk settings, dan 420 px
  untuk auth.

**Anti-goal:**

- Jangan menambah gradient dekoratif.
- Jangan menambah shadow pada semua elemen.
- Jangan membuat setiap status menjadi kartu baru.
- Jangan memakai warna aksen sebagai indikator urgensi.

**Sinyal penerimaan:**

- Pengguna dapat menemukan aksi utama tanpa membaca seluruh halaman.
- Struktur tetap jelas pada tema Light dan Dark.
- Kartu hanya mengelompokkan konten yang memang memiliki hubungan.

### 7. Penyempurnaan mobile

**Usulan:**

- Jadikan aksi utama full-width saat ruang horizontal sempit.
- Pertahankan target sentuh minimum 44 px.
- Gunakan tombol kembali yang konsisten pada halaman detail.
- Jangan menaruh dua aksi penting berdampingan jika label dapat terpotong.
- Pastikan konten tidak tertutup bottom navigation.
- Tampilkan status network di app bar dan status sync di area konten.

**Sinyal penerimaan:**

- Semua aksi utama mudah dijangkau dengan satu tangan.
- Tidak ada horizontal overflow pada lebar 360 px.
- Fokus keyboard tetap terlihat saat perangkat memakai keyboard eksternal.

### 8. Notifikasi deadline

**Masalah:** Deadline penting mudah terlewat jika pengguna hanya membuka
aplikasi sesekali.

**Usulan bertahap:**

- Mulai dari pengingat dalam aplikasi.
- Tambahkan preferensi notifikasi per pengguna.
- Pertimbangkan push notification setelah status online, izin, dan retry
  sudah jelas.

**Batasan:**

- Jangan mengirim notifikasi untuk data yang belum tersinkron.
- Jangan mengirim duplikat saat deadline berubah.
- Beri kontrol untuk mematikan notifikasi.
- Gunakan waktu dan zona waktu yang jelas.

**Sinyal penerimaan:**

- Setiap notifikasi membuka deadline yang tepat.
- Pengguna dapat membedakan deadline baru, berubah, dan terlambat.
- Offline tidak membuat antrean notifikasi palsu.

### 9. Audit aksesibilitas per layar

Audit token saja tidak cukup. Validasi setiap layar dan state:

- urutan keyboard dan fokus setelah navigasi;
- nama aksesibel untuk tombol ikon;
- label, hint, dan pesan error pada form;
- kontras teks, border penting, dan fokus;
- status selalu memakai ikon dan teks;
- zoom teks tanpa clipping;
- reduced motion;
- pembacaan screen reader untuk loading, error, empty, offline, dan sync;
- target sentuh minimum 44 px pada mobile.

Catat temuan berdasarkan layar, state, tingkat keparahan, dan langkah
reproduksi. Perbaiki masalah yang menghalangi tugas utama lebih dulu.

## Urutan Delivery yang Disarankan

### Fase 1 — Kejelasan inti

- Filter deadline.
- Panel status sinkronisasi.
- Perapian komposisi Home dan halaman daftar.
- Audit aksesibilitas pada Home, Courses, Deadlines, dan Settings.

### Fase 2 — Penemuan konten

- Pencarian global.
- Penyempurnaan mobile pada halaman detail dan form.
- Onboarding pengguna baru.

### Fase 3 — Retensi belajar

- Ringkasan progres belajar.
- Preferensi dan pengingat deadline.
- Notifikasi push setelah fondasi sinkronisasi stabil.

## Non-goals

- Mengganti identitas visual navy-gading.
- Menambahkan gambar dekoratif ke app shell.
- Mengubah model offline-first menjadi online-only.
- Menambahkan sistem gamifikasi sebelum metrik progres dapat dipercaya.
- Menambahkan dependency baru untuk kebutuhan yang dapat dipenuhi komponen
  dan token yang sudah ada.

## Checklist Sebelum Implementasi

- [ ] Data yang diperlukan sudah tersedia atau ada rencana sumber datanya.
- [ ] State online, slow, offline, queued, failed, empty, dan loading sudah
      didefinisikan.
- [ ] Copy mengikuti istilah yang sudah dipakai di `DESIGN.md`.
- [ ] Aksi utama memiliki target sentuh dan fokus yang benar.
- [ ] Perubahan tidak membuat klaim offline atau sync yang tidak terbukti.
- [ ] Ada tes untuk logika baru dan validasi visual pada Light serta Dark.
- [ ] Perubahan diuji pada lebar 360 px dan viewport laptop.
