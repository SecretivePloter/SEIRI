// DataTable generik — header label-sm bg #F1F5F9, row 52px, hover #F8FAFC
// (DESIGN.md). Generic per kolom via definisi kolom deklaratif.

import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-thead">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`border-b border-border-soft px-4 py-3 text-left font-label-sm text-label-sm text-secondary ${c.headerClassName ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="h-[52px] border-b border-border-soft last:border-b-0 hover:bg-hover-row transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 font-body-md text-body-md text-on-surface ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
