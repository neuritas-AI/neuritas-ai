import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Download, FileText } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/files")({ component: FilesPage });

function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [linkType, setLinkType] = useState<"none"|"customer"|"task"|"appointment">("none");
  const [linkId, setLinkId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [{ data: f }, { data: c }, { data: t }, { data: a }] = await Promise.all([
      supabase.from("files").select("*, customers(name), tasks(title), appointments(title)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("tasks").select("id,title").order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,title").order("start_at", { ascending: false }),
    ]);
    setFiles(f ?? []); setCustomers(c ?? []); setTasks(t ?? []); setAppts(a ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("f-rt").on("postgres_changes", { event: "*", schema: "public", table: "files" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function upload(fileList: FileList | null) {
    if (!fileList || !user) return;
    for (const file of Array.from(fileList)) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("files").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const link: any = { name: file.name, storage_path: path, size: file.size, mime_type: file.type, uploaded_by: user.id };
      if (linkType === "customer" && linkId) link.customer_id = linkId;
      if (linkType === "task" && linkId) link.task_id = linkId;
      if (linkType === "appointment" && linkId) link.appointment_id = linkId;
      const { error } = await supabase.from("files").insert(link);
      if (error) toast.error(error.message);
    }
    toast.success("Geüpload");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function del(f: any) {
    if (!confirm("Verwijder dit bestand?")) return;
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    toast.success("Verwijderd");
  }

  async function download(f: any) {
    const { data, error } = await supabase.storage.from("files").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Fout");
    window.open(data.signedUrl, "_blank");
  }

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const cat = (key: "all"|"customer"|"task"|"appointment"|"none") => filtered.filter(f => {
    if (key==="all") return true;
    if (key==="customer") return !!f.customer_id;
    if (key==="task") return !!f.task_id;
    if (key==="appointment") return !!f.appointment_id;
    return !f.customer_id && !f.task_id && !f.appointment_id;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-display font-semibold">Bestanden</h1>
        <p className="text-muted-foreground text-sm">Upload en koppel aan klanten, taken of afspraken</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <Select value={linkType} onValueChange={(v: any)=>{setLinkType(v); setLinkId("");}}>
            <SelectTrigger><SelectValue placeholder="Koppelen aan..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen koppeling</SelectItem>
              <SelectItem value="customer">Klant</SelectItem>
              <SelectItem value="task">Taak</SelectItem>
              <SelectItem value="appointment">Afspraak</SelectItem>
            </SelectContent>
          </Select>
          {linkType !== "none" && (
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger><SelectValue placeholder="Selecteer..." /></SelectTrigger>
              <SelectContent>
                {(linkType==="customer"?customers: linkType==="task"?tasks: appts).map((x: any) => (
                  <SelectItem key={x.id} value={x.id}>{x.name ?? x.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <input ref={inputRef} type="file" multiple onChange={e=>upload(e.target.files)} className="hidden" id="file-up" />
            <Button asChild className="flex-1"><label htmlFor="file-up" className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> Upload</label></Button>
          </div>
        </div>
        <Input placeholder="Zoek bestanden…" value={search} onChange={e=>setSearch(e.target.value)} />
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Alles ({cat("all").length})</TabsTrigger>
          <TabsTrigger value="customer">Klanten ({cat("customer").length})</TabsTrigger>
          <TabsTrigger value="task">Taken ({cat("task").length})</TabsTrigger>
          <TabsTrigger value="appointment">Afspraken ({cat("appointment").length})</TabsTrigger>
          <TabsTrigger value="none">Niet gekoppeld ({cat("none").length})</TabsTrigger>
        </TabsList>
        {(["all","customer","task","appointment","none"] as const).map(k => (
          <TabsContent key={k} value={k}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat(k).length === 0 && <Card className="p-6 text-center text-muted-foreground col-span-full">Geen bestanden</Card>}
              {cat(k).map(f => (
                <Card key={f.id} className="p-4 group">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center text-primary"><FileText className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{(f.size/1024).toFixed(1)} KB · {fmtDateTime(f.created_at)}</div>
                      <div className="text-xs text-primary mt-1 truncate">
                        {f.customers?.name && `Klant: ${f.customers.name}`}
                        {f.tasks?.title && `Taak: ${f.tasks.title}`}
                        {f.appointments?.title && `Afspraak: ${f.appointments.title}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 justify-end">
                    <Button size="sm" variant="ghost" onClick={()=>download(f)}><Download className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={()=>del(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
