import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";

export type Permissions = {
  can_view_customers: boolean;
  can_edit_customers: boolean;
  can_view_projects: boolean;
  can_edit_projects: boolean;
  can_view_tasks: boolean;
  can_edit_tasks: boolean;
  can_view_calendar: boolean;
  can_manage_appointments: boolean;
  can_view_quotes: boolean;
  can_edit_quotes: boolean;
  can_view_invoices: boolean;
  can_edit_invoices: boolean;
  // legacy/compat
  can_manage_customers: boolean;
  can_manage_projects: boolean;
  can_manage_tasks: boolean;
};

export const PERMISSION_GROUPS: Array<{ label: string; perms: Array<{ key: keyof Permissions; label: string }> }> = [
  { label: "Klanten", perms: [
    { key: "can_view_customers", label: "Klanten bekijken" },
    { key: "can_edit_customers", label: "Klanten bewerken" },
  ]},
  { label: "Projecten", perms: [
    { key: "can_view_projects", label: "Projecten bekijken" },
    { key: "can_edit_projects", label: "Projecten bewerken" },
  ]},
  { label: "Taken", perms: [
    { key: "can_view_tasks", label: "Taken bekijken" },
    { key: "can_edit_tasks", label: "Taken bewerken" },
  ]},
  { label: "Agenda", perms: [
    { key: "can_view_calendar", label: "Agenda bekijken" },
    { key: "can_manage_appointments", label: "Afspraken beheren" },
  ]},
  { label: "Offertes", perms: [
    { key: "can_view_quotes", label: "Offertes bekijken" },
    { key: "can_edit_quotes", label: "Offertes bewerken" },
  ]},
  { label: "Facturen", perms: [
    { key: "can_view_invoices", label: "Facturen bekijken" },
    { key: "can_edit_invoices", label: "Facturen bewerken" },
  ]},
];

const ALL_TRUE: Permissions = {
  can_view_customers: true, can_edit_customers: true,
  can_view_projects: true, can_edit_projects: true,
  can_view_tasks: true, can_edit_tasks: true,
  can_view_calendar: true, can_manage_appointments: true,
  can_view_quotes: true, can_edit_quotes: true,
  can_view_invoices: true, can_edit_invoices: true,
  can_manage_customers: true, can_manage_projects: true, can_manage_tasks: true,
};
const ALL_FALSE: Permissions = {
  can_view_customers: false, can_edit_customers: false,
  can_view_projects: false, can_edit_projects: false,
  can_view_tasks: true, can_edit_tasks: true,
  can_view_calendar: false, can_manage_appointments: false,
  can_view_quotes: false, can_edit_quotes: false,
  can_view_invoices: false, can_edit_invoices: false,
  can_manage_customers: false, can_manage_projects: false, can_manage_tasks: true,
};

export function usePermissions(): { perms: Permissions; loading: boolean } {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const [perms, setPerms] = useState<Permissions>(ALL_FALSE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roleLoading) return;
    if (isAdmin) { setPerms(ALL_TRUE); setLoading(false); return; }
    supabase.from("user_permissions").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setPerms(data ? { ...ALL_FALSE, ...data } as Permissions : ALL_FALSE);
      setLoading(false);
    });
  }, [user, isAdmin, roleLoading]);

  return { perms, loading };
}
