import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, BookOpen, ExternalLink, FileText, Trash2, ArrowLeft,
  Sparkles, Megaphone, GraduationCap, Pencil, Search, Layers,
  Circle, CircleDot, CheckCircle2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_app/academy")({ component: AcademyPage });

type ProgressStatus = "not_started" | "in_progress" | "read";
type Progress = { item_id: string; user_id: string; status: ProgressStatus; current_page: number | null };

const STATUS_META: Record<ProgressStatus, { label: string; icon: any; dot: string; chip: string; ring: string }> = {
  not_started: {
    label: "Niet gestart",
    icon: Circle,
    dot: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground border-border",
    ring: "ring-border",
  },
  in_progress: {
    label: "Bezig",
    icon: CircleDot,
    dot: "bg-blue-500",
    chip: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
    ring: "ring-blue-500/40",
  },
  read: {
    label: "Gelezen",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    ring: "ring-emerald-500/40",
  },
};


type Category = {
  id: string; name: string; slug: string; icon: string | null;
  color: string | null; sort_order: number;
};

const ICON_MAP: Record<string, any> = {
  Sparkles, Megaphone, BookOpen, GraduationCap, Layers, FileText,
};
function CatIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && ICON_MAP[name]) || BookOpen;
  return <I className={className} />;
}

function AcademyPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [catDialog, setCatDialog] = useState<Category | "new" | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProgressStatus>("all");
  const [pagePromptItem, setPagePromptItem] = useState<any | null>(null);

  async function load() {
    const [{ data: c }, { data: i }, { data: pr }, { data: pg }] = await Promise.all([
      supabase.from("academy_categories" as any).select("*").order("sort_order").order("name"),
      supabase.from("ai_academy_items" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, avatar_url"),
      supabase.from("academy_progress" as any).select("item_id, user_id, status, current_page"),
    ]);
    setCats((c as any[]) ?? []);
    setItems((i as any[]) ?? []);
    setProfiles(pr ?? []);
    const allPg = ((pg as any[]) ?? []) as Progress[];
    setAllProgress(allPg);
    setProgress(user ? allPg.filter(p => p.user_id === user.id) : []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("aa-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_academy_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_categories" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_progress" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const progressByItem = useMemo(() => {
    const m: Record<string, Progress> = {};
    for (const p of progress) m[p.item_id] = p;
    return m;
  }, [progress]);

  function getStatus(itemId: string): ProgressStatus {
    return progressByItem[itemId]?.status ?? "not_started";
  }

  async function setItemStatus(item: any, status: ProgressStatus, currentPage?: number | null) {
    if (!user) return;
    const existing = progressByItem[item.id];
    const payload: any = {
      user_id: user.id,
      item_id: item.id,
      status,
      current_page: status === "in_progress" ? (currentPage ?? existing?.current_page ?? null) : null,
    };
    // Optimistic update
    setProgress(prev => {
      const others = prev.filter(p => p.item_id !== item.id);
      return [...others, { ...payload }];
    });
    const { error } = await supabase
      .from("academy_progress" as any)
      .upsert(payload, { onConflict: "user_id,item_id" });
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(STATUS_META[status].label);
    }
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) {
      const k = it.category_id ?? "_none";
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [items]);

  const stats = useMemo(() => {
    let read = 0, busy = 0;
    for (const it of items) {
      const s = progressByItem[it.id]?.status ?? "not_started";
      if (s === "read") read++;
      else if (s === "in_progress") busy++;
    }
    return { read, busy, not_started: items.length - read - busy, total: items.length };
  }, [items, progressByItem]);


  const active = cats.find(c => c.id === activeCat) ?? null;
  const filtered = useMemo(() => {
    let list = active ? items.filter(i => i.category_id === active.id) : items;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.title ?? "").toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.importance ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter(i => (progressByItem[i.id]?.status ?? "not_started") === statusFilter);
    }
    return list;
  }, [items, active, query, statusFilter, progressByItem]);


  async function delItem(item: any) {
    if (!confirm("Verwijderen?")) return;
    if (item.storage_path) await supabase.storage.from("files").remove([item.storage_path]);
    await supabase.from("ai_academy_items" as any).delete().eq("id", item.id);
    toast.success("Verwijderd");
  }
  async function delCat(c: Category) {
    if (!confirm(`Categorie '${c.name}' verwijderen? Items blijven bewaard zonder categorie.`)) return;
    const { error } = await supabase.from("academy_categories" as any).delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categorie verwijderd");
  }

  // ===== Detail view (categorie open) =====
  if (active) {
    const accent = active.color ?? "#6366f1";
    return (
      <div className="space-y-6">
        <div
          className="rounded-2xl border p-6 shadow-soft"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent}1a 0%, ${accent}06 60%, transparent 100%)`,
            borderColor: `${accent}44`,
          }}
        >
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => setActiveCat(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Alle categorieën
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-2xl grid place-items-center shadow-soft"
                style={{ backgroundColor: `${accent}22`, color: accent }}
              >
                <CatIcon name={active.icon} className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-semibold">{active.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} {filtered.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setCatDialog(active)}>
                  <Pencil className="h-4 w-4 mr-1" /> Bewerken
                </Button>
              )}
              <Dialog open={itemDialog} onOpenChange={setItemDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-brand border-0 shadow-brand">
                    <Plus className="h-4 w-4 mr-1" /> Nieuw item
                  </Button>
                </DialogTrigger>
                <ItemDialog
                  userId={user?.id ?? null}
                  categories={cats}
                  defaultCategoryId={active.id}
                  onClose={() => setItemDialog(false)}
                />
              </Dialog>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoeken in deze categorie…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground col-span-full">
              Nog geen items in deze categorie.
            </Card>
          )}
          {filtered.map(i => {
            const author = profiles.find(p => p.id === i.created_by);
            const canDel = isAdmin || i.created_by === user?.id;
            return (
              <Card key={i.id} className="p-5 hover:border-primary/40 hover:shadow-soft transition-all flex flex-col">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg grid place-items-center shrink-0"
                    style={{ backgroundColor: `${accent}1f`, color: accent }}
                  >
                    {i.storage_path ? <FileText className="h-5 w-5" /> : i.link ? <ExternalLink className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold leading-tight">{i.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {author?.full_name ?? "Iemand"} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true, locale: nl })}
                    </p>
                  </div>
                  {canDel && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delItem(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {i.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{i.description}</p>}
                {i.importance && (
                  <div
                    className="mt-3 p-3 rounded-md border"
                    style={{ backgroundColor: `${accent}10`, borderColor: `${accent}33` }}
                  >
                    <div className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: accent }}>
                      Waarom is dit belangrijk?
                    </div>
                    <p className="text-xs whitespace-pre-line">{i.importance}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                  {i.storage_path && (
                    <Button size="sm" variant="outline" onClick={() => setPreview({ id: i.id, name: i.file_name, storage_path: i.storage_path, mime_type: i.file_mime })}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Bekijk bestand
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
        {catDialog && catDialog !== "new" && (
          <CategoryDialog category={catDialog} userId={user?.id ?? null} onClose={() => setCatDialog(null)} />
        )}
      </div>
    );
  }

  // ===== Overzicht categorieën =====
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-brand-soft p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-brand text-white grid place-items-center shadow-brand">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-semibold">Academy</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Centrale kennisomgeving — kies een categorie om te starten
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setCatDialog("new")}>
              <Plus className="h-4 w-4 mr-1" /> Nieuwe categorie
            </Button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cats.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground col-span-full">
            Nog geen categorieën.
          </Card>
        )}
        {cats.map(c => {
          const accent = c.color ?? "#6366f1";
          const count = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className="group relative text-left rounded-2xl border bg-card p-6 shadow-soft hover:shadow-brand hover:-translate-y-0.5 transition-all overflow-hidden"
              style={{ borderColor: `${accent}33` }}
            >
              <div
                className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ backgroundImage: `linear-gradient(135deg, ${accent}14 0%, transparent 65%)` }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div
                  className="h-12 w-12 rounded-xl grid place-items-center shadow-soft"
                  style={{ backgroundColor: `${accent}22`, color: accent }}
                >
                  <CatIcon name={c.icon} className="h-6 w-6" />
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setCatDialog(c); }}
                      className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); delCat(c); }}
                      className="h-7 w-7 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                )}
              </div>
              <div className="relative mt-4">
                <h3 className="font-display font-semibold text-lg">{c.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {count} {count === 1 ? "item" : "items"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {catDialog && (
        <CategoryDialog
          category={catDialog === "new" ? null : catDialog}
          userId={user?.id ?? null}
          onClose={() => setCatDialog(null)}
        />
      )}
    </div>
  );
}

// ============== Item Dialog ==============
function ItemDialog({
  userId, categories, defaultCategoryId, onClose,
}: {
  userId: string | null;
  categories: Category[];
  defaultCategoryId?: string;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", description: "", importance: "", link: "",
    category_id: defaultCategoryId ?? categories[0]?.id ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    if (!form.category_id) return toast.error("Kies een categorie");
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
      category_id: form.category_id,
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
        <div>
          <Label>Categorie *</Label>
          <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Kies categorie" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Bijv. Attention is all you need" /></div>
        <div><Label>Korte beschrijving</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Waarom is dit belangrijk?</Label><Textarea rows={3} value={form.importance} onChange={e => setForm({ ...form, importance: e.target.value })} placeholder="Wat moet je team hiervan onthouden?" /></div>
        <div><Label>Link (optioneel)</Label><Input type="url" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></div>
        <div>
          <Label>Bestand (optioneel)</Label>
          <input ref={inputRef} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block text-sm mt-1" />
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

// ============== Category Dialog (admin) ==============
const ICON_OPTIONS = ["Sparkles", "Megaphone", "BookOpen", "GraduationCap", "Layers", "FileText"];
const COLOR_PRESETS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#6366f1"];

function CategoryDialog({
  category, userId, onClose,
}: {
  category: Category | null;
  userId: string | null;
  onClose: () => void;
}) {
  const editing = !!category;
  const [form, setForm] = useState({
    name: category?.name ?? "",
    icon: category?.icon ?? "BookOpen",
    color: category?.color ?? "#6366f1",
    sort_order: category?.sort_order ?? 50,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.name.trim()) return toast.error("Naam verplicht");
    setBusy(true);
    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (editing && category) {
      const { error } = await supabase.from("academy_categories" as any)
        .update({ name: form.name.trim(), icon: form.icon, color: form.color, sort_order: form.sort_order })
        .eq("id", category.id);
      if (error) { setBusy(false); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("academy_categories" as any).insert({
        name: form.name.trim(), slug, icon: form.icon, color: form.color,
        sort_order: form.sort_order, created_by: userId,
      } as any);
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false);
    toast.success(editing ? "Bijgewerkt" : "Categorie aangemaakt");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Categorie bewerken" : "Nieuwe categorie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Naam *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Bijv. Sales" />
          </div>
          <div>
            <Label>Icoon</Label>
            <div className="grid grid-cols-6 gap-2 mt-1">
              {ICON_OPTIONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={`h-10 rounded-lg border grid place-items-center transition-all ${form.icon === ic ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                >
                  <CatIcon name={ic} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Kleur</Label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                className="h-8 w-12 rounded cursor-pointer"
              />
            </div>
          </div>
          <div>
            <Label>Sorteervolgorde</Label>
            <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuleren</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-brand border-0">Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
