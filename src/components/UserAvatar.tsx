import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AvatarProfile = { id?: string; full_name?: string | null; avatar_url?: string | null };

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name[0].toUpperCase();
}

export function UserAvatar({
  profile,
  className,
  size = 32,
}: {
  profile?: AvatarProfile | null;
  className?: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  return (
    <Avatar className={cn("shrink-0", className)} style={style}>
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} /> : null}
      <AvatarFallback className="bg-gradient-brand text-white text-[11px] font-semibold">
        {initials(profile?.full_name)}
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
        <UserAvatar key={p.id ?? i} profile={p} size={size} className="ring-2 ring-background" />
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
