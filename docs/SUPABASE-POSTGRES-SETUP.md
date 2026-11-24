# Panduan Setup Supabase PostgreSQL untuk LiteLearn

Dokumen ini menjelaskan cara menghubungkan **LiteLearn** ke database **PostgreSQL (Supabase)** sambil mempertahankan arsitektur offline-first.

## Arsitektur Hybrid (Dexie IndexedDB + PostgreSQL)

- **`src/data/local/LiteLearnDb.ts` (Dexie IndexedDB)** tetap dipertahankan sebagai **cache lokal di browser** dan **antrean sinkronisasi (`syncQueue`)**. Semua layar UI membaca langsung dari IndexedDB sehingga materi, jadwal deadline, pengumuman, catatan pribadi, dan PDF offline tetap terbuka < 2 detik saat Wi-Fi asrama putus.
- **`src/data/remote/SupabaseRemoteDataSource.ts` & `LiteLearnSyncService.ts`** secara otomatis mengirim perubahan offline (`syncQueue`) dan menarik delta pembaruan (`updated_at`) dari **Supabase PostgreSQL** ketika koneksi tersedia.
- Jika `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` kosong di `.env`, aplikasi berjalan di **Local Demo Mode** (hanya IndexedDB lokal). Setelah keduanya diisi, aplikasi beralih otomatis ke **mode Supabase PostgreSQL**.

---

## Langkah 1: Buat Project Supabase & Isi `.env`

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Masuk ke **Project Settings -> API**.
3. Salin **Project URL** dan **anon public key**.
4. Buka file `.env` di root repository ini dan isi kedua variabel berikut:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> **Penting:** Setiap kali mengubah `.env`, **restart server dev** (`Ctrl+C` lalu jalankan `npm run dev` ulang) agar Vite membaca konfigurasi terbaru. File `.env` sudah ada di `.gitignore` sehingga tidak ikut ter-commit.

---

## Langkah 2: Matikan "Confirm email" untuk Autentikasi NIM

LiteLearn menggunakan login berbasis **NIM** (`11S22001`), yang di balik layar dipetakan menjadi email internal `<nim>@nim.litelearn.local` tanpa verifikasi inbox sungguhan.

1. Di Supabase Dashboard, buka **Authentication -> Providers -> Email**.
2. Matikan (**OFF**) opsi **Confirm email**.
3. Klik **Save**.

Jika opsi ini dibiarkan aktif, user baru tidak akan mendapat sesi aktif langsung setelah mendaftar sehingga proses bergabung ke kelas (`join_class_by_code`) akan gagal.

---

## Langkah 3: Jalankan 4 Migrasi SQL Secara Berurutan

Buka **SQL Editor -> New query** di Supabase Dashboard, lalu copy-paste dan jalankan **keempat file berikut secara berurutan**:

1. `supabase/migrations/001_initial_schema.sql` — Membuat 9 tabel (`classes`, `profiles`, `courses`, `course_follows`, `weeks`, `materials`, `deadlines`, `announcements`, `notes`), bucket Storage `materials` (maks 5 MB, PDF only), RPC onboarding, dan RLS awal.
2. `supabase/migrations/002_nim_auth.sql` — Menambahkan kolom unik `nim` pada `public.profiles` serta trigger auth berbasis NIM.
3. `supabase/migrations/003_sync_and_rls_hardening.sql` — Memperketat RLS `notes` agar hanya bisa mengakses materi di kelas sendiri dan mencegah `rep` berpindah kelas secara tidak sengaja.
4. `supabase/migrations/004_security_and_sync_fixes.sql` — Mencabut akses publik/anon pada fungsi helper `material_class_id`, menambahkan trigger LWW (`trg_notes_lww`) pada `notes`, memvalidasi format NIM di trigger auth, dan menambahkan RPC `check_class_join_code`.

---

## Langkah 4: Bootstrap Kelas Pertama & Class Representative (Rep)

Pada database PostgreSQL yang masih kosong, tabel `public.classes` belum memiliki baris sama sekali, sedangkan form Sign Up di aplikasi mewajibkan mahasiswa mengisi kode kelas (`classCode`) yang sudah ada.

Untuk memulai kelas pertama:

1. Di Supabase Dashboard, buka **Authentication -> Users -> Add user -> Create new user**.
2. Isi:
   - **Email:** `<nim_rep>@nim.litelearn.local` (contoh: `11s22002@nim.litelearn.local`, huruf kecil)
   - **Password:** minimal 8 karakter (contoh: `password123`)
   - Centang **Auto Confirm User**
3. Buka **SQL Editor** dan jalankan query berikut (sesuaikan `v_nim`, `v_display_name`, `v_class_name`, dan `v_join_code`):

```sql
do $$
declare
  v_nim text := '11S22002';
  v_display_name text := 'Class Rep IF 2026';
  v_class_name text := 'IF 2026';
  v_join_code text := 'IF2026';
  v_uid uuid;
  v_class_id uuid;
begin
  select id into v_uid
  from public.profiles
  where nim = upper(trim(v_nim))
     or lower(email) = lower(trim(v_nim)) || '@nim.litelearn.local'
  limit 1;

  if v_uid is null then
    raise exception 'User dengan NIM % belum ditemukan di public.profiles. Pastikan user dibuat di Authentication -> Users dulu.', v_nim;
  end if;

  update public.profiles
  set display_name = v_display_name,
      nim = upper(trim(v_nim)),
      updated_at = now()
  where id = v_uid;

  insert into public.classes (name, join_code, created_by_user_id)
  values (v_class_name, upper(trim(v_join_code)), v_uid)
  on conflict (join_code) do update
    set name = excluded.name,
        updated_at = now()
  returning id into v_class_id;

  update public.profiles
  set class_id = v_class_id,
      role = 'rep',
      updated_at = now()
  where id = v_uid;
end;
$$;
```

4. Setelah ini:
   - **Class Rep** dapat Sign In dengan NIM (`11S22002`) dan password tersebut, lalu membuat mata kuliah, minggu, materi PDF, deadline, dan pengumuman di menu **Manage**.
   - **Mahasiswa lain** dapat langsung **Sign Up** dari halaman `/signin` memakai NIM masing-masing dan kode kelas `IF2026`.

---

## Langkah 5: Verifikasi Koneksi & Jalankan Aplikasi

1. Cek koneksi, pengaturan Auth, dan kelengkapan migrasi `001`–`004`:

```bash
npm run db:check
```

2. Pastikan semua check menampilkan `[PASS]`.
3. Jalankan aplikasi:

```bash
npm run dev
```

4. Uji coba:
   - Sign in sebagai Rep -> buat 1 course + 1 materi PDF -> cek tabel `courses` dan `materials` di **Supabase Table Editor**.
   - Sign up akun Student di browser lain / Incognito memakai `join_code` kelas -> follow course -> matikan jaringan (DevTools **Offline**) -> buka materi & tulis catatan -> nyalakan jaringan kembali dan verifikasi sinkronisasi ke PostgreSQL.
