import { useEffect, useState } from "react";
import { CUSTOMER_COLORS, DEFAULT_CUSTOMER_COLOR } from "@/lib/customer-colors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
}

function isValidHex(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

export function readableTextOn(bg: string): "#ffffff" | "#0a0a0a" {
  const hex = bg.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  if (full.length !== 6) return "#0a0a0a";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Perceived luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0a0a0a" : "#ffffff";
}

export function ColorPicker({ value, onChange, allowClear = true }: Props) {
  const [hex, setHex] = useState(value || "");

  useEffect(() => { setHex(value || ""); }, [value]);

  const current = value || DEFAULT_CUSTOMER_COLOR;
  const textColor = readableTextOn(current);

  function commitHex(v: string) {
    setHex(v);
    if (!v) { onChange(""); return; }
    const withHash = v.startsWith("#") ? v : `#${v}`;
    if (isValidHex(withHash)) onChange(withHash.toLowerCase());
  }

  return (
    <div className="space-y-3">
      {/* Live preview */}
      <div
        className="rounded-lg border p-3 flex items-center gap-3"
        style={{ background: current, color: textColor }}
      >
        <div className="h-10 w-10 rounded-md border border-black/10" style={{ background: current }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Voorbeeld</div>
          <div className="text-xs opacity-80 truncate">Badge · Project · Taak</div>
        </div>
        <span
          className="text-[10px] px-2 py-1 rounded-full"
          style={{ background: textColor, color: current }}
        >
          Label
        </span>
      </div>

      {/* Native color picker + hex input */}
      <div className="flex items-center gap-2">
        <label className="relative inline-flex items-center justify-center h-11 w-11 rounded-lg border bg-background cursor-pointer overflow-hidden">
          <span
            className="absolute inset-1 rounded-md"
            style={{ background: current }}
          />
          <input
            type="color"
            value={current}
            onChange={(e) => commitHex(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Kies kleur"
          />
        </label>
        <Input
          value={hex}
          onChange={(e) => commitHex(e.target.value)}
          placeholder="#3b82f6"
          className="font-mono h-11"
          maxLength={7}
        />
        {allowClear && value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => { setHex(""); onChange(""); }} title="Wissen" className="h-11 w-11">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {CUSTOMER_COLORS.map((c) => {
          const active = value?.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => commitHex(c.value)}
              title={c.label}
              aria-label={c.label}
              className={`h-7 w-7 rounded-full border-2 transition-all ${active ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
              style={{ background: c.value }}
            />
          );
        })}
      </div>
    </div>
  );
}
