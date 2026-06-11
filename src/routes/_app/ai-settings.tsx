import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { getAiSettings, updateAiSettings, testAiConnection } from "@/lib/ai-settings.functions";

export const Route = createFileRoute("/_app/ai-settings")({ component: AiSettingsPage });

const OPENAI_MODELS = ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "gpt-5"];
const LOVABLE_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
  "anthropic/claude-sonnet-4.5",
];

function AiSettingsPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const fetchSettings = useServerFn(getAiSettings);
  const saveSettings = useServerFn(updateAiSettings);
  const testConn = useServerFn(testAiConnection);

  const [provider, setProvider] = useState<"openai" | "lovable">("openai");
  const [model, setModel] = useState("gpt-4o");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings({})
      .then((s: any) => {
        setProvider((s?.provider as any) ?? "openai");
        setModel(s?.model ?? "gpt-4o");
      })
      .catch(() => toast.error("Kan instellingen niet laden"))
      .finally(() => setLoading(false));
  }, [fetchSettings]);

  if (roleLoading || loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Laden…</div>;
  }
  if (!isAdmin) return <Navigate to="/settings" />;

  const models = provider === "openai" ? OPENAI_MODELS : LOVABLE_MODELS;

  async function save() {
    setSaving(true);
    try {
      await saveSettings({ data: { provider, model } });
      toast.success("AI instellingen opgeslagen");
    } catch (e: any) {
      toast.error(e?.message ?? "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      // save first so the test uses current selection
      await saveSettings({ data: { provider, model } });
      const r: any = await testConn({});
      if (r?.ok) setTestResult({ ok: true, message: `Verbonden met ${r.provider} (${r.model})` });
      else setTestResult({ ok: false, message: r?.error ?? "Verbinding mislukt" });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message ?? "Verbinding mislukt" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight">AI Settings</h1>
          <p className="text-sm text-muted-foreground">Provider en model voor de AI Assistant.</p>
        </div>
        <Badge variant="outline" className="ml-auto"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>
      </div>

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label>AI Provider</Label>
          <Select value={provider} onValueChange={(v) => { setProvider(v as any); setModel(v === "openai" ? "gpt-4o" : "google/gemini-3-flash-preview"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (eigen API key)</SelectItem>
              <SelectItem value="lovable">Lovable AI Gateway</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {provider === "openai"
              ? "Gebruikt de OPENAI_API_KEY die veilig op de backend is opgeslagen."
              : "Gebruikt Lovable AI (geen eigen key nodig)."}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {provider === "openai"
              ? "OPENAI_API_KEY is veilig opgeslagen op de backend (niet zichtbaar)."
              : "LOVABLE_API_KEY wordt automatisch beheerd."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={save} disabled={saving} className="bg-gradient-brand border-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Opslaan
          </Button>
          <Button onClick={test} disabled={testing} variant="outline">
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test AI connection
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 text-sm rounded-md border p-3 ${testResult.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
