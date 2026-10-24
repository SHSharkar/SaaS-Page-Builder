import type { ReactNode } from "react";

export interface DataColumn<TRow> {
  readonly accessorKey: keyof TRow & string;
  readonly cell?: (row: TRow) => ReactNode;
  readonly header: string;
}

export interface DataTableProps<TRow> {
  readonly caption?: string;
  readonly columns: readonly DataColumn<TRow>[];
  readonly data: readonly TRow[];
  readonly emptyLabel: string;
  readonly rowKey?: (row: TRow, index: number) => string;
}

export function DataTable<TRow>({
  caption,
  columns,
  data,
  emptyLabel,
  rowKey,
}: DataTableProps<TRow>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border-subtle bg-card">
      <table className="w-full border-collapse text-left text-sm text-ink">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-border-subtle bg-muted">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-medium" key={column.accessorKey}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                className="px-4 py-6 text-center text-subtle"
                colSpan={Math.max(1, columns.length)}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                className="border-b border-border-subtle last:border-b-0"
                key={rowKey ? rowKey(row, index) : String(index)}
              >
                {columns.map((column) => (
                  <td className="px-4 py-3" key={column.accessorKey}>
                    {column.cell
                      ? column.cell(row)
                      : String(row[column.accessorKey] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
