import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { TEAMS } from "@/lib/teams";

export function AppHeader() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const team = TEAMS[user.teamId];

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/60">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
          <div className="hidden sm:block h-8 w-px bg-border mx-1" />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {user.role === "admin" ? "Espace administrateur" : "Espace membre"}
            </span>
            <span className="text-sm font-semibold text-foreground">{user.fullName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/20 text-xs font-semibold ${team.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${team.dot}`} />
            Équipe {team.name}
          </span>
          <Button variant="ghost" size="sm" onClick={() => { logout(); nav("/"); }}>
            <LogOut className="h-4 w-4 mr-1.5" /> Déconnexion
          </Button>
        </div>
      </div>
    </header>
  );
}
