// Lightweight presentational table. We deliberately don't depend on
// antd's <Table> here — it's heavy, hard to style consistently, and we
// only need a column-render + click-row contract for admin lists.
//
// Usage:
//   <DataTable
//     columns={[
//       { key: "name", label: "Name", render: (row) => <NameCell row={row} /> },
//       { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
//     ]}
//     rows={users}
//     onRowClick={(row) => router.push(`/dashboard/users/${row._id}`)}
//     empty="No users yet."
//   />

import cls from "../utils/cls";

export default function DataTable({
  columns,
  rows,
  loading = false,
  empty = "No results.",
  onRowClick,
  rowKey = (r) => r._id || r.id,
  className = "",
}) {
  if (loading) {
    return (
      <div className="overflow-hidden border border-ink-200 rounded-2xl bg-white shadow-card">
        <div className="divide-y divide-ink-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-5 py-3 flex items-center gap-3 animate-pulse"
            >
              <div className="h-3 w-32 bg-ink-100 rounded" />
              <div className="h-3 w-44 bg-ink-100 rounded" />
              <div className="ml-auto h-3 w-20 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!rows?.length) {
    return (
      <div className="border border-ink-200 rounded-2xl bg-white px-6 py-12 text-center text-sm text-ink-500">
        {empty}
      </div>
    );
  }
  return (
    <div className={cls("overflow-hidden border border-ink-200 rounded-2xl bg-white shadow-card", className)}>
      {/* Phones: each row becomes a stacked card (label / value). */}
      <ul className="md:hidden divide-y divide-ink-100">
        {rows.map((row, i) => (
          <li
            key={rowKey(row) || i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cls("px-4 py-3 space-y-1.5", onRowClick && "cursor-pointer active:bg-ink-50")}
          >
            {columns.map((c, ci) =>
              ci === 0 || !c.label ? (
                <div key={c.key} className={cls("min-w-0", ci === 0 && "font-medium")}>
                  {c.render ? c.render(row) : row[c.key]}
                </div>
              ) : (
                <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-xs uppercase tracking-wide text-ink-400 shrink-0 pt-0.5">{c.label}</span>
                  <span className="min-w-0 text-right">{c.render ? c.render(row) : row[c.key]}</span>
                </div>
              )
            )}
          </li>
        ))}
      </ul>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cls("px-5 py-3 font-semibold whitespace-nowrap", c.thClassName)}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row) || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cls(
                  "border-t border-ink-100 hover:bg-ink-50/60 transition",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cls("px-5 py-3 align-middle", c.tdClassName)}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
