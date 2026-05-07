import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserRecord, getSession, setSession } from "@/lib/store";

interface AuthCtx {
  user: UserRecord | null;
  setUser: (u: UserRecord | null) => void;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserRecord | null>(null);
  useEffect(() => { setUserState(getSession()); }, []);
  const setUser = (u: UserRecord | null) => {
    setUserState(u);
    setSession(u);
  };
  const logout = () => setUser(null);
  return <Ctx.Provider value={{ user, setUser, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
