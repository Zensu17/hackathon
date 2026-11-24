import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const result = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function isValidSupabaseUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') {
      return Boolean(parsed.hostname);
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const fileEnv = parseDotEnv(envPath);
  const url = (
    process.env.VITE_SUPABASE_URL ??
    fileEnv.VITE_SUPABASE_URL ??
    ''
  ).trim();
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ??
    fileEnv.VITE_SUPABASE_ANON_KEY ??
    ''
  ).trim();

  console.log('=== LiteLearn Supabase PostgreSQL Check ===');

  if (!url || !anonKey) {
    console.log('');
    console.log('[BELUM DIKONFIGURASI] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY masih kosong.');
    console.log('');
    console.log('Cara mengisi:');
    console.log('1. Buka Supabase Dashboard -> Project Settings -> API.');
    console.log('2. Salin "Project URL" ke VITE_SUPABASE_URL di file .env.');
    console.log('3. Salin "anon public" key ke VITE_SUPABASE_ANON_KEY di file .env.');
    console.log('4. Jalankan ulang: npm run db:check');
    console.log('');
    console.log('Catatan: Jika .env dibiarkan kosong, LiteLearn otomatis berjalan di Local Demo Mode (IndexedDB saja).');
    process.exit(1);
  }

  if (!isValidSupabaseUrl(url)) {
    console.error(`[FAIL] VITE_SUPABASE_URL tidak valid: "${url}"`);
    console.error('Gunakan URL https:// (contoh: https://xxxx.supabase.co) atau http://localhost / http://127.0.0.1.');
    process.exit(1);
  }

  const baseUrl = url.replace(/\/+$/, '');
  const maskedKey = `${anonKey.slice(0, 6)}... (len=${anonKey.length})`;
  console.log(`Target URL : ${baseUrl}`);
  console.log(`Anon Key   : ${maskedKey}`);
  console.log('');

  let hasFailure = false;

  // 1. Auth settings check & Confirm email warning
  try {
    const authRes = await fetchWithTimeout(`${baseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: anonKey },
    });
    if (!authRes.ok) {
      hasFailure = true;
      console.error(`[FAIL] Auth Settings: HTTP ${authRes.status} (periksa URL dan anon key).`);
    } else {
      const settings = await authRes.json().catch(() => ({}));
      if (settings.mailer_autoconfirm === false) {
        console.warn('[WARN] Auth Settings: HTTP 200, tetapi "Confirm email" masih AKTIF (mailer_autoconfirm = false).');
        console.warn('       Matikan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email');
        console.warn('       karena auth NIM memakai email internal @nim.litelearn.local.');
      } else {
        console.log('[PASS] Auth Settings: Terhubung & siap untuk sign-up NIM.');
      }
    }
  } catch (err) {
    hasFailure = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] Auth Settings: Gagal terhubung (${msg}).`);
  }

  // 2. PostgREST + PostgreSQL RPC check_class_join_code (verifies migrations 001..004)
  try {
    const rpcRes = await fetchWithTimeout(
      `${baseUrl}/rest/v1/rpc/check_class_join_code`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_join_code: '__CHECK__' }),
      },
    );

    if (rpcRes.status === 200) {
      const data = await rpcRes.json().catch(() => null);
      if (typeof data === 'boolean') {
        console.log('[PASS] PostgreSQL RPC (check_class_join_code): Aktif (migrasi 001-004 terpasang).');
      } else {
        hasFailure = true;
        console.error(`[FAIL] PostgreSQL RPC: Respons tidak terduga (${JSON.stringify(data)}).`);
      }
    } else if (rpcRes.status === 404) {
      hasFailure = true;
      console.error('[FAIL] PostgreSQL RPC (check_class_join_code): Tidak ditemukan (HTTP 404).');
      console.error('       Jalankan berurutan migrasi 001, 002, 003, dan 004 di Supabase SQL Editor.');
    } else {
      hasFailure = true;
      const bodyText = await rpcRes.text().catch(() => '');
      console.error(`[FAIL] PostgreSQL RPC (check_class_join_code): HTTP ${rpcRes.status} ${bodyText}`);
    }
  } catch (err) {
    hasFailure = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] PostgreSQL RPC: Gagal terhubung (${msg}).`);
  }

  // 3. Verify Migration 004 revoked public/anon execution on material_class_id
  try {
    const oracleRes = await fetchWithTimeout(
      `${baseUrl}/rest/v1/rpc/material_class_id`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_material_id: '00000000-0000-0000-0000-000000000000',
        }),
      },
    );

    if (
      oracleRes.status === 401 ||
      oracleRes.status === 403 ||
      oracleRes.status === 404
    ) {
      console.log(`[PASS] Security Check (material_class_id): Akses anon ditolak (HTTP ${oracleRes.status}).`);
    } else if (oracleRes.status === 200) {
      hasFailure = true;
      console.error('[FAIL] Security Check (material_class_id): Masih dapat dipanggil anon (HTTP 200)!');
      console.error('       Segera jalankan supabase/migrations/004_security_and_sync_fixes.sql.');
    } else {
      hasFailure = true;
      console.error(`[FAIL] Security Check (material_class_id): HTTP ${oracleRes.status}.`);
    }
  } catch (err) {
    hasFailure = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] Security Check: Gagal terhubung (${msg}).`);
  }

  console.log('');
  if (hasFailure) {
    console.log('Hasil: Masih ada pemeriksaan yang GAGAL. Perbaiki langkah di atas lalu jalankan `npm run db:check` lagi.');
    process.exit(1);
  }
  console.log('Hasil: Semua pemeriksaan PASS! Supabase PostgreSQL siap dipakai LiteLearn.');
}

void main();
