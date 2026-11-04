import { FileText, Eye, Download } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { ServiceModuleCtx } from "./use-service-module";

export function DocumentsSection({ ctx }: { ctx: ServiceModuleCtx }) {
  const { tab, docs, viewDoc, downloadDoc, moduleLabel } = ctx;
  return (
    <>
      {tab === "documents" && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <tr><th className="py-2 px-3">Title</th><th>Client</th><th>Uploaded</th><th></th></tr>
              </thead>
              <tbody>
                {docs.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No client documents for {moduleLabel} clients yet. Project-level documents live inside each project's workspace.</td></tr>}
                {docs.map(d => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 inline-flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.title}</td>
                    <td>{d.clients?.company_name}</td>
                    <td className="text-xs text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="text-right pr-3 space-x-2 whitespace-nowrap">
                      <button onClick={() => viewDoc(d.file_path, d.title)} className="text-primary text-xs inline-flex items-center gap-1"><Eye className="h-3 w-3" />View</button>
                      <button onClick={() => downloadDoc(d.file_path)} className="text-primary text-xs inline-flex items-center gap-1"><Download className="h-3 w-3" />Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
