import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Trash2, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { UserAvatar } from "@/components/UserAvatar";
import { useProfile, useProfiles } from "@/lib/profiles";
import { MentionInput } from "@/components/MentionInput";
import { renderMentions } from "@/lib/mention-render";


type Note = { id: string; user_id: string; content: string; created_at: string };

export function ProjectNotes({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { profiles: profileList } = useProfiles();
  const [items, setItems] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);


  async function load() {
    const { data } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Note[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`pn-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_notes", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  async function add() {
    if (!text.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("project_notes").insert({
      project_id: projectId,
      user_id: user.id,
      content: text.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  async function del(id: string) {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) return toast.error("Verwijderen mislukt");
    toast.success("Notitie verwijderd");
  }


  return (
    <Card className="p-4 shadow-soft">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 mb-3 lg:cursor-default"
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 grid place-items-center">
            <StickyNote className="h-4 w-4" />
          </div>
          <h3 className="font-display font-semibold text-sm">Team notities</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <span className="lg:hidden text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <div className={`${open ? "block" : "hidden"} lg:block space-y-3`}>
        <div className="space-y-2">
          <MentionInput
            rows={2}
            placeholder="Notitie voor je team… gebruik @ om iemand te taggen"
            value={text}
            onChange={setText}
            onSubmit={add}
            excludeIds={user ? [user.id] : []}
            className="text-sm"
          />
          <Button
            onClick={add}
            disabled={busy || !text.trim()}
            size="sm"
            className="w-full bg-gradient-brand border-0"
          >
            Plaatsen
          </Button>
        </div>

        <div className="space-y-2 max-h-[60vh] lg:max-h-[calc(100vh-320px)] overflow-y-auto pr-1 -mr-1">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nog geen notities</p>
          )}
          {items.map(n => (
            <div
              key={n.id}
              className="relative group rounded-md border border-amber-200/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start gap-2">
                <UserAvatar userId={n.user_id} size={28} />
                <div className="flex-1 min-w-0">
                  <NoteAuthor userId={n.user_id} />
                  <div className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words mt-1 text-foreground/90">
                    {renderMentions(n.content, profileList, { highlightSelf: user?.id })}
                  </div>
                </div>
                {(user?.id === n.user_id || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    onClick={() => setConfirmId(n.id)}
                    aria-label="Notitie verwijderen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notitie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ben je zeker dat je deze notitie wil verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmId) await del(confirmId);
                setConfirmId(null);
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
}

function NoteAuthor({ userId }: { userId: string }) {
  const p = useProfile(userId);
  return <div className="text-xs font-medium truncate">{p?.full_name ?? "Iemand"}</div>;
}

