import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export function FilePreviewDialog({
  file,
  onClose,
  lastPage,
}: {
  file: { id: string; name: string; storage_path: string; mime_type?: string | null } | null;
  onClose: () => void;
  lastPage?: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setTextContent(null);
    if (!file) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from("files").createSignedUrl(file.storage_path, 3600);
      if (cancelled) return;
      if (error || !data) { toast.error(error?.message ?? "Kon bestand niet laden"); return; }
      setUrl(data.signedUrl);
      // For small text-ish files, fetch and render inline
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = (file.mime_type ?? "").toLowerCase();
      const isText =
        mime.startsWith("text/") ||
        ["txt", "csv", "json", "md", "log", "xml", "yaml", "yml"].includes(ext) ||
        mime === "application/json";
      if (isText) {
        try {
          const res = await fetch(data.signedUrl);
          const txt = await res.text();
          if (!cancelled) setTextContent(txt.slice(0, 200_000));
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  if (!file) return null;
  const mime = (file.mime_type ?? "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  const isImage = mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","avif","bmp","ico"].includes(ext);
  const isPdf = mime === "application/pdf" || ext === "pdf";
  const isVideo = mime.startsWith("video/") || ["mp4","webm","mov","m4v","ogv"].includes(ext);
  const isAudio = mime.startsWith("audio/") || ["mp3","wav","ogg","m4a","aac","flac"].includes(ext);
  const isText =
    mime.startsWith("text/") ||
    ["txt","csv","json","md","log","xml","yaml","yml"].includes(ext) ||
    mime === "application/json";
  const isOffice = [
    "doc","docx","xls","xlsx","ppt","pptx",
  ].includes(ext) || mime.includes("officedocument") || mime.includes("msword") || mime.includes("ms-excel") || mime.includes("ms-powerpoint");

  const officeViewer = isOffice && url
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null;

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate text-base pr-4">{file.name}</DialogTitle>
          {url && (
            <Button asChild size="sm" variant="outline" className="mr-6 shrink-0">
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
          ) : isVideo ? (
            <div className="h-full grid place-items-center p-4 bg-black">
              <video src={url} controls playsInline className="max-w-full max-h-full" />
            </div>
          ) : isAudio ? (
            <div className="h-full grid place-items-center p-6">
              <div className="w-full max-w-xl space-y-3 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                <div className="text-sm font-medium">{file.name}</div>
                <audio src={url} controls className="w-full" />
              </div>
            </div>
          ) : isText && textContent !== null ? (
            <pre className="h-full overflow-auto p-4 text-xs bg-background whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          ) : officeViewer ? (
            <iframe src={officeViewer} title={file.name} className="w-full h-full border-0" />
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
