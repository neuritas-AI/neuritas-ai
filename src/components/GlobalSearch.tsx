import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Users, CheckSquare, Calendar, FolderKanban, Receipt, FileText } from "lucide-react";

type Result = { type: "customer"|"task"|"appointment"|"project"|"invoice"|"quote"; id: string; label: string; sub?: string };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const term = `%${q}%`;
    let cancelled = false;
    Promise.all([
      supabase.from("customers").select("id,name,company").or(`name.ilike.${term},company.ilike.${term}`).limit(5),
      supabase.from("tasks").select("id,title").ilike("title", term).limit(5),
      supabase.from("appointments").select("id,title,start_at").ilike("title", term).limit(5),
      supabase.from("projects").select("id,name,customers(name)").ilike("name", term).limit(5),
    ]).then(([c, t, a, p]) => {
      if (cancelled) return;
      const r: Result[] = [];
      (c.data ?? []).forEach((x: any) => r.push({ type: "customer", id: x.id, label: x.name, sub: x.company }));
      (p.data ?? []).forEach((x: any) => r.push({ type: "project", id: x.id, label: x.name, sub: x.customers?.name }));
      (t.data ?? []).forEach((x: any) => r.push({ type: "task", id: x.id, label: x.title }));
      (a.data ?? []).forEach((x: any) => r.push({ type: "appointment", id: x.id, label: x.title }));
      setResults(r);
    });
    return () => { cancelled = true; };
  }, [q]);

  function go(r: Result) {
    setOpen(false);
    if (r.type === "customer") nav({ to: "/customers/$id", params: { id: r.id } });
    else if (r.type === "project") nav({ to: "/projects/$id", params: { id: r.id } });
    else if (r.type === "task") nav({ to: "/tasks" });
    else nav({ to: "/calendar" });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 text-muted-foreground">
        <Search className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Zoeken…</span>
        <kbd className="hidden md:inline ml-2 text-[10px] bg-muted rounded px-1.5 py-0.5">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Zoek klanten, taken, afspraken…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>Geen resultaten</CommandEmpty>
          {results.filter(r => r.type === "customer").length > 0 && (
            <CommandGroup heading="Klanten">
              {results.filter(r => r.type === "customer").map(r => (
                <CommandItem key={r.id} onSelect={() => go(r)}><Users className="h-4 w-4 mr-2" />{r.label}{r.sub && <span className="text-muted-foreground ml-2 text-xs">{r.sub}</span>}</CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.filter(r => r.type === "project").length > 0 && (
            <CommandGroup heading="Projecten">
              {results.filter(r => r.type === "project").map(r => (
                <CommandItem key={r.id} onSelect={() => go(r)}><FolderKanban className="h-4 w-4 mr-2" />{r.label}{r.sub && <span className="text-muted-foreground ml-2 text-xs">{r.sub}</span>}</CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.filter(r => r.type === "task").length > 0 && (
            <CommandGroup heading="Taken">
              {results.filter(r => r.type === "task").map(r => (
                <CommandItem key={r.id} onSelect={() => go(r)}><CheckSquare className="h-4 w-4 mr-2" />{r.label}</CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.filter(r => r.type === "appointment").length > 0 && (
            <CommandGroup heading="Afspraken">
              {results.filter(r => r.type === "appointment").map(r => (
                <CommandItem key={r.id} onSelect={() => go(r)}><Calendar className="h-4 w-4 mr-2" />{r.label}</CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
