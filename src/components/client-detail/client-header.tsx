import { ArrowLeft, Pencil, Trash2, Eye, EyeOff, Check, X, Pause, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { LastUpdated } from "@/components/last-updated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Info } from "./helpers";
import type { ClientDetailCtx } from "./use-client-detail";

export function ClientHeader({ ctx }: { ctx: ClientDetailCtx }) {
  const { isAdmin, client, showPwd, setShowPwd, editPwd, setEditPwd, pwdValue, setPwdValue, pwdBusy, updaterName, recordUpdaterName, setPaused, openEdit, deleteClient, savePassword, isIndividual, displayName } = ctx;
  return (
    <>
      <Link to="/clients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to clients</Link>
      <div className="bg-card border rounded-lg p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{isIndividual ? "individual" : "company"}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground space-x-3">
              {client.kra_pin && <span>KRA: <span className="font-mono">{client.kra_pin}</span></span>}
              {(client as any).id_number && <span>· ID: <span className="font-mono">{(client as any).id_number}</span></span>}
              {client.industry && <span>· {client.industry}</span>}
              {client.engagement_type && <span>· {client.engagement_type}</span>}
            </div>
            <LastUpdated at={(client as any).updated_at} byName={recordUpdaterName} className="block mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused(!(client as any).is_paused)}
              className={`h-9 px-3 rounded-md border text-sm font-medium inline-flex items-center gap-1.5 ${
                (client as any).is_paused
                  ? "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/70"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
              }`}
              title={(client as any).is_paused ? "Click to mark active" : "Click to mark inactive"}
            >
              {(client as any).is_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {(client as any).is_paused ? "Inactive" : "Active"}
            </button>
            <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this client?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes <strong>{displayName}</strong>. Related records may also be affected. Cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteClient}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <Info label="Email" value={client.email} />
          <Info label="Phone" value={client.phone} />
          <div>
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Portal password</span>
              {!editPwd && (
                <button type="button" onClick={()=>{ setPwdValue(""); setEditPwd(true); setShowPwd(true); }} className="text-muted-foreground hover:text-foreground" aria-label="Set password">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {editPwd ? (
              <div className="mt-1 flex items-center gap-1">
                <Input type={showPwd ? "text" : "password"} value={pwdValue} onChange={e=>setPwdValue(e.target.value)} placeholder="New password (blank to clear)" className="h-8 font-mono" autoFocus />
                <button type="button" onClick={()=>setShowPwd(s=>!s)} className="text-muted-foreground hover:text-foreground p-1" aria-label={showPwd ? "Hide" : "Show"}>
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={savePassword} disabled={pwdBusy} className="text-emerald-600 hover:text-emerald-700 p-1" aria-label="Save"><Check className="h-4 w-4" /></button>
                <button type="button" onClick={()=>{ setEditPwd(false); setPwdValue(""); }} className="text-muted-foreground hover:text-foreground p-1" aria-label="Cancel"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="font-medium font-mono text-xs text-muted-foreground">
                {(client as any).portal_password_updated_at ? "Set (hashed — not viewable)" : <span className="font-sans">—</span>}
              </div>
            )}
            {(client as any).portal_password_updated_at && (
              <div className="text-[11px] text-muted-foreground mt-1">
                Updated {formatDate((client as any).portal_password_updated_at)}{updaterName ? ` by ${updaterName}` : ""}
              </div>
            )}
          </div>
        </div>
        {client.notes && <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</div>}
      </div>
    </>
  );
}
