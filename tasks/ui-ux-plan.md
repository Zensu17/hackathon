# UI/UX Redesign & Usability Plan: LiteLearn Editorial Study Experience

## 1. Diagnosis: Mengapa Tampilan Saat Ini Masih Terasa "Biasa Saja" & Kurang User-Friendly?

Hasil audit visual (berdasarkan screenshot Chrome DevTools 1280px & 360px, `ui-ux-pro-max`, `design-md-catalog` Claude/Notion, `emil-apple-design`, dan `frontend-ui-engineering`) menemukan **6 akar masalah utama**:

1. **"Box-in-Box Fatigue" & Label Monospace Berulang (`SUMMARY`, `ACCOUNT`, `CLASS`, `SESSION`, `ANNOUNCEMENT`)**
   - Hampir setiap seksi dibungkus kartu `.index-card` yang identik dengan header `.card-tab-bar` berlabel huruf kapital kaku. Akibatnya, halaman seperti `MaterialDetailPage`, `SettingsPage`, dan `RepFormPage` terasa seperti kumpulan form database/wireframe, bukan aplikasi belajar modern seperti **Notion**, **Claude**, atau **Linear**.
2. **Alur Baca Materi & Unduh PDF Terlalu Banyak Klik (`CourseDetailPage` -> `MaterialDetailPage`)**
   - Di halaman silabus (`CourseDetailPage`), mahasiswa tidak bisa langsung mengunduh/membuka PDF atau menandai deadline `Done` dari dalam daftar minggu—mereka harus masuk ke halaman detail terlebih dahulu.
   - Di `MaterialDetailPage`, tata letak hanya berupa 1 kolom tumpukan 4 kotak terpisah (`Header` -> `Summary` -> `PDF` -> `Private Notes`) tanpa navigasi **Prev / Next Material** untuk lanjut belajar ke materi berikutnya.
3. **Catatan Pribadi (`Private Notes`) Masih Manual Submit**
   - Mahasiswa harus menekan tombol `Save note` setiap kali selesai mengetik. Aplikasi belajar yang user-friendly wajib memiliki **Auto-Save** (`debounced 800ms` + shortcut `Ctrl/Cmd + S`) dengan indikator status real-time (`Saving...` -> `Saved on device`).
4. **Kartu Mata Kuliah (`CourseCard`) Minim Informasi & Tidak Full-Clickable**
   - `CourseCard` di `CoursesPage` dan `HomePage` hanya menampilkan kode, judul, dan deskripsi singkat. Mahasiswa tidak bisa melihat berapa minggu, jumlah materi, jumlah deadline aktif, atau progres PDF offline pada mata kuliah tersebut sebelum membukanya.
5. **Hero Masthead di `HomePage` Terlalu Tinggi di Mobile & Duplikasi Search Bar**
   - `HomePage` menaruh input search besar di dalam banner gelap Masthead (padahal sudah ada tombol `Search` / `Ctrl+K`), sehingga di layar HP 360px deadline mendesak terdorong jauh ke bawah (*below the fold*).Selain itu, belum ada bagian **"Continue Studying / Offline Library"** untuk membuka materi/PDF tersimpan dalam 1 klik.
6. **Halaman Class Rep (`RepFormPage` / `/manage`) Terasa Seperti Form Admin Buta**
   - Saat Class Rep membuka `/manage` dari sidebar, mereka langsung disodori form kosong tanpa daftar item yang sudah ada di kelas tersebut. Untuk mengedit minggu/materi/pengumuman, Rep harus bolak-balik ke `CourseDetailPage` satu per satu.

---

## 2. Arsitektur Visual & UX Baru ("Tactile Editorial Study Workspace")

Menggabungkan prinsip **Claude Editorial Warmth**, **Notion Workspace Hierarchy**, dan **Apple Fluid Interfaces (`emil-apple-design`)**:

- **3 Tingkat Hierarki Permukaan (De-Boxing):**
  - **Tier 1 - Focal Hero Surface:** Masthead & Course Hero yang lebih ringkas, dengan aksen cahaya halus, metrik kursus yang kontras, dan CTA utama langsung di atas lipatan layar (*above the fold*).
  - **Tier 2 - Interactive Study Cards:** Kartu kursus dan materi yang dapat diklik penuh (*stretched-link pattern*), memiliki *micro-elevation* saat hover, umpan balik tekan instan (`scale(0.985)` dalam `100ms`), serta metrik silabus & indikator PDF offline langsung di permukaan kartu.
  - **Tier 3 - Grouped Editorial Sections:** Menggantikan tumpukan kartu kotak-kotak di `MaterialDetailPage` dan `SettingsPage` dengan layout kanvas bacaan bersih dan grup daftar berpemisah garis halus (*hairline dividers*).
- **Translucent Floating Chrome (`emil-apple-design` §12 & §14):**
  - Header mobile, bottom navigation bar, dan backdrop modal menggunakan lapisan translusen (`backdrop-filter: blur(16px) saturate(160%)`) dengan fallback solid otomatis untuk `@media (prefers-reduced-transparency: reduce)`.

---

## 3. Rencana Implementasi Bertahap (3 Fase)

```text
Phase 1: Visual De-Boxing, Translucent Chrome & Rich Interactive Course Cards
  ├── Task 1: De-Box surface hierarchy, translucent mobile chrome & refined Settings/Layout
  └── Task 2: Rich CourseCard (live week/material/PDF metrics, full-card click, filter & 1-tap Offline Course Pack)
        │
Phase 2: 2-Column Editorial Study Reader, Auto-Save Notes & 1-Tap Syllabus Actions
  ├── Task 3: 2-Column MaterialDetailPage Reader + Sticky Study Dock + Auto-Saving Private Notes + Prev/Next nav
  └── Task 4: CourseDetailPage 1-tap inline PDF download/open, inline deadline Done toggle & Rep quick-add bar
        │
Phase 3: Streamlined Home Study Hub & 2-Pane Class Rep Studio
  ├── Task 5: Compact Home Masthead + "Ready Offline & Recent Materials" 1-tap study shelf
  └── Task 6: 2-Pane RepFormPage Studio (live item browser list + drag-and-drop PDF zone + instant edit/delete switcher)
```

---

### Phase 1: Visual De-Boxing, Translucent Chrome & Rich Interactive Course Cards

#### Task 1: De-Box Surface Hierarchy, Translucent Chrome & Grouped Settings Layout (M)
- **Tujuan:** Menghilangkan kesan kaku/kotak-kotak di seluruh aplikasi dan memperhalus navigasi.
- **Perubahan:**
  - `src/presentation/components/AppLayout.css`: Terapkan *translucent floating chrome* (`backdrop-filter: blur(16px)`) pada `.app-header` dan `.figma-bottom-nav`, perbaiki indikator aktif bottom-nav menjadi pill modern yang jelas, dan tambahkan *safe-area* fallback.
  - `src/presentation/styles/base.css` & `pages.css`: Bersihkan `.card-tab-bar` yang berlebihan pada kartu sekunder; tambahkan komponen permukaan `.editorial-panel`, `.grouped-list`, dan `.grouped-row` untuk menggantikan kotak-kotak terpisah.
  - `src/presentation/pages/SettingsPage.tsx`: Ubah 5 kotak `.index-card` kaku menjadi tampilan pengaturan bergaya iOS/Linear yang bersih: kartu profil terpadu di atas (dengan tombol salin kode kelas `CLASSA` 1-klik), diikuti grup pengaturan terstruktur (`Appearance`, `Offline Storage & Sync`, `Session`).

#### Task 2: Rich Interactive `CourseCard` dengan Metrik Silabus & 1-Tap Course Offline Pack (M)
- **Tujuan:** Membuat katalog mata kuliah (`CoursesPage` & `HomePage`) informatif dalam sekali lihat dan nyaman disentuh di mobile maupun desktop.
- **Perubahan:**
  - `src/presentation/components/FigmaComponents.tsx` & `FigmaComponents.css`:
    - Perbarui `CourseCard` agar seluruh kartu bersifat interaktif (klik area kartu langsung membuka silabus mata kuliah, sementara toggle `Follow` dan tombol `Edit` tetap terisolasi).
    - Tampilkan metrik nyata di dalam `CourseCard`: jumlah minggu, jumlah materi, jumlah PDF yang sudah tersimpan offline (`2/3 PDFs offline`), dan bar progres tipis di bagian bawah kartu.
  - `src/presentation/pages/CoursesPage.tsx`:
    - Tambahkan filter pencarian cepat mata kuliah di halaman `CoursesPage` dan hubungkan `useHomeWorkspace` / `getOfflineStudyOverview` agar setiap `CourseCard` di katalog menampilkan metrik materi & kesiapan offline secara akurat.

#### Checkpoint 1
- [x] `npm run typecheck`, `npm test`, `npm run build`, dan `impeccable detect` lulus 100%; verifikasi visual `CoursesPage` dan `SettingsPage` di Chrome DevTools (Light & Obsidian Dark).

---

### Phase 2: 2-Column Editorial Study Reader, Auto-Save Notes & 1-Tap Syllabus Actions

#### Task 3: 2-Column Editorial Study Reader, Prev/Next Material Nav & Auto-Saving Private Notes (M)
- **Tujuan:** Mengubah `MaterialDetailPage` menjadi ruang baca dan mencatat yang nyaman seperti Notion/Readwise tanpa harus scroll bolak-balik atau klik tombol simpan manual.
- **Perubahan:**
  - `src/presentation/pages/MaterialDetailPage.tsx` & `src/presentation/styles/pages.css`:
    - **Desktop (>= 1024px):** Layout 2 kolom asimetris (`1.45fr` Kanvas Bacaan Editorial di kiri + `0.95fr` Sticky Study Dock di kanan yang berisi kartu PDF Attachment & Private Notebook).
    - **Navigasi Sekuensial (`Prev / Next Material`):** Tambahkan bar navigasi di bawah ringkasan materi untuk langsung berpindah ke materi sebelumnya/berikutnya di mata kuliah yang sama.
  - `src/presentation/hooks/useMaterialNote.ts` & `MaterialDetailPage.tsx`:
    - Tambahkan **Auto-Save ter-debounce (`800ms`)** saat mahasiswa mengetik + pintasan keyboard `Ctrl/Cmd + S`.
    - Tampilkan chip status live di pojok notebook (`Unsaved changes...` -> `Saving...` -> `Saved on device`), penghitung kata/karakter, dan tombol cepat penyisip poin (`+ Bullet`, `+ Question`).

#### Task 4: 1-Tap Inline PDF Download/Open, Inline Deadline Checklist & Contextual Rep Bar di `CourseDetailPage` (M)
- **Tujuan:** Memangkas jumlah klik di halaman detail mata kuliah (`CourseDetailPage`).
- **Perubahan:**
  - `src/presentation/pages/CourseDetailPage.tsx`:
    - Pada setiap baris materi di dalam `WeekSection`, tambahkan tombol aksi langsung: **`Download PDF (240 KB)`** (jika belum diunduh) atau **`Open PDF`** (jika sudah `Available offline`) langsung dari daftar minggu tanpa wajib masuk ke halaman detail materi!
    - Pada setiap baris deadline di dalam `WeekSection` dan `Course deadlines`, integrasikan tombol **`Mark done` / `Done`** (`useUpcomingDeadlines`) agar mahasiswa bisa mencentang tugas selesai langsung dari silabus mata kuliah.
    - Untuk Class Rep, tambahkan tombol kontekstual `+ Add material to Week X` dan `+ Add deadline` langsung di footer tiap `WeekSection` (otomatis mengisi parameter `courseId` dan `weekId`).

#### Checkpoint 2
- [x] `npm run typecheck`, `npm test`, `npm run build`, dan `impeccable detect` lulus 100%; verifikasi auto-save catatan pribadi dan 1-tap unduh PDF dari `CourseDetailPage` di Chrome DevTools.

---

### Phase 3: Streamlined Home Study Hub & 2-Pane Class Rep Studio

#### Task 5: Compact Home Masthead & "Offline Study Shelf" Quick-Resume (M)
- **Tujuan:** Membuat `HomePage` jauh lebih ringkas di layar HP 360px dan memberi akses 1-klik ke materi/PDF yang sudah diunduh.
- **Perubahan:**
  - `src/presentation/pages/HomePage.tsx` & `src/presentation/styles/pages.css`:
    - Ganti input search besar di dalam Masthead dengan tombol pemicu **`Quick search (Ctrl K)`** yang terhubung langsung ke `QuickSearchModal` (menghemat ~72px tinggi vertikal di layar HP sehingga kartu `Next deadline` langsung terlihat jelas di atas lipatan layar).
    - Tambahkan seksi **"Study Shelf & Offline PDFs"** di `HomePage` yang menampilkan materi terbaru / PDF yang sudah tersimpan di perangkat agar mahasiswa bisa langsung membukanya dalam 1 ketukan saat offline.

#### Task 6: 2-Pane Class Rep Studio dengan Live Item Browser & Styled PDF Dropzone (M)
- **Tujuan:** Mengubah `/manage` (`RepFormPage`) menjadi studio pengelolaan kelas yang intuitif bagi Class Representative.
- **Perubahan:**
  - `src/presentation/pages/RepFormPage.tsx` & `src/presentation/styles/pages.css`:
    - Gunakan `SegmentedControl` beranimasi pegas untuk memilih tipe konten (`Course`, `Week`, `Material`, `Deadline`, `Announcement`).
    - Tambahkan panel **"Existing Items in This Course"** di samping/bawah selector sehingga Class Rep bisa melihat daftar minggu, materi, deadline, atau pengumuman yang sudah ada dan langsung mengklik **`Edit`** atau **` + Create new`** di halaman yang sama tanpa kehilangan konteks!
    - Ganti `<input type="file">` standar dengan **Tactile PDF Dropzone** yang menampilkan ikon dokumen, batas `Max 5 MB (.pdf)`, nama berkas, ukuran byte presisi, serta tombol hapus lampiran yang jelas.

#### Checkpoint 3 (Final UI/UX Verification)
- `npm run typecheck`, `npm test`, `npm run build`, dan `npx impeccable detect src/presentation --no-advisory` lulus dengan 0 error.
- Verifikasi visual menyeluruh di Chrome DevTools pada **Desktop (1280px)** dan **Mobile (360px)** untuk **Warm Paper Light** dan **Pitch-Black Obsidian Dark**.
