import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { daysUntil, periodsOverdue, formatDate } from "@/lib/format";
import { filingOpenDate, isFilingOpen, todayNairobi } from "@/lib/tax-period";
import type { ChecklistClientRow } from "@/components/tax-client-checklist";
import { TABS, ALL_TYPES, todayISO, fetchAll } from "./tax-utils";
import { downloadReportCsv as exportReportCsv } from "./tax-csv";
import { clearClientFilingRecords as clearRecords } from "./tax-clear-records";
import { openClientFile } from "@/lib/client-files";

export function useTaxPage(search: { filter?: "open" }) {
  const { isAdmin, canCreate } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>(search.filter === "open" ? "Filing Record" : "Overview");
  const [policies, setPolicies] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [collabByReturn, setCollabByReturn] = useState<Map<string, string[]>>(new Map());
  const [documentsByReturn, setDocumentsByReturn] = useState<Map<string, any[]>>(new Map());
  const [invoicesById, setInvoicesById] = useState<Map<string, any>>(new Map());
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<{ id: string; clientId: string; clientName?: string | null; description: string; needsReceipt: boolean } | null>(null);
  const [batchFor, setBatchFor] = useState<{ clientId: string; returnIds: string[] } | null>(null);
  // Filing Record: obligations ticked per client, filed together with "File selected".
  const [pickedReturns, setPickedReturns] = useState<Record<string, string[]>>({});
  const [clientFilter, setClientFilter] = useState("");
  const [accFilter, setAccFilter] = useState<"all" | "overdue" | "duesoon" | "unassigned">("all");
  const [checklistType, setChecklistType] = useState<string>(ALL_TYPES);
  const [reportType, setReportType] = useState<string>("");
  const [annualYear, setAnnualYear] = useState<string>(todayNairobi().slice(0, 4));
  const [annualType, setAnnualType] = useState<string>("");
  const [reportFilter, setReportFilter] = useState<"all" | "filed" | "not_filed">(search.filter === "open" ? "not_filed" : "all");
  const [reportAssignee, setReportAssignee] = useState("");
  const [clearRecordsClientId, setClearRecordsClientId] = useState("");
  const [clearingRecords, setClearingRecords] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<"all" | "open" | "overdue" | "filed">("all");
  const attemptedSchedule = useRef<Set<string>>(new Set());
  const ensuredPeriodsMonth = useRef<string | null>(null);
  const [scheduleFailed, setScheduleFailed] = useState<Set<string>>(new Set());

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [p, r, c, o, s] = await Promise.all([
      supabase.from("tax_policies").select("*").order("sort_order"),
      fetchAll((a, b) => supabase.from("tax_returns")
        .select("id, client_id, return_type, status, due_date, period_start, period_end, assigned_to, assigned_at, assigned_by, filed_at, filed_by, invoice_id, renewed_to_id, notes, created_at, created_by")
        .order("due_date").order("id").range(a, b)),
      supabase.from("clients").select("id, company_name").order("company_name"),
      fetchAll((a, b) => supabase.from("client_tax_obligations").select("*").order("id").range(a, b)),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setPolicies((p.data as any[]) ?? []);
    setReturns(r);
    setClients(c.data ?? []);
    setStaff(s.data ?? []);
    setObligations(o as any[]);
    const invoiceIds = [...new Set((r as any[]).map((row: any) => row.invoice_id).filter(Boolean) as string[])];
    const invoiceRows = invoiceIds.length
      ? await fetchAll((a, b) => supabase.from("invoices").select("id, invoice_number, total").in("id", invoiceIds).order("id").range(a, b))
      : [];
    setInvoicesById(new Map((invoiceRows as any[]).map((invoice: any) => [invoice.id, invoice])));
    const returnIds = r.map((row: any) => row.id);
    const documentRows = returnIds.length
      ? await fetchAll((a, b) => supabase.from("documents").select("id, client_id, tax_return_id, title, file_path, uploaded_by, created_at").in("tax_return_id", returnIds).order("created_at", { ascending: false }).range(a, b))
      : [];
    const docsByReturn = new Map<string, any[]>();
    (documentRows as any[]).forEach((doc: any) => {
      if (!doc.tax_return_id) return;
      if (!docsByReturn.has(doc.tax_return_id)) docsByReturn.set(doc.tax_return_id, []);
      docsByReturn.get(doc.tax_return_id)!.push(doc);
    });
    setDocumentsByReturn(docsByReturn);
    const ca = await fetchAll((a, b) => supabase.from("tax_return_assignees" as any).select("id, tax_return_id, user_id").order("id").range(a, b));
    const cm = new Map<string, string[]>();
    (ca as any[]).forEach((c: any) => { if (!cm.has(c.tax_return_id)) cm.set(c.tax_return_id, []); cm.get(c.tax_return_id)!.push(c.user_id); });
    setCollabByReturn(cm);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useLiveRefresh(["tax_returns", "tax_return_assignees", "client_tax_obligations", "documents", "invoices"], () => load(true));

  const activePolicies = useMemo(() => policies.filter(p => p.active), [policies]);
  const currentFilingMonth = todayNairobi().slice(0, 7);

  // Ensure every monthly filing period through the current month has its own record,
  // even when an earlier period remains unfiled. The database fills only missing periods.
  useEffect(() => {
    if (loading || !canCreate("tax")) return;
    const month = todayNairobi().slice(0, 7);
    if (ensuredPeriodsMonth.current !== month) {
      ensuredPeriodsMonth.current = month;
      (async () => {
        const { error } = await supabase.rpc("ensure_current_tax_filing_periods" as any);
        if (error) {
          ensuredPeriodsMonth.current = null;
          toast.error(`Unable to prepare current filing periods: ${error.message}`);
          return;
        }
        await load(true);
      })();
      return;
    }
    const activeTypes = new Set(activePolicies.map(p => p.tax_type));
    const have = new Set(returns.map((r: any) => `${r.client_id}:${r.return_type}`));
    const missing = obligations.filter(o => {
      const k = `${o.client_id}:${o.tax_type}`;
      return o.active && activeTypes.has(o.tax_type) && !have.has(k) && !attemptedSchedule.current.has(k);
    });
    if (missing.length === 0) return;
    missing.forEach(o => attemptedSchedule.current.add(`${o.client_id}:${o.tax_type}`));
    (async () => {
      const failed: string[] = [];
      for (let i = 0; i < missing.length; i += 10) {
        await Promise.all(missing.slice(i, i + 10).map(async o => {
          const { error } = await supabase.rpc("set_client_tax_obligation", { _client_id: o.client_id, _tax_type: o.tax_type, _active: true });
          if (error) failed.push(`${o.client_id}:${o.tax_type}`);
        }));
      }
      if (failed.length) setScheduleFailed(prev => new Set([...prev, ...failed]));
      load(true);
    })();
  }, [loading, obligations, returns, activePolicies]);

  async function scheduleNow(clientId: string, taxType: string) {
    const { error } = await supabase.rpc("set_client_tax_obligation", { _client_id: clientId, _tax_type: taxType, _active: true });
    if (error) { toast.error(error.message); return; }
    setScheduleFailed(prev => { const n = new Set(prev); n.delete(`${clientId}:${taxType}`); return n; });
    load(true);
  }
  function renderMissing(clientId: string, taxType: string) {
    return scheduleFailed.has(`${clientId}:${taxType}`) ? (
      <button type="button" onClick={() => scheduleNow(clientId, taxType)} className="text-xs text-primary hover:underline">Not scheduled — schedule now</button>
    ) : (
      <span className="text-xs text-muted-foreground">Scheduling…</span>
    );
  }

  // Overview: clicking a tax type card (or its open / overdue / filed figure)
  // lists the matching returns underneath; clicking the same thing again closes it.
  function pickOverview(taxType: string, filter: "all" | "open" | "overdue" | "filed") {
    if (expandedType === taxType && overviewFilter === filter) { setExpandedType(null); return; }
    setExpandedType(taxType);
    setOverviewFilter(filter);
  }

  // Jump to the Filing Record tab showing only filed returns (with their
  // receipts) for this tax type, and for one client when a name is given.
  function goToFiledRecord(taxType: string, clientName?: string | null) {
    setReportType(taxType);
    setReportFilter("filed");
    setClientFilter(clientName ?? "");
    setTab("Filing Record");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Reset back to "All types" if the remembered selection is no longer a
  // valid active policy (e.g. it was deactivated elsewhere).
  useEffect(() => {
    if (checklistType === ALL_TYPES) return;
    if (activePolicies.length && !activePolicies.some(p => p.tax_type === checklistType)) {
      setChecklistType(ALL_TYPES);
    }
  }, [activePolicies]);

  const summary = useMemo(() => {
    const today = todayISO();
    return activePolicies.map(pol => {
      const rows = returns.filter(r => r.return_type === pol.tax_type);
      const open = rows.filter(r => r.status !== "filed");
      const overdue = open.filter(r => r.due_date && r.due_date < today).length;
      const filed = rows.length - open.length;
      const obligated = obligations.filter(o => o.tax_type === pol.tax_type && o.active).length;
      return { ...pol, open: open.length, overdue, filed, obligated };
    });
  }, [activePolicies, returns, obligations]);

  const obligationMap = useMemo(() => {
    const m = new Map<string, boolean>();
    obligations.forEach(o => m.set(`${o.client_id}:${o.tax_type}`, o.active));
    return m;
  }, [obligations]);

  const filteredClients = useMemo(
    () => clients.filter(c => !clientFilter || c.company_name?.toLowerCase().includes(clientFilter.toLowerCase())),
    [clients, clientFilter]
  );

  const staffMap = useMemo(() => new Map(staff.map((s: any) => [s.id, s.full_name])), [staff]);

  const returnsByKey = useMemo(() => {
    const m = new Map<string, any[]>();
    returns.forEach((r: any) => {
      const k = `${r.client_id}:${r.return_type}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  }, [returns]);

  // Prefer this month's filing period for the checklist. Older unfiled periods
  // remain visible in Filing Record without blocking work in the current month.
  function currentReturn(clientId: string, taxType: string) {
    const list = returnsByKey.get(`${clientId}:${taxType}`) ?? [];
    if (list.length === 0) return null;
    const currentMonth = list
      .filter(r => (r.due_date ?? "").slice(0, 7) === currentFilingMonth)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    if (currentMonth.length) return currentMonth[0];
    const open = list.filter(r => r.status !== "filed").sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    if (open.length) return open[0];
    return [...list].sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))[0];
  }

  // Accountability flags computed across ALL clients (not just the text
  // search) so the summary chips always reflect the true picture.
  const accStats = useMemo(() => {
    const overdue = new Set<string>();
    const duesoon = new Set<string>();
    const unassigned = new Set<string>();
    let overdueCells = 0, duesoonCells = 0, unassignedCells = 0;
    clients.forEach(c => {
      activePolicies.forEach(pol => {
        if (!obligationMap.get(`${c.id}:${pol.tax_type}`)) return;
        const cur = currentReturn(c.id, pol.tax_type);
        if (!cur || cur.status === "filed") return;
        const over = periodsOverdue(cur.due_date, pol.cadence);
        const d = daysUntil(cur.due_date);
        if (over >= 1) { overdue.add(c.id); overdueCells++; }
        else if (d !== null && d >= 0 && d <= 7) { duesoon.add(c.id); duesoonCells++; }
        if (!cur.assigned_to) { unassigned.add(c.id); unassignedCells++; }
      });
    });
    return { flagged: { overdue, duesoon, unassigned }, overdueCells, duesoonCells, unassignedCells };
  }, [clients, activePolicies, obligationMap, returnsByKey]);

  const obligatedClientCount = useMemo(
    () => clients.filter(c => activePolicies.some(p => obligationMap.get(`${c.id}:${p.tax_type}`))).length,
    [clients, activePolicies, obligationMap]
  );

  const displayClients = useMemo(() => {
    if (accFilter === "all") return filteredClients;
    const set = accStats.flagged[accFilter];
    return filteredClients.filter(c => set.has(c.id));
  }, [filteredClients, accFilter, accStats]);

  // One row per obligated client x type — the same source data as the
  // checklist, just flattened into a filed / not-filed report.
  const reportRows = useMemo(() => {
    const rows: { key: string; client: any; pol: any; cur: any; filed: boolean }[] = [];
    const scopedPolicies = reportType ? activePolicies.filter(p => p.tax_type === reportType) : activePolicies;
    filteredClients.forEach(c => {
      scopedPolicies.forEach(pol => {
        if (!obligationMap.get(`${c.id}:${pol.tax_type}`)) return;
        const list = returnsByKey.get(`${c.id}:${pol.tax_type}`) ?? [];
        // Every open period remains visible as Not filed, including overdue periods,
        // while each filed period remains as historical evidence.
        if (list.length === 0) {
          rows.push({ key: `${c.id}:${pol.tax_type}`, client: c, pol, cur: null, filed: false });
        }
        list.filter(r => r.status !== "filed")
          .sort((x, y) => (x.due_date ?? "").localeCompare(y.due_date ?? ""))
          .forEach(r => rows.push({ key: r.id, client: c, pol, cur: r, filed: false }));
        list.filter(r => r.status === "filed")
          .sort((x, y) => (y.filed_at ?? y.due_date ?? "").localeCompare(x.filed_at ?? x.due_date ?? ""))
          .forEach(r => rows.push({ key: r.id, client: c, pol, cur: r, filed: true }));
      });
    });
    return rows;
  }, [filteredClients, activePolicies, reportType, obligationMap, returnsByKey]);

  const assigneeScopedReportRows = useMemo(() => reportRows.filter(row => {
    if (!reportAssignee) return true;
    const assignedIds = row.cur
      ? [...new Set([row.cur.assigned_to, ...(collabByReturn.get(row.cur.id) ?? [])].filter(Boolean) as string[])]
      : [];
    if (reportAssignee === "__unassigned__") return assignedIds.length === 0;
    return assignedIds.includes(reportAssignee);
  }), [reportRows, reportAssignee, collabByReturn]);

  const filteredReportRows = useMemo(
    () => assigneeScopedReportRows.filter(row => reportFilter === "all" || (reportFilter === "filed" ? row.filed : !row.filed)),
    [assigneeScopedReportRows, reportFilter]
  );

  const groupedFilteredReportRows = useMemo(() => {
    const groups: { key: string; client: any; rows: typeof filteredReportRows }[] = [];
    const byClient = new Map<string, { key: string; client: any; rows: typeof filteredReportRows }>();
    filteredReportRows.forEach(row => {
      let group = byClient.get(row.client.id);
      if (!group) {
        group = { key: row.client.id, client: row.client, rows: [] };
        byClient.set(row.client.id, group);
        groups.push(group);
      }
      group.rows.push(row);
    });
    return groups;
  }, [filteredReportRows]);

  // Same rule as the Checklist tab: a period can be ticked once it is open for filing.
  const reportFileable = (row: { cur: any; filed: boolean; pol: any }) =>
    !!row.cur && !row.filed && isFilingOpen(row.cur.due_date, row.pol.cadence);
  const toggleReportPick = (clientId: string, returnId: string, on: boolean) =>
    setPickedReturns(p => {
      const set = new Set(p[clientId] ?? []);
      on ? set.add(returnId) : set.delete(returnId);
      return { ...p, [clientId]: [...set] };
    });

  // Annual view: one row per client, with every applicable obligation listed
  // and each calendar month showing the status for each obligation in the same order.
  const annualFilingRows = useMemo(() => {
    const rows: { key: string; client: any; obligations: { key: string; label: string; months: Map<string, any[]> }[] }[] = [];
    const scopedPolicies = annualType ? activePolicies.filter(p => p.tax_type === annualType) : activePolicies;
    filteredClients.forEach(client => {
      const obligations: { key: string; label: string; months: Map<string, any[]> }[] = [];
      scopedPolicies.forEach(pol => {
        if (!obligationMap.get(`${client.id}:${pol.tax_type}`)) return;
        const monthRows = new Map<string, any[]>();
        (returnsByKey.get(`${client.id}:${pol.tax_type}`) ?? []).forEach((record: any) => {
          if (!record.due_date || record.due_date.slice(0, 4) !== annualYear) return;
          const monthKey = record.due_date.slice(0, 7);
          if (!monthRows.has(monthKey)) monthRows.set(monthKey, []);
          monthRows.get(monthKey)!.push(record);
        });
        obligations.push({ key: `${client.id}:${pol.tax_type}`, label: pol.label, months: monthRows });
      });
      if (obligations.length) rows.push({ key: client.id, client, obligations });
    });
    return rows;
  }, [filteredClients, activePolicies, annualType, annualYear, obligationMap, returnsByKey]);

  const annualMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    key: `${annualYear}-${String(index + 1).padStart(2, "0")}`,
    label: new Date(Number(annualYear), index, 1).toLocaleString("en", { month: "short" }),
  })), [annualYear]);

  function annualMonthStatus(records: any[] | undefined) {
    if (!records?.length) return null;
    return records.every(record => record.status === "filed") ? "Filed" : "Not filed";
  }

  function downloadReportCsv(statusFilter: "all" | "filed" | "not_filed" = reportFilter) {
    exportReportCsv({ rows: assigneeScopedReportRows, statusFilter, collabByReturn, staffMap, invoicesById });
  }

  function clearClientFilingRecords() {
    return clearRecords({ isAdmin, clearRecordsClientId, clients, returns, documentsByReturn, setClearingRecords, setClearRecordsClientId, load });
  }

  async function uploadReceipt(returnId: string, clientId: string, file: File): Promise<boolean> {
    setUploadingReceipt(returnId);
    const { data: { user } } = await supabase.auth.getUser();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clientId}/tax-returns/${returnId}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from("client-documents").upload(path, file);
    if (upload.error) {
      toast.error(upload.error.message);
      setUploadingReceipt(null);
      return false;
    }
    const { error } = await supabase.from("documents").insert({
      client_id: clientId,
      tax_return_id: returnId,
      title: file.name,
      file_path: path,
      uploaded_by: user?.id ?? null,
    } as any);
    let ok = true;
    if (error) {
      await supabase.storage.from("client-documents").remove([path]);
      toast.error(error.message);
      ok = false;
    } else {
      toast.success("Filing receipt uploaded");
      await load(true);
    }
    setUploadingReceipt(null);
    return ok;
  }

  async function downloadReceipt(path: string) {
    await openClientFile(path);
  }

  async function toggleObligation(clientId: string, taxType: string, next: boolean) {
    const key = `${clientId}:${taxType}`;
    setBusyCell(key);
    const { error } = await supabase.rpc("set_client_tax_obligation", {
      _client_id: clientId, _tax_type: taxType, _active: next,
    });
    setBusyCell(null);
    if (error) toast.error(error.message);
    else load();
  }

  // Mark a filing filed (or reopen it) directly from the Checklist / Overview,
  // without needing to drill into the per-type page first.
  // `skipInvoice` is only passed by the invoice prompt below once it has
  // generated the invoice (and stored the receipt), so neither check repeats.
  async function markFiled(returnId: string, filed: boolean, skipInvoice = false) {
    // A filed period is closed: only Director/Admin can reopen it, and the next
    // period can't be filed until its own filing window opens.
    const target = returns.find((x: any) => x.id === returnId);
    if (!filed && target?.status === "filed" && !isAdmin) {
      toast.error("This period is already filed and closed. Only a Director or Admin can reopen it.");
      return;
    }
    if (filed && target && target.status !== "filed") {
      const cadence = policies.find((x: any) => x.tax_type === target.return_type)?.cadence;
      if (!isFilingOpen(target.due_date, cadence)) {
        toast.error(`This period opens for filing on ${formatDate(filingOpenDate(target.due_date, cadence))}.`);
        return;
      }
    }
    if (filed && !skipInvoice) {
      const r = returns.find((x: any) => x.id === returnId);
      const hasReceipt = !!(documentsByReturn.get(returnId)?.length);
      // Ticking "Filed" opens the mandatory prompt first: invoice amount, plus
      // the filing receipt if one hasn't been attached yet. Submitting it
      // registers the return as filed in one step.
      if (r && r.status !== "filed" && !r.invoice_id) {
        const c = clients.find((x: any) => x.id === r.client_id);
        const pol = policies.find((x: any) => x.tax_type === r.return_type);
        setInvoiceFor({
          id: returnId, clientId: r.client_id, clientName: c?.company_name,
          description: `${pol?.label ?? r.return_type} filing — period ending ${formatDate(r.period_end)}`,
          needsReceipt: !hasReceipt,
        });
        return;
      }
      // Invoice already exists but there's still no proof of submission.
      if (!hasReceipt) {
        toast.error("Upload the filing receipt in Tax → Filing Record before marking this return as filed.");
        setTab("Filing Record");
        return;
      }
    }
    setBusyCell(returnId);
    const { data, error } = await supabase.from("tax_returns").update({ status: filed ? "filed" : "pending" }).eq("id", returnId).select("id");
    setBusyCell(null);
    if (error) toast.error(error.message);
    else if (!data || data.length === 0) toast.error("You don't have permission to update this filing.");
    else { toast.success(filed ? "Marked filed — next period scheduled" : "Reopened"); load(true); }
  }

  // Checklist: ONE entry per client listing every obligation they hold (narrowed
  // to a single tax type when one is chosen). Obligations are added from the
  // client's own Tax tab, so un-obligated clients are never listed here.
  const checklistRows: ChecklistClientRow[] = displayClients
    .map(c => ({
      client: c,
      items: (checklistType === ALL_TYPES ? activePolicies : activePolicies.filter(p => p.tax_type === checklistType))
        .filter(pol => obligationMap.get(`${c.id}:${pol.tax_type}`))
        .map(pol => ({ pol, cur: currentReturn(c.id, pol.tax_type) })),
    }))
    .filter(r => r.items.length > 0);

  function stopObligation(clientId: string, pol: any, clientName: string) {
    if (confirm(`Stop the ${pol.label} obligation for ${clientName}? Open filings stay, but nothing new is scheduled.`)) {
      toggleObligation(clientId, pol.tax_type, false);
    }
  }

  return {
    isAdmin,
    canCreate,
    tab,
    setTab,
    policies,
    setPolicies,
    returns,
    setReturns,
    clients,
    setClients,
    staff,
    setStaff,
    obligations,
    setObligations,
    collabByReturn,
    setCollabByReturn,
    documentsByReturn,
    setDocumentsByReturn,
    invoicesById,
    setInvoicesById,
    uploadingReceipt,
    setUploadingReceipt,
    loading,
    setLoading,
    busyCell,
    setBusyCell,
    assignOpenId,
    setAssignOpenId,
    invoiceFor,
    setInvoiceFor,
    batchFor,
    setBatchFor,
    pickedReturns,
    setPickedReturns,
    clientFilter,
    setClientFilter,
    accFilter,
    setAccFilter,
    checklistType,
    setChecklistType,
    reportType,
    setReportType,
    annualYear,
    setAnnualYear,
    annualType,
    setAnnualType,
    reportFilter,
    setReportFilter,
    reportAssignee,
    setReportAssignee,
    clearRecordsClientId,
    setClearRecordsClientId,
    clearingRecords,
    setClearingRecords,
    expandedType,
    setExpandedType,
    overviewFilter,
    setOverviewFilter,
    attemptedSchedule,
    ensuredPeriodsMonth,
    scheduleFailed,
    setScheduleFailed,
    load,
    activePolicies,
    currentFilingMonth,
    scheduleNow,
    renderMissing,
    pickOverview,
    goToFiledRecord,
    summary,
    obligationMap,
    filteredClients,
    staffMap,
    returnsByKey,
    currentReturn,
    accStats,
    obligatedClientCount,
    displayClients,
    reportRows,
    assigneeScopedReportRows,
    filteredReportRows,
    groupedFilteredReportRows,
    reportFileable,
    toggleReportPick,
    annualFilingRows,
    annualMonths,
    annualMonthStatus,
    downloadReportCsv,
    clearClientFilingRecords,
    uploadReceipt,
    downloadReceipt,
    toggleObligation,
    markFiled,
    checklistRows,
    stopObligation,
  };
}

export type TaxCtx = ReturnType<typeof useTaxPage>;
