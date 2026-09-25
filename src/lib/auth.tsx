import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  canCreate as _canCreate,
  canDelete as _canDelete,
  canUse as _canUse,
  canView as _canView,
  getModuleAccess as _getModuleAccess,
  isAssignedOnly as _isAssignedOnly,
  isLeaveApprover as _isLeaveApprover,
  type AccessLevel,
  type ModuleKey,
} from "@/lib/permissions";

export type AppRole =
  | "director" | "admin" | "audit_manager" | "tax_consultant"
  | "advisory_officer" | "accountant" | "accounts_assistant" | "intern"
  | "marketing" | "tax_assistant" | "audit_assistant" | "internal_admin";

interface AuthState {
  user: User | admin;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isLeaveApprover: boolean;
  signOut: () => Promise<void>;
  /** Highest access level the current user has on a module. */
  access: (moduleKey: ModuleKey) => AccessLevel;
  /** Whether the module should be visible to the current user at all. */
  canView: (moduleKey: ModuleKey) => boolean;
  /** Whether the user only sees records assigned to them for this module. */
  isAssignedOnly: (moduleKey: ModuleKey) => boolean;
  canCreate: (moduleKey: ModuleKey) => boolean;
  canUse: (moduleKey: ModuleKey) => boolean;
  /** Delete requires ownership of the record, unless the user is an admin/director. */
  canDelete: (moduleKey: ModuleKey, record: { createdBy?: string | null }) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadRoles(s.user.id), 0);
      else setRoles([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRoles(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r: any) => r.role));
  }

  const uid = session?.user?.id ?? null;
  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isAdmin: roles.includes("director") || roles.includes("admin"),
    isLeaveApprover: _isLeaveApprover(roles),
    signOut: async () => { await supabase.auth.signOut(); },
    access: (moduleKey) => _getModuleAccess(roles, moduleKey),
    canView: (moduleKey) => _canView(roles, moduleKey),
    isAssignedOnly: (moduleKey) => _isAssignedOnly(roles, moduleKey),
    canCreate: (moduleKey) => _canCreate(roles, moduleKey),
    canUse: (moduleKey) => _canUse(roles, moduleKey),
    canDelete: (moduleKey, record) => _canDelete(roles, moduleKey, record, uid),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  director: "Director",
  admin: "Admin",
  audit_manager: "Audit Manager",
  tax_consultant: "Tax Consultant",
  advisory_officer: "Advisory Officer",
  accountant: "Accountant",
  accounts_assistant: "Accounts Assistant",
  intern: "Intern",
  marketing: "Marketing",
  tax_assistant: "Tax Assistant",
  audit_assistant: "Audit Assistant",
  internal_admin: "Internal Admin",
};
