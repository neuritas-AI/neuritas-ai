import { useNavigate } from "@tanstack/react-router";
import { Plus, CheckSquare, Users, Calendar, FolderKanban, Receipt } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/lib/permissions";

export function QuickActionsFab() {
  const nav = useNavigate();
  const { perms } = usePermissions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Snelle actie"
          className="fixed bottom-5 right-5 h-14 w-14 rounded-full bg-gradient-brand text-white grid place-items-center shadow-brand hover:scale-105 transition-transform z-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-52">
        <DropdownMenuItem onClick={() => nav({ to: "/tasks" })}><CheckSquare className="h-4 w-4 mr-2" /> Nieuwe taak</DropdownMenuItem>
        <DropdownMenuItem onClick={() => nav({ to: "/projects" })}><FolderKanban className="h-4 w-4 mr-2" /> Nieuw project</DropdownMenuItem>
        <DropdownMenuItem onClick={() => nav({ to: "/customers" })}><Users className="h-4 w-4 mr-2" /> Nieuwe klant</DropdownMenuItem>
        <DropdownMenuItem onClick={() => nav({ to: "/calendar" })}><Calendar className="h-4 w-4 mr-2" /> Nieuwe afspraak</DropdownMenuItem>
        {(perms.can_edit_quotes || perms.can_edit_invoices) && (
          <DropdownMenuItem onClick={() => nav({ to: "/billing" })}><Receipt className="h-4 w-4 mr-2" /> Offerte / Factuur</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
