// ConfirmDialog — konfirmasi aksi merusak/non-reversibel (hapus, nonaktifkan
// dengan efek ke jadwal). Mendukung checkbox opsional utk flow
// "nonaktifkan + tandai jadwal mendatang jadi tidak_aktif" (asumsi #2).

import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  danger = false,
  checkboxLabel,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (checked: boolean) => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  checkboxLabel?: string;
  busy?: boolean;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={async () => {
              await onConfirm(checked);
              setChecked(false);
            }}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
      {checkboxLabel && (
        <label className="mt-4 flex items-start gap-2 rounded border border-border-soft bg-surface-container-low p-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 accent-[#102b8c]"
          />
          <span className="font-body-md text-body-md text-on-surface">{checkboxLabel}</span>
        </label>
      )}
    </Modal>
  );
}
