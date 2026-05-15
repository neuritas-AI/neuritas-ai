import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = { id: string; full_name: string | null; avatar_url: string | null };

type Ctx = {
  profiles: Profile[];
  byId: Record<string, Profile>;
  getProfile: (id?: string | null) => Profile | undefined;
};

const ProfilesCtx = createContext<Ctx>({ profiles: [], byId: {}, getProfile: () => undefined });

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function load() {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url");
    setProfiles((data ?? []) as Profile[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("profiles-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const byId: Record<string, Profile> = {};
  for (const p of profiles) byId[p.id] = p;

  return (
    <ProfilesCtx.Provider value={{ profiles, byId, getProfile: (id) => (id ? byId[id] : undefined) }}>
      {children}
    </ProfilesCtx.Provider>
  );
}

export const useProfiles = () => useContext(ProfilesCtx);
export const useProfile = (id?: string | null) => useContext(ProfilesCtx).getProfile(id);
