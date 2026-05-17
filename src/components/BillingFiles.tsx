import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

export function BillingFiles({ kind, parentId, customerId, userId }: {
  kind: "quote" | "invoice";
  parentId: string;
  customerId?: string | null;
  userId: string | null;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [preview, setPreview] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const col = kind === "quote" ? "quote_id" : "invoice_id";

  async function load() {
    const { data } = await supabase.from("files").select("*").eq(col, parentId).order("created_at", { ascending: false });
    setFiles(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [parentId]);

  async function upload(fl: FileList | null) {
    if (!fl || !userId) return;
    for (const file of Array.from(fl)) {
      const path = `${userId}/${kind}s/${parentId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("files").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const payload: any = {
        name: file.name, storage_path: path, size: file.size, mime_type: file.type,
        uploaded_by: userId, customer_id: customerId ?? null,
      };
      payload[col] = parentId;
      const { error } = await supabase.from("files").insert(payload);
      if (error) toast.error(error.message);
    }
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Bestand toegevoegd");
    load();
  }
  async function download(f: any) {
    const { data, error } = await supabase.storage.from("files").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Fout");
    window.open(data.signedUrl, "_blank");
  }
  async function del(f: any) {
    if (!confirm("Verwijderen?")) return;
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    toast.success("Verwijderd");
    load();
  }

  return (
    <div className="space-y-2 border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bestanden</Label>
        <input ref={inputRef} type="file" multiple onChange={e => upload(e.target.files)} className="hidden" id={`bf-${kind}-${parentId}`} />
        <Button asChild size="sm" variant="outline">
          <label htmlFor={`bf-${kind}-${parentId}`} className="cursor-pointer"><Upload className="h-3.5 w-3.5 mr-1" /> Upload</label>
        </Button>
      </div>
      {files.length === 0 && <p className="text-xs text-muted-foreground py-2">Nog geen bestanden toegevoegd.</p>}
      <div className="space-y-1">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-2 p-2 rounded border text-sm">
            <button type="button" onClick={() => setPreview(f)} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-primary">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">{(f.size/1024).toFixed(1)} KB · {fmtDateTime(f.created_at)}</div>
              </div>
            </button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(f)} title="Bekijk"><Eye className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => download(f)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(f)} className="text-destructive" title="Verwijder"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
