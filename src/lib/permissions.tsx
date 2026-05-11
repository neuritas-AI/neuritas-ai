import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";

export type Permissions = {
  can_manage_customers: boolean;
  can_manage_projects: boolean;
  can_manage_tasks: boolean;
  can_view_quotes: boolean;
  can_edit_quotes: boolean;
  can_view_invoices: boolean;
  can_edit_invoices: boolean;
};

const ALL_TRUE: Permissions = {
  can_manage_customers: true,
  can_manage_projects: true,
  can_manage_tasks: true,
  can_view_quotes: true,
  can_edit_quotes: true,
  can_view_invoices: true,
  can_edit_invoices: true,
};
const ALL_FALSE: Permissions = {
  can_manage_customers: false,
  can_manage_projects: false,
  can_manage_tasks: true,
  can_view_quotes: false,
  can_edit_quotes: false,
  can_view_invoices: false,
  can_edit_invoices: false,
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
