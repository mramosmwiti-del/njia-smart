import { toast } from "sonner";

export type ReportCsvInput = {
  /** Rows already scoped by client / tax type / assignee, before the status filter. */
  rows: { client: any; pol: any; cur: any; filed: boolean }[];
  statusFilter: "all" | "filed" | "not_filed";
  collabByReturn: Map<string, string[]>;
  staffMap: Map<string, string | null>;
  invoicesById: Map<string, any>;
};

// Builds and downloads the Filing Record as a CSV. The status is applied here
// explicitly so the "Not filed" button can never export Filed rows.
export function downloadReportCsv({ rows, statusFilter, collabByReturn, staffMap, invoicesById }: ReportCsvInput) {
  // Export from the same report data as the table, but apply the requested
  // status explicitly so the Not filed button can never export Filed rows.
  const rowsToExport = rows.filter(row =>
    statusFilter === "all" || (statusFilter === "filed" ? row.filed : !row.filed)
  );

  if (rowsToExport.length === 0) {
    const statusLabel = statusFilter === "not_filed" ? "not-filed" : statusFilter;
    toast.error(`There are no ${statusLabel} tax filing records to download for the selected filters.`);
    return;
  }

  const columns = [
    { header: "Client", value: (row: any) => row.client.company_name },
    { header: "Tax type", value: (row: any) => row.pol.label },
    { header: "Status", value: (row: any) => row.filed ? "Filed" : "Not filed" },
    { header: "Period ending", value: (row: any) => row.cur?.period_end },
    { header: "Due date", value: (row: any) => row.cur?.due_date },
    { header: "Assigned to", value: (row: any) => {
      const ids = row.cur ? [...new Set([row.cur.assigned_to, ...(collabByReturn.get(row.cur.id) ?? [])].filter(Boolean) as string[])] : [];
      return ids.map(id => staffMap.get(id) ?? "Unknown").join("; ");
    } },
    { header: "Invoice ID", value: (row: any) => {
      const invoice = row.cur?.invoice_id ? invoicesById.get(row.cur.invoice_id) : null;
      return invoice?.invoice_number ?? row.cur?.invoice_id ?? "";
    } },
    { header: "Invoice amount", value: (row: any) => {
      const invoice = row.cur?.invoice_id ? invoicesById.get(row.cur.invoice_id) : null;
      return invoice?.total ?? "";
    } },
  ];

  // Quote every cell and neutralize spreadsheet formula prefixes in user-entered values.
  const csvCell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = "\uFEFF" + [
    columns.map(column => column.header),
    ...rowsToExport.map(row => columns.map(column => column.value(row))),
  ].map(line => line.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  const statusSuffix = statusFilter === "not_filed" ? "not-filed" : statusFilter;
  link.download = `tax-filing-${statusSuffix}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const statusLabel = statusFilter === "not_filed" ? "Not filed" : statusFilter === "filed" ? "Filed" : "all";
  toast.success(`Downloaded ${rowsToExport.length} ${statusLabel.toLowerCase()} record${rowsToExport.length === 1 ? "" : "s"} as an 8-column CSV.`);
}
