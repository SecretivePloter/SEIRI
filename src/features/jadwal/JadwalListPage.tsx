// JadwalListPage — daftar semua jadwal slot (one-off & rutin) dengan filter
// status + pencarian. Aksi: edit (via form), nonaktifkan, hapus (ConfirmDialog).

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge, JenisBadge, LokasiBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MultiSelect, ResetFiltersButton } from '@/components/ui/MultiSelect';
import { listJadwalSlot, deleteJadwalSlot, setStatusSlot } from '@/lib/api/jadwal';
import { listSensei } from '@/lib/api/sensei';
import { useAsyncData } from '@/app/useAsyncData';
import type { JadwalSlot, StatusSlot, JenisKelas } from '@/lib/types/domain';
import { JENIS_KELAS_LIST } from '@/lib/types/domain';
import { formatJam, formatTanggalPendek } from '@/lib/time';
import { toast } from '@/stores/toastStore';
import { RpcError } from '@/lib/api/rpcError';
import { useIsAdmin } from '@/stores/authStore';

export function JadwalListPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [statusFilter, setStatusFilter] = useState<StatusSlot | 'semua'>('aktif');
  const [jenisFilter, setJenisFilter] = useState<JenisKelas[]>([]);
  const [senseiFilter, setSenseiFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'hapus' | 'nonaktifkan'; slot: JadwalSlot } | null>(null);
  const [busy, setBusy] = useState(false);

  const senseiQ = useAsyncData(() => listSensei(), []);

  const q = useAsyncData(
    () => listJadwalSlot(statusFilter === 'semua' ? undefined : { status: statusFilter }),
    [statusFilter],
  );

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const s = search.toLowerCase();
    return list.filter((j) => {
      if (jenisFilter.length > 0 && !jenisFilter.includes(j.kelas?.jenis as JenisKelas)) return false;
      if (senseiFilter.length > 0 && !senseiFilter.includes(j.sensei_id)) return false;
      if (s) {
        const hay = `${j.kelas?.nama_kelas ?? ''} ${j.sensei?.nama ?? ''} ${j.ruangan?.nama ?? ''} ${j.alamat_tujuan ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [q.data, search, jenisFilter, senseiFilter]);

  const hasActiveFilters =
    jenisFilter.length > 0 || senseiFilter.length > 0 || search !== '' || statusFilter !== 'aktif';
  const resetFilters = () => {
    setJenisFilter([]);
    setSenseiFilter([]);
    setSearch('');
    setStatusFilter('aktif');
  };

  const jadwalLabel = (j: JadwalSlot) =>
    j.tanggal ? formatTanggalPendek(j.tanggal) : (j.hari_rutin ?? []).join(', ');

  const eksekusi = async (checked: boolean) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'hapus') {
        await deleteJadwalSlot(confirm.slot.id);
        toast.success('Jadwal dihapus');
      } else {
        await setStatusSlot(confirm.slot.id, 'tidak_aktif');
        toast.success('Jadwal dinonaktifkan', checked ? 'Jadwal mendatang juga ditandai tidak aktif' : undefined);
      }
      setConfirm(null);
      void q.reload();
    } catch (e) {
      toast.error('Aksi gagal', e instanceof RpcError ? e.message : e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<JadwalSlot>[] = [
    {
      key: 'kelas',
      header: 'Kelas',
      render: (j) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-body-md text-body-md text-on-surface">{j.kelas?.nama_kelas ?? '-'}</p>
            {j.kelas && <JenisBadge jenis={j.kelas.jenis} />}
          </div>
          <p className="font-label-sm text-label-sm text-secondary">{jadwalLabel(j)}</p>
        </div>
      ),
    },
    {
      key: 'sensei',
      header: 'Sensei',
      render: (j) => <span className="font-body-md text-body-md text-on-surface">{j.sensei?.nama ?? '-'}</span>,
    },
    {
      key: 'jam',
      header: 'Jam',
      render: (j) => (
        <span className="whitespace-nowrap font-body-md text-body-md text-on-surface">
          {formatJam(j.jam_mulai)}-{formatJam(j.jam_selesai)}
        </span>
      ),
    },
    {
      key: 'lokasi',
      header: 'Lokasi',
      render: (j) => <LokasiBadge tipe={j.tipe_lokasi} nama={j.ruangan?.nama} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (j) => <StatusBadge status={j.status} />,
    },
    {
      key: 'aksi',
      header: '',
      render: (j) =>
        isAdmin ? (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => navigate(`/jadwal/${j.id}/edit`)}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-primary"
              aria-label="Edit jadwal"
            >
              <Icon name="edit" size={18} />
            </button>
            {j.status === 'aktif' && (
              <button
                onClick={() => setConfirm({ kind: 'nonaktifkan', slot: j })}
                className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
                aria-label="Nonaktifkan jadwal"
              >
                <Icon name="event_busy" size={18} />
              </button>
            )}
            <button
              onClick={() => setConfirm({ kind: 'hapus', slot: j })}
              className="rounded p-1.5 text-secondary hover:bg-surface-container hover:text-error"
              aria-label="Hapus jadwal"
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <TopBar
        title="Jadwal"
        subtitle={`${rows.length} slot`}
        actions={
          isAdmin && (
            <Link to="/jadwal/new">
              <Button>
                <Icon name="add" size={16} /> New Schedule
              </Button>
            </Link>
          )
        }
      />
      <main className="flex-1 overflow-y-auto p-container-padding">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MultiSelect<JenisKelas>
                label="Jenis kelas"
                options={JENIS_KELAS_LIST.map((j) => ({ value: j, label: j }))}
                selected={jenisFilter}
                onToggle={(j) =>
                  setJenisFilter((cur) => (cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j]))
                }
              />
              <MultiSelect<string>
                label="Sensei"
                options={(senseiQ.data ?? []).map((s) => ({ value: s.id, label: s.nama }))}
                selected={senseiFilter}
                onToggle={(id) =>
                  setSenseiFilter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
                }
              />
              <div>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusSlot | 'semua')}>
                  <option value="aktif">Aktif</option>
                  <option value="planning">Planning</option>
                  <option value="tidak_aktif">Tidak aktif</option>
                  <option value="semua">Semua status</option>
                </Select>
              </div>
              <ResetFiltersButton onClick={resetFilters} visible={hasActiveFilters} />
            </div>
            <div className="relative w-full sm:w-72">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <Input className="pl-9" placeholder="Cari kelas/sensei/lokasi..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest">
            {q.loading ? (
              <LoadingState label="Memuat jadwal..." />
            ) : q.error ? (
              <ErrorState message={q.error} onRetry={() => void q.reload()} />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(j) => j.id}
                empty={
                  <EmptyState
                    icon="event_note"
                    title="Belum ada jadwal"
                    description={statusFilter !== 'semua' ? 'Coba ubah filter status.' : 'Buat jadwal pertama lewat tombol New Schedule.'}
                  />
                }
              />
            )}
          </div>

          <p className="font-label-sm text-label-sm text-secondary">
            Menonaktifkan/menghapus slot rutin memengaruhi seluruh pengulangan mingguannya. Riwayat tanggal yang sudah lewat tetap
            terhitung di dashboard.
          </p>
        </div>
      </main>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={(checked) => void eksekusi(checked)}
        title={confirm?.kind === 'hapus' ? 'Hapus jadwal permanen?' : 'Nonaktifkan jadwal?'}
        description={
          confirm?.kind === 'hapus'
            ? `Slot "${confirm?.slot.kelas?.nama_kelas ?? ''}" akan dihapus permanen. Aksi ini tidak bisa dibatalkan.`
            : `Slot "${confirm?.slot.kelas?.nama_kelas ?? ''}" tidak akan muncul lagi di timeline aktif dan tidak dihitung dalam jam mengajar.`
        }
        confirmLabel={confirm?.kind === 'hapus' ? 'Hapus permanen' : 'Nonaktifkan'}
        danger={confirm?.kind === 'hapus'}
        busy={busy}
      />
    </>
  );
}
