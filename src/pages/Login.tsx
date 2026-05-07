import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEAM_LIST, resolveCode, TeamId } from "@/lib/teams";
import { loginApi, createUser } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(80),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "Min. 6 caractères").max(72),
  teamId: z.string().min(1, "Choisissez une équipe"),
  code: z.string().min(1, "Code requis"),
});
const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "Min. 6 caractères").max(72),
});

export default function Login() {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ fullName: "", email: "", password: "", teamId: "", code: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(li);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const user = await loginApi(li.email, li.password);
      setUser(user);
      toast.success(`Bienvenue ${user.fullName}`);
      nav(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(su);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const resolved = resolveCode(su.code);
    if (!resolved) { toast.error("Code d'accès invalide"); return; }
    if (resolved.team.id !== (su.teamId as TeamId)) { toast.error("Le code ne correspond pas à l'équipe"); return; }
    setLoading(true);
    try {
      const user = await createUser({ fullName: su.fullName, email: su.email, password: su.password, teamId: su.teamId as TeamId, role: resolved.role });
      setUser(user);
      toast.success(`Compte créé — Bienvenue ${user.fullName} !`);
      nav(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-20 w-auto mb-6" />
          <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold mb-3">◦ Portail de pointage</p>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Bienvenue.</h1>
          <p className="text-muted-foreground mt-2 text-sm">Connectez-vous pour pointer votre journée</p>
        </div>

        <div className="bg-card rounded-2xl shadow-floating border border-border/60 p-7">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl mb-6">
            {(["login","signup"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-smooth ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Email</Label>
                <Input type="email" value={li.email} placeholder="prenom.nom@entreprise.fr"
                  onChange={(e) => setLi({ ...li, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Mot de passe</Label>
                <Input type="password" value={li.password} placeholder="••••••••"
                  onChange={(e) => setLi({ ...li, password: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary font-semibold">
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Nom complet</Label>
                <Input value={su.fullName} placeholder="Jean Dupont"
                  onChange={(e) => setSu({ ...su, fullName: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Email</Label>
                <Input type="email" value={su.email} placeholder="jean.dupont@entreprise.fr"
                  onChange={(e) => setSu({ ...su, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Mot de passe</Label>
                <Input type="password" value={su.password} placeholder="Min. 6 caractères"
                  onChange={(e) => setSu({ ...su, password: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Équipe</Label>
                <Select value={su.teamId} onValueChange={(v) => setSu({ ...su, teamId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une équipe" /></SelectTrigger>
                  <SelectContent>
                    {TEAM_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} — {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Code d'accès</Label>
                <Input value={su.code} placeholder="Fourni par votre responsable"
                  onChange={(e) => setSu({ ...su, code: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary font-semibold">
                {loading ? "Création…" : "Créer mon compte"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
