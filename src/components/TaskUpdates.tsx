import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";
import { MentionInput } from "@/components/MentionInput";
import { renderMentions } from "@/lib/mention-render";
import { useProfiles } from "@/lib/profiles";

type Update = { id: string; user_id: string; content: string; created_at: string };

export function TaskUpdates({ taskId, profiles }: { taskId: string; profiles: any[] }) {
  const { user } = useAuth();
  const { profiles: profileList } = useProfiles();
  const [items, setItems] = useState<Update[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("task_updates").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
    setItems((data ?? []) as Update[]);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`tu-${taskId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_updates", filter: `task_id=eq.${taskId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId]);

  async function add() {
    if (!text.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("task_updates").insert({ task_id: taskId, user_id: user.id, content: text.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
  }
  async function del(id: string) {
    await supabase.from("task_updates").delete().eq("id", id);
  }

  return (
    <div className="space-y-2">
      <Label>Updates / voortgang</Label>
      <div className="flex gap-2">
        <div className="flex-1">
          <MentionInput
            rows={2}
            placeholder="Hou je team op de hoogte… gebruik @ om iemand te taggen"
            value={text}
            onChange={setText}
            onSubmit={add}
            excludeIds={user ? [user.id] : []}
          />
        </div>
        <Button onClick={add} disabled={busy || !text.trim()} className="bg-gradient-brand border-0 self-end">Update posten</Button>
      </div>
      <div className="border rounded-md max-h-52 overflow-y-auto divide-y">
        {items.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nog geen updates</p>}
        {items.map(u => {
          const p = profiles.find(x => x.id === u.user_id);
          return (
            <div key={u.id} className="p-2 text-sm flex gap-2">
              <UserAvatar profile={p} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{p?.full_name ?? "Iemand"}</span>
                  {" · "}{formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: nl })}
                </div>
                <div className="whitespace-pre-wrap break-words">{renderMentions(u.content, profileList, { highlightSelf: user?.id })}</div>
              </div>
              {user?.id === u.user_id && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => del(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
