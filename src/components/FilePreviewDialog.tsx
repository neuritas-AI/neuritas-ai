import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: { id: string; name: string; storage_path: string; mime_type?: string | null } | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!file) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from("files").createSignedUrl(file.storage_path, 600);
      if (!cancelled) {
        if (error || !data) toast.error(error?.message ?? "Kon bestand niet laden");
        else setUrl(data.signedUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  if (!file) return null;
  const mime = (file.mime_type ?? "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","avif"].includes(ext);
  const isPdf = mime === "application/pdf" || ext === "pdf";

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate text-base">{file.name}</DialogTitle>
          {url && (
            <Button asChild size="sm" variant="outline" className="ml-2 mr-6 shrink-0">
              <a href={url} target="_blank" rel="noopener noreferrer" download={file.name}>
                <Download className="h-4 w-4 mr-1" /> Download
              </a>
            </Button>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30">
          {!url ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Laden…</div>
          ) : isImage ? (
            <div className="h-full overflow-auto grid place-items-center p-4">
              <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : isPdf ? (
            <iframe src={url} title={file.name} className="w-full h-full border-0" />
          ) : (
            <div className="h-full grid place-items-center text-center p-6">
              <div>
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Geen voorvertoning beschikbaar voor dit bestandstype.</p>
                <Button asChild className="bg-gradient-brand border-0">
                  <a href={url} target="_blank" rel="noopener noreferrer" download={file.name}>
                    <Download className="h-4 w-4 mr-1" /> Download bestand
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
