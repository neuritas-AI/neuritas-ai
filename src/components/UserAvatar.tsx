import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profiles";

export type AvatarProfile = { id?: string; full_name?: string | null; avatar_url?: string | null };

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name[0].toUpperCase();
}

export function UserAvatar({
  profile,
  userId,
  className,
  size = 32,
}: {
  profile?: AvatarProfile | null;
  userId?: string | null;
  className?: string;
  size?: number;
}) {
  // Always prefer live profile from global cache when an id is available
  const lookupId = userId ?? profile?.id ?? null;
  const live = useProfile(lookupId);
  const effective: AvatarProfile | null | undefined = live ?? profile;

  const style = { width: size, height: size };
  return (
    <Avatar className={cn("shrink-0", className)} style={style}>
      {effective?.avatar_url ? <AvatarImage src={effective.avatar_url} alt={effective.full_name ?? ""} /> : null}
      <AvatarFallback className="bg-gradient-brand text-white text-[11px] font-semibold">
        {initials(effective?.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserAvatarStack({ profiles, max = 4, size = 28 }: { profiles: AvatarProfile[]; max?: number; size?: number }) {
  const shown = profiles.slice(0, max);
  const extra = profiles.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <UserAvatar key={p.id ?? i} profile={p} userId={p.id} size={size} className="ring-2 ring-background" />
      ))}
      {extra > 0 && (
        <div
          className="rounded-full bg-muted text-muted-foreground text-[10px] font-medium grid place-items-center ring-2 ring-background"
          style={{ width: size, height: size }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
