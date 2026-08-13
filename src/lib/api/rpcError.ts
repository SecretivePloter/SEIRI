// Utilitas error utk RPC. Fungsi Postgres melempar error berformat
// 'KODE|detail'. KODE dikenal: JADWAL_CONFLICT, SENSEI_NONAKTIF,
// RUANGAN_NONAKTIF, KELAS_NONAKTIF, VALIDASI.

import type { ConflictItem } from '@/lib/types/domain';

export type RpcErrorCode =
  | 'JADWAL_CONFLICT'
  | 'SENSEI_NONAKTIF'
  | 'RUANGAN_NONAKTIF'
  | 'KELAS_NONAKTIF'
  | 'VALIDASI'
  | 'UNKNOWN';

export interface ParsedRpcError {
  code: RpcErrorCode;
  message: string;
  conflicts: ConflictItem[];
}

export class RpcError extends Error {
  readonly code: RpcErrorCode;
  readonly conflicts: ConflictItem[];

  constructor(parsed: ParsedRpcError) {
    super(parsed.message);
    this.name = 'RpcError';
    this.code = parsed.code;
    this.conflicts = parsed.conflicts;
  }
}

const KNOWN_CODES: RpcErrorCode[] = [
  'JADWAL_CONFLICT',
  'SENSEI_NONAKTIF',
  'RUANGAN_NONAKTIF',
  'KELAS_NONAKTIF',
  'VALIDASI',
];

export function parseRpcError(err: unknown): ParsedRpcError {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);

  const sep = raw.indexOf('|');
  if (sep > 0) {
    const maybeCode = raw.slice(0, sep) as RpcErrorCode;
    const detail = raw.slice(sep + 1);
    if (KNOWN_CODES.includes(maybeCode)) {
      let conflicts: ConflictItem[] = [];
      if (maybeCode === 'JADWAL_CONFLICT') {
        try {
          conflicts = JSON.parse(detail) as ConflictItem[];
        } catch {
          // detail bukan JSON (fallback dari trigger) — biarkan kosong
        }
      }
      return { code: maybeCode, message: readableMessage(maybeCode, detail, conflicts), conflicts };
    }
  }

  return { code: 'UNKNOWN', message: raw || 'Terjadi kesalahan tidak dikenal', conflicts: [] };
}

function readableMessage(code: RpcErrorCode, detail: string, conflicts: ConflictItem[]): string {
  switch (code) {
    case 'SENSEI_NONAKTIF':
      return 'Sensei tidak ditemukan atau sudah dinonaktifkan.';
    case 'RUANGAN_NONAKTIF':
      return 'Ruangan tidak ditemukan atau sudah dinonaktifkan.';
    case 'KELAS_NONAKTIF':
      return 'Kelas tidak ditemukan atau sudah dinonaktifkan.';
    case 'JADWAL_CONFLICT':
      return conflicts.length > 0
        ? `Bentrok dengan ${conflicts.length} jadwal lain. Periksa detail di bawah.`
        : detail;
    default:
      return detail;
  }
}

/** Bungkus hasil RPC supabase-js: null data + error -> lempar RpcError */
export function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw new RpcError(parseRpcError(error));
  return data as T;
}
