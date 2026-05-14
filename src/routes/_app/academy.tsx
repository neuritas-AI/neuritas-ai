import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, ExternalLink, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export const Route = createFileRoute("/_app/academy")({ component: AcademyPage });

function AcademyPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  async function load() {
    const [{ data }, { data: pr }] = await Promise.all([
      supabase.from("ai_academy_items" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);
    setItems((data as any[]) ?? []);
    setProfiles(pr ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("aa-rt").on("postgres_changes", { event: "*", schema: "public", table: "ai_academy_items" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function del(item: any) {
    if (!confirm("Verwijderen?")) return;
    if (item.storage_path) await supabase.storage.from("files").remove([item.storage_path]);
    await supabase.from("ai_academy_items" as any).delete().eq("id", item.id);
    toast.success("Verwijderd");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold flex items-center gap-2"><BookOpen className="h-7 w-7 text-primary" /> AI Academy</h1>
          <p className="text-muted-foreground text-sm mt-1">Deel papers, inzichten en artikels met je team</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuw item</Button></DialogTrigger>
          <ItemDialog userId={user?.id ?? null} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <Card className="p-10 text-center text-muted-foreground col-span-full">Nog geen items — voeg je eerste paper of artikel toe.</Card>}
        {items.map(i => {
          const author = profiles.find(p => p.id === i.created_by);
          const canDel = isAdmin || i.created_by === user?.id;
          return (
            <Card key={i.id} className="p-5 hover:border-primary/40 hover:shadow-soft transition-all flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-brand-soft text-primary grid place-items-center shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold leading-tight">{i.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{author?.full_name ?? "Iemand"} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true, locale: nl })}</p>
                </div>
                {canDel && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
              {i.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{i.description}</p>}
              {i.importance && (
                <div className="mt-3 p-3 rounded-md bg-gradient-brand-soft border border-primary/10">
                  <div className="text-[10px] uppercase tracking-wide text-primary font-medium mb-1">Waarom is dit belangrijk?</div>
                  <p className="text-xs whitespace-pre-line">{i.importance}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                {i.storage_path && (
                  <Button size="sm" variant="outline" onClick={() => setPreview({ id: i.id, name: i.file_name, storage_path: i.storage_path, mime_type: i.file_mime })}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Bekijk PDF
                  </Button>
                )}
                {i.link && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={i.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open link
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function ItemDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", description: "", importance: "", link: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    if (!userId) return;
    setBusy(true);
    let storage_path: string | null = null;
    let file_name: string | null = null;
    let file_mime: string | null = null;
    if (file) {
      const path = `${userId}/academy/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("files").upload(path, file);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      storage_path = path; file_name = file.name; file_mime = file.type;
    }
    const { error } = await supabase.from("ai_academy_items" as any).insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      importance: form.importance.trim() || null,
      link: form.link.trim() || null,
      storage_path, file_name, file_mime,
      created_by: userId,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Toegevoegd");
    onClose();
  }

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nieuw academy item</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Bijv. Attention is all you need" /></div>
        <div><Label>Korte beschrijving</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Waarom is dit belangrijk?</Label><Textarea rows={3} value={form.importance} onChange={e => setForm({ ...form, importance: e.target.value })} placeholder="Wat moet je team hiervan onthouden?" /></div>
        <div><Label>Link (optioneel)</Label><Input type="url" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></div>
        <div>
          <Label>PDF / bestand (optioneel)</Label>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block text-sm mt-1" />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Annuleren</Button>
        <Button onClick={save} disabled={busy} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
