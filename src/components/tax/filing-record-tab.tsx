import { AlertTriangle, LayoutGrid, Check, Download, Upload, FileText, Trash2, Receipt } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { filingOpenDate } from "@/lib/tax-period";
import { ChecklistChip } from "./checklist-cells";
import type { TaxCtx } from "./use-tax-page";

export function FilingRecordTab({ ctx }: { ctx: TaxCtx }) {
  const { isAdmin, clients, staff, collabByReturn, documentsByReturn, uploadingReceipt, setBatchFor, pickedReturns, setPickedReturns, clientFilter, setClientFilter, reportType, setReportType, reportFilter, setReportFilter, reportAssignee, setReportAssignee, clearRecordsClientId, setClearRecordsClientId, clearingRecords, activePolicies, staffMap, assigneeScopedReportRows, groupedFilteredReportRows, reportFileable, toggleReportPick, downloadReportCsv, clearClientFilingRecords, uploadReceipt, downloadReceipt } = ctx;
  return (
    <>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Tax type</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                <option value="">All types</option>
                {activePolicies.map(p => <option key={p.tax_type} value={p.tax_type}>{p.label}</option>)}
              </select>
            </div>
            <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Assigned to</label>
              <select value={reportAssignee} onChange={e => setReportAssignee(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                <option value="">All assignees</option>
                <option value="__unassigned__">Unassigned</option>
                {staff.map(person => <option key={person.id} value={person.id}>{person.full_name || "Unnamed staff"}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 p-2">
                <select
                  value={clearRecordsClientId}
                  onChange={e => setClearRecordsClientId(e.target.value)}
                  disabled={clearingRecords}
                  aria-label="Select a client or all clients whose filing records to clear"
                  className="h-9 min-w-[190px] rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Clear records for client…</option>
                  <option value="__all__">All clients — clear all filing records</option>
                  {[...clients].sort((a: any, b: any) => (a.company_name || "").localeCompare(b.company_name || "", undefined, { sensitivity: "base", numeric: true })).map((client: any) => (
                    <option key={client.id} value={client.id}>{client.company_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={clearClientFilingRecords}
                  disabled={!clearRecordsClientId || clearingRecords}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> {clearingRecords ? "Clearing…" : "Clear filing records"}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 ml-auto">
              <ChecklistChip active={reportFilter === "all"} onClick={() => setReportFilter("all")} icon={LayoutGrid} label="All" value={assigneeScopedReportRows.length} tone="muted" />
              <ChecklistChip active={reportFilter === "filed"} onClick={() => setReportFilter("filed")} icon={Check} label="Filed" value={assigneeScopedReportRows.filter(r => r.filed).length} tone="muted" />
              <ChecklistChip active={reportFilter === "not_filed"} onClick={() => setReportFilter("not_filed")} icon={AlertTriangle} label="Not filed" value={assigneeScopedReportRows.filter(r => !r.filed).length} tone="destructive" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadReportCsv("all")} disabled={assigneeScopedReportRows.length === 0} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> Download All ({assigneeScopedReportRows.length})
              </button>
              <button type="button" onClick={() => downloadReportCsv("filed")} disabled={!assigneeScopedReportRows.some(row => row.filed)} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> Download Filed ({assigneeScopedReportRows.filter(row => row.filed).length})
              </button>
              <button type="button" onClick={() => downloadReportCsv("not_filed")} disabled={!assigneeScopedReportRows.some(row => !row.filed)} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> Download Not Filed ({assigneeScopedReportRows.filter(row => !row.filed).length})
              </button>
            </div>
          </div>

          <div className="bg-card border rounded-lg max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1060px] table-fixed text-xs">
              <thead className="bg-muted text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="sticky top-0 left-0 z-40 w-[135px] bg-muted py-2 px-2 whitespace-normal break-words">Client</th>
                  <th className="sticky top-0 z-30 w-[125px] bg-muted py-2 px-2 whitespace-normal break-words">Tax type / obligation</th>
                  <th className="sticky top-0 z-30 w-[82px] bg-muted py-2 px-1.5 whitespace-normal break-words">Status</th>
                  <th className="sticky top-0 z-30 w-[90px] bg-muted py-2 px-1.5 whitespace-normal break-words">Period ending</th>
                  <th className="sticky top-0 z-30 w-[85px] bg-muted py-2 px-1.5 whitespace-normal break-words">Due date</th>
                  <th className="sticky top-0 z-30 w-[125px] bg-muted py-2 px-1.5 whitespace-normal break-words">Assigned to</th>
                  <th className="sticky top-0 z-30 w-[105px] bg-muted py-2 px-1.5 whitespace-normal break-words">Filed on</th>
                  <th className="sticky top-0 z-30 w-[180px] bg-muted py-2 px-1.5 whitespace-normal break-words">Receipt / proof</th>
                  <th className="sticky top-0 z-30 w-[140px] bg-muted py-2 px-1.5 whitespace-normal break-words text-right">File selected</th>
                </tr>
              </thead>
              <tbody>
                {groupedFilteredReportRows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No obligations match this view.</td></tr>}
                {groupedFilteredReportRows.map(group => {
                  const selectable = group.rows.filter(reportFileable).map(r => r.cur.id as string);
                  const ids = (pickedReturns[group.client.id] ?? []).filter(id => selectable.includes(id));
                  return (
                  <tr key={group.key} className="border-b last:border-0 hover:bg-muted/20 align-top">
                    <td className="sticky left-0 z-10 bg-card py-2 px-2 font-medium whitespace-normal break-words align-top">{group.client.company_name}</td>
                    <td className="py-1.5 px-2 align-top">
                      <div className="divide-y divide-border/70">
                        {group.rows.map(row => {
                          const canPick = reportFileable(row);
                          return (
                            <div key={row.key} className="min-h-10 py-2 whitespace-normal break-words font-medium">
                              <label
                                className={`inline-flex items-start gap-1.5 ${canPick ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
                                title={row.filed ? "Filed and closed" : !row.cur ? "No filing period yet" : !canPick ? `Opens for filing on ${formatDate(filingOpenDate(row.cur.due_date, row.pol.cadence))}` : "Tick to file with this client's other obligations"}
                              >
                                <input type="checkbox" className="mt-0.5" disabled={!canPick} checked={canPick && ids.includes(row.cur.id)} onChange={e => toggleReportPick(group.client.id, row.cur.id, e.target.checked)} />
                                <span>{row.pol.label}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-1.5 px-1.5 align-top">
                      <div className="divide-y divide-border/70">
                        {group.rows.map(row => <div key={row.key} className="min-h-10 py-2">
                          {row.filed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"><Check className="h-3 w-3 shrink-0" /> Filed</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">Not filed</span>
                          )}
                        </div>)}
                      </div>
                    </td>
                    <td className="py-1.5 px-1.5 align-top"><div className="divide-y divide-border/70">{group.rows.map(row => <div key={row.key} className="min-h-10 py-2 whitespace-normal break-words">{row.cur?.period_end ? formatDate(row.cur.period_end) : "—"}</div>)}</div></td>
                    <td className="py-1.5 px-1.5 align-top"><div className="divide-y divide-border/70">{group.rows.map(row => <div key={row.key} className="min-h-10 py-2 whitespace-normal break-words">{row.cur?.due_date ? formatDate(row.cur.due_date) : "—"}</div>)}</div></td>
                    <td className="py-1.5 px-1.5 align-top">
                      <div className="divide-y divide-border/70">{group.rows.map(row => <div key={row.key} className="min-h-10 py-2 whitespace-normal break-words">
                        {(() => {
                          const ids = [row.cur?.assigned_to, ...(row.cur ? collabByReturn.get(row.cur.id) ?? [] : [])].filter(Boolean) as string[];
                          const names = [...new Set(ids)].map(id => staffMap.get(id) ?? "Unknown");
                          return names.length ? names.join(", ") : <span className="text-muted-foreground">Unassigned</span>;
                        })()}
                      </div>)}</div>
                    </td>
                    <td className="py-1.5 px-1.5 align-top"><div className="divide-y divide-border/70">{group.rows.map(row => <div key={row.key} className="min-h-10 py-2 text-muted-foreground whitespace-normal break-words">
                      {row.filed && row.cur?.filed_at ? <><div>{formatDateTime(row.cur.filed_at)}</div>{row.cur.filed_by && staffMap.get(row.cur.filed_by) && <div className="text-[10px]">by {staffMap.get(row.cur.filed_by)}</div>}</> : "—"}
                    </div>)}</div></td>
                    <td className="py-1.5 px-1.5 align-top"><div className="divide-y divide-border/70">{group.rows.map(row => <div key={row.key} className="min-h-10 py-2 space-y-1.5 whitespace-normal break-words">
                      {row.cur ? <>
                        {(documentsByReturn.get(row.cur.id) ?? []).map((doc: any) => <button key={doc.id} type="button" onClick={() => downloadReceipt(doc.file_path)} className="flex items-start gap-1 text-left text-[11px] text-primary hover:underline max-w-full" title={doc.title}><FileText className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-all">{doc.title || "Filing receipt"}</span></button>)}
                        <label className={`inline-flex items-start gap-1 text-[11px] text-primary cursor-pointer hover:underline ${uploadingReceipt === row.cur.id ? "opacity-60" : ""}`}>
                          <Upload className="mt-0.5 h-3 w-3 shrink-0" /> <span>{uploadingReceipt === row.cur.id ? "Uploading…" : (documentsByReturn.get(row.cur.id)?.length ? "Add receipt" : "Upload receipt *")}</span>
                          <input type="file" className="hidden" disabled={uploadingReceipt === row.cur.id} onChange={e => { const file = e.target.files?.[0]; if (file) uploadReceipt(row.cur.id, row.client.id, file); e.currentTarget.value = ""; }} />
                        </label>
                      </> : <span className="text-muted-foreground">No filing period</span>}
                    </div>)}</div></td>
                    <td className="py-1.5 px-1.5 align-top text-right whitespace-nowrap">
                      {selectable.length > 0 && (
                        <div className="space-y-1">
                          <button
                            type="button"
                            disabled={ids.length === 0}
                            onClick={() => setBatchFor({ clientId: group.client.id, returnIds: ids })}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Receipt className="h-3.5 w-3.5" /> File selected ({ids.length})
                          </button>
                          <div>
                            <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline"
                              onClick={() => setPickedReturns(p => ({ ...p, [group.client.id]: ids.length === selectable.length ? [] : selectable }))}>
                              {ids.length === selectable.length ? "Clear" : "Select all open"}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Each client appears once, with their obligations and filing periods grouped together. Filter by type, client, or assignee above. A receipt/proof of submission must be uploaded before a return can be marked filed; click a receipt name to download it.</p>
        </div>
    </>
  );
}
