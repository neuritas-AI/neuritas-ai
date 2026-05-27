import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useProfiles, type Profile } from "@/lib/profiles";
import { UserAvatar } from "@/components/UserAvatar";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  /** When true, Enter (without shift) calls onSubmit. */
  submitOnEnter?: boolean;
  /** Exclude these user ids from suggestions (e.g. the current user). */
  excludeIds?: string[];
};

export type MentionInputHandle = {
  focus: () => void;
};

/**
 * Textarea-style input with @mention autocomplete.
 * - Type "@" to open a dropdown of users
 * - ↑/↓ to navigate, Enter/Tab to insert, Esc to close
 * - Mobile-friendly: also tappable
 */
export const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { value, onChange, onSubmit, placeholder, rows = 2, maxLength, disabled, className, submitOnEnter, excludeIds = [] },
  ref,
) {
  const { profiles } = useProfiles();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(0); // index of '@'
  const [active, setActive] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => taRef.current?.focus() }), []);

  const suggestions = useMemo<Profile[]>(() => {
    if (query === null) return [];
    const q = query.toLowerCase().trim();
    const excluded = new Set(excludeIds);
    return profiles
      .filter(p => p.full_name && !excluded.has(p.id))
      .filter(p => {
        if (!q) return true;
        const fn = p.full_name!.toLowerCase();
        const first = fn.split(" ")[0] ?? "";
        return fn.includes(q) || first.startsWith(q);
      })
      .slice(0, 6);
  }, [profiles, query, excludeIds]);

  useEffect(() => { setActive(0); }, [query]);

  function updateQueryFromCursor(text: string, cursor: number) {
    // find the last '@' before cursor that starts a token (preceded by space/newline/start)
    let i = cursor - 1;
    while (i >= 0) {
      const c = text[i];
      if (c === "@") {
        const prev = i === 0 ? " " : text[i - 1];
        if (/\s/.test(prev) || i === 0) {
          const between = text.slice(i + 1, cursor);
          // open while word characters / single spaces (max 20 chars to avoid runaway)
          if (between.length <= 20 && !/[\n\t]/.test(between)) {
            setAnchor(i);
            setQuery(between);
            return;
          }
        }
        break;
      }
      if (/\s/.test(c)) break;
      i--;
    }
    setQuery(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    updateQueryFromCursor(v, e.target.selectionStart ?? v.length);
  }

  function insertMention(p: Profile) {
    const ta = taRef.current;
    if (!ta) return;
    const first = (p.full_name ?? "").split(" ")[0] || "User";
    const before = value.slice(0, anchor);
    const cursor = ta.selectionStart ?? value.length;
    const after = value.slice(cursor);
    const insert = `@${first} `;
    const next = before + insert + after;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (a + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => (a - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(suggestions[active]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setQuery(null); return; }
    }
    if (submitOnEnter && e.key === "Enter" && !e.shiftKey && query === null) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) => updateQueryFromCursor(value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className,
        )}
      />
      {query !== null && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-2 bottom-full mb-1 w-64 max-w-[90vw] rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/40">
            Vermeld iemand
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {suggestions.map((p, idx) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => insertMention(p)}
                  onMouseEnter={() => setActive(idx)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors",
                    idx === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <UserAvatar profile={p} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.full_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">@{(p.full_name ?? "").split(" ")[0]}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
