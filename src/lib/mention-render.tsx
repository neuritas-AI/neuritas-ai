import { Fragment, type ReactNode } from "react";
import type { Profile } from "@/lib/profiles";

/**
 * Render text with @mentions highlighted as pill badges.
 * Matches "@FirstName" or "@Full Name" against the provided profiles.
 */
export function renderMentions(
  text: string,
  profiles: Profile[],
  opts?: { highlightSelf?: string; variant?: "default" | "onBrand" },
): ReactNode {
  if (!text) return null;
  const variant = opts?.variant ?? "default";


  // Build mention vocabulary (lowercase → display name)
  const vocab = new Map<string, { display: string; userId: string }>();
  for (const p of profiles) {
    if (!p.full_name) continue;
    const full = p.full_name.trim();
    const first = full.split(/\s+/)[0];
    if (first) vocab.set(first.toLowerCase(), { display: first, userId: p.id });
    if (full && full !== first) vocab.set(full.toLowerCase(), { display: full, userId: p.id });
  }

  // Token scan: split on @word(s) groups
  const re = /(^|[^\w])@([A-Za-zÀ-ÖØ-öø-ÿ][\w'’-]*(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ][\w'’-]*)?)/g;
  const out: ReactNode[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    const lead = m[1];
    const candidate = m[2];
    const atStart = m.index + lead.length;

    // Try longest match first (full two-word), then first-word only
    const tryFull = candidate.toLowerCase();
    const firstWord = candidate.split(/\s+/)[0];
    const tryFirst = firstWord.toLowerCase();

    let hit = vocab.get(tryFull);
    let matched = candidate;
    if (!hit) {
      hit = vocab.get(tryFirst);
      matched = firstWord;
    }

    if (!hit) continue;

    const tokenStart = atStart;
    const tokenEnd = tokenStart + 1 + matched.length; // includes '@'

    if (tokenStart > lastEnd) {
      out.push(<Fragment key={`t-${key++}`}>{text.slice(lastEnd, tokenStart)}</Fragment>);
    }

    const isSelf = opts?.highlightSelf && hit.userId === opts.highlightSelf;
    out.push(
      <span
        key={`m-${key++}`}
        className={
          isSelf
            ? "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.85em] font-semibold bg-gradient-brand text-white shadow-sm"
            : "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.85em] font-medium bg-primary/10 text-primary"
        }
      >
        @{hit.display}
      </span>,
    );
    lastEnd = tokenEnd;
    re.lastIndex = tokenEnd; // continue after the match
  }
  if (lastEnd < text.length) {
    out.push(<Fragment key={`t-${key++}`}>{text.slice(lastEnd)}</Fragment>);
  }
  return <>{out}</>;
}
