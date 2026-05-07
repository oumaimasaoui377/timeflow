import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import {
  Building2, Home, Clock, LogIn, LogOut, Coffee, Sparkles, History,
  ChevronLeft, ChevronRight, FileText, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  addPunch, listPunchesByUserToday, listPunchesByUserPeriod, updatePunch,
  getSchedule, getMemberSchedule, PunchKind, PunchRecord, PeriodFilter, DaySchedule,
} from "@/lib/store";
import {
  formatClock, formatDateLong, formatHM, formatShort,
  isLate, diffHours, fmtDuration, nowParis, todayKey,
} from "@/lib/time";
import { TEAMS } from "@/lib/teams";

const KIND_LABEL: Record<PunchKind, string> = {
  in: "Entrée", break_out: "Pause", break_in: "Reprise", out: "Sortie",
};
const PERIOD_LABELS: Record<PeriodFilter, string> = {
  week: "Semaine", month: "Mois", year: "Année scolaire",
};
// Correspondance JS getDay() (0=dim) → ISO (1=lun … 7=dim)
const DAY_ISO: Record<number, number> = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };

export default function Dashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(nowParis());
  const [location, setLocation] = useState<"onsite" | "remote">("onsite");
  const [todayPunches, setTodayPunches] = useState<PunchRecord[]>([]);
  const [loadingPunch, setLoadingPunch] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  // Historique
  const [histOpen, setHistOpen] = useState(false);
  const [histPeriod, setHistPeriod] = useState<PeriodFilter>("week");
  const [histRef, setHistRef] = useState(todayKey());
  const [histPunches, setHistPunches] = useState<PunchRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Justification
  const [justifOpen, setJustifOpen] = useState(false);
  const [justifTarget, setJustifTarget] = useState<PunchRecord | null>(null);
  const [justifText, setJustifText] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(nowParis()), 1000);
    return () => clearInterval(id);
  }, []);

  const reloadToday = useCallback(async () => {
    if (!user) return;
    const punches = await listPunchesByUserToday(user.id);
    setTodayPunches(punches);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reloadToday();
    // Charger d'abord le planning individuel, sinon le planning équipe
    getMemberSchedule(user.id).then((ms) => {
      if (ms.length > 0) {
        setSchedule(ms);
        setScheduleLoaded(true);
      } else {
        getSchedule(user.teamId)
          .then((s) => { setSchedule(s); setScheduleLoaded(true); })
          .catch(() => setScheduleLoaded(true));
      }
    }).catch(() => {
      getSchedule(user.teamId)
        .then((s) => { setSchedule(s); setScheduleLoaded(true); })
        .catch(() => setScheduleLoaded(true));
    });
  }, [user, reloadToday]);

  // Planning du jour courant
  const todaySchedule = useMemo((): DaySchedule | null => {
    const dow = DAY_ISO[now.getDay()];
    return schedule.find((s) => s.dayOfWeek === dow) ?? null;
  }, [schedule, now]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistLoading(true);
    try {
      const punches = await listPunchesByUserPeriod(user.id, histPeriod, histRef);
      setHistPunches(punches);
    } finally { setHistLoading(false); }
  }, [user, histPeriod, histRef]);

  useEffect(() => { if (histOpen) loadHistory(); }, [histOpen, loadHistory]);

  if (!user) return <Navigate to="/" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  const last = todayPunches[todayPunches.length - 1];
  const nextKind: PunchKind = !last ? "in"
    : last.kind === "in" ? "break_out"
    : last.kind === "break_out" ? "break_in"
    : last.kind === "break_in" ? "out" : "in";

  const arrival = todayPunches.find((p) => p.kind === "in");
  const cumul = (() => {
    let total = 0; let openAt: string | null = null;
    for (const p of todayPunches) {
      if (p.kind === "in" || p.kind === "break_in") openAt = p.at;
      else if (openAt) { total += diffHours(openAt, p.at); openAt = null; }
    }
    if (openAt) total += diffHours(openAt, new Date().toISOString());
    return total;
  })();

  const status = !last ? "Non pointé"
    : last.kind === "out" ? "Journée terminée"
    : last.kind === "break_out" ? "En pause" : "Présent";

  const handlePunch = async () => {
    const at = new Date();
    const late = nextKind === "in"
      ? isLate("in", at, todaySchedule?.startTime, todaySchedule?.endTime, todaySchedule?.toleranceMinutes)
      : nextKind === "out"
      ? isLate("out", at, todaySchedule?.startTime, todaySchedule?.endTime, todaySchedule?.toleranceMinutes)
      : false;

    setLoadingPunch(true);
    try {
      await addPunch({
        userId: user.id, userFullName: user.fullName, teamId: user.teamId,
        kind: nextKind, location, at: at.toISOString(), validated: false, late,
      });
      toast.success(`${KIND_LABEL[nextKind]} pointée à ${formatHM(at)}`, {
        description: `${location === "onsite" ? "Sur site" : "Télétravail"}${late ? " · ⚠ En retard" : ""}`,
      });
      await reloadToday();
    } catch { toast.error("Erreur lors du pointage"); } finally { setLoadingPunch(false); }
  };

  const openJustif = (p: PunchRecord) => {
    setJustifTarget(p); setJustifText(p.justification ?? ""); setJustifOpen(true);
  };
  const saveJustif = async () => {
    if (!justifTarget) return;
    await updatePunch(justifTarget.id, { justification: justifText.trim() || null });
    toast.success("Justification enregistrée");
    setJustifOpen(false);
    await reloadToday();
    if (histOpen) await loadHistory();
  };

  const shiftRef = (dir: number) => {
    const d = new Date(histRef + "T12:00:00");
    if (histPeriod === "week")  d.setDate(d.getDate() + dir * 7);
    if (histPeriod === "month") d.setMonth(d.getMonth() + dir);
    if (histPeriod === "year")  d.setFullYear(d.getFullYear() + dir);
    setHistRef(d.toISOString().slice(0, 10));
  };

  const histByDay = useMemo(() => {
    const map = new Map<string, PunchRecord[]>();
    for (const p of histPunches) {
      const key = p.at.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [histPunches]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-10 max-w-5xl animate-fade-in">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">◦ {formatDateLong(now)}</p>
          <h1 className="text-7xl md:text-8xl font-bold tracking-tighter text-primary tabular-nums mt-3">{formatClock(now)}</h1>
          <p className="text-muted-foreground mt-2 text-sm">Heure de Paris</p>
        </div>

        {/* Planning de l'équipe — semaine complète */}
        {scheduleLoaded && (
          <div className="mb-6">
            {schedule.length > 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl shadow-elegant p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarClock className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">Planning de l'équipe — semaine</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {schedule
                    .filter((s) => s.dayOfWeek >= 1 && s.dayOfWeek <= 5)
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((s) => {
                      const dayNames = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
                      const isToday = DAY_ISO[now.getDay()] === s.dayOfWeek;
                      return (
                        <div key={s.dayOfWeek}
                          className={`rounded-xl border px-4 py-3 text-center transition-smooth ${isToday ? "border-accent bg-accent/10" : "border-border/40 bg-muted/30"}`}>
                          <p className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${isToday ? "text-accent" : "text-muted-foreground"}`}>
                            {dayNames[s.dayOfWeek]}{isToday && " ●"}
                          </p>
                          <p className="text-sm font-bold tabular-nums text-foreground">{s.startTime}</p>
                          <p className="text-xs text-muted-foreground my-0.5">→</p>
                          <p className="text-sm font-bold tabular-nums text-foreground">{s.endTime}</p>
                        </div>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">Tolérance de retard : 5 minutes</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-6 py-3 shadow-elegant">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Aucun planning défini pour cette équipe</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-card rounded-3xl shadow-floating border border-border/60 p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-xl mb-8">
            {(["onsite", "remote"] as const).map((loc) => (
              <button key={loc} onClick={() => setLocation(loc)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-smooth flex items-center gap-2 ${location === loc ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {loc === "onsite" ? <><Building2 className="h-4 w-4" />Sur site</> : <><Home className="h-4 w-4" />Télétravail</>}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Prochaine action</p>
            <Button onClick={handlePunch} disabled={last?.kind === "out" || loadingPunch}
              className="h-20 px-12 text-lg font-bold rounded-2xl bg-gradient-primary hover:scale-[1.02] hover:shadow-floating transition-smooth shadow-elegant gap-3 group">
              <PunchIcon kind={nextKind} />
              {loadingPunch ? "En cours…" : `POINTER ${KIND_LABEL[nextKind].toUpperCase()}`}
              <Sparkles className="h-5 w-5 text-accent opacity-0 group-hover:opacity-100 transition-smooth" />
            </Button>
            {last?.kind === "out" && <p className="text-sm text-muted-foreground mt-4">Votre journée est terminée. À demain !</p>}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <SummaryCard label="Heure d'arrivée" value={arrival ? formatHM(arrival.at) : "—"}
            sub={arrival ? (arrival.late ? "⚠ En retard" : "✓ À l'heure") : "Pas encore pointé"}
            tone={arrival?.late ? "warning" : "ok"} icon={<LogIn className="h-4 w-4" />} />
          <SummaryCard label="Cumul du jour" value={fmtDuration(cumul)} sub="Heures travaillées"
            tone="primary" icon={<Clock className="h-4 w-4" />} />
          <SummaryCard label="Statut actuel" value={status}
            sub={last ? `Dernier pointage à ${formatHM(last.at)}` : "—"}
            tone={status === "Présent" ? "ok" : status === "En pause" ? "warning" : "muted"}
            icon={<Sparkles className="h-4 w-4" />} />
        </div>

        {todayPunches.length > 0 && (
          <div className="mt-8 bg-card rounded-2xl border border-border/60 shadow-elegant p-6">
            <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-4">Pointages du jour</h3>
            <div className="space-y-2">
              {todayPunches.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-smooth">
                  <div className="flex items-center gap-3">
                    <PunchIcon kind={p.kind} small />
                    <span className="font-medium text-sm">{KIND_LABEL[p.kind]}</span>
                    {p.late && <span className="text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 px-2 py-0.5 rounded-full">Retard</span>}
                    {p.justification && (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full max-w-[160px] truncate" title={p.justification}>
                        📝 {p.justification}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-xs">{p.location === "onsite" ? "Sur site" : "Télétravail"}</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatHM(p.at)}</span>
                    <button onClick={() => openJustif(p)} className="text-xs text-muted-foreground hover:text-primary transition-smooth p-1 rounded" title="Ajouter une justification">
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" onClick={() => setHistOpen(true)} className="gap-2">
            <History className="h-4 w-4" /> Voir mon historique de pointage
          </Button>
        </div>
      </main>

      {/* Dialog justification */}
      <Dialog open={justifOpen} onOpenChange={(o) => !o && setJustifOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Justifier ce pointage</DialogTitle></DialogHeader>
          {justifTarget && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{KIND_LABEL[justifTarget.kind]}</span>
                {" · "}{formatShort(justifTarget.at)} à {formatHM(justifTarget.at)}
                {justifTarget.late && <span className="ml-2 text-warning text-xs font-bold">⚠ Retard</span>}
              </p>
              <Textarea
                placeholder="Motif du retard ou de l'absence (facultatif)…"
                value={justifText}
                onChange={(e) => setJustifText(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifOpen(false)}>Annuler</Button>
            <Button onClick={saveJustif}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog historique */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique de pointage</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-xl">
              {(["week", "month", "year"] as PeriodFilter[]).map((p) => (
                <button key={p} onClick={() => { setHistPeriod(p); setHistRef(todayKey()); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-smooth ${histPeriod === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => shiftRef(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-smooth"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold tabular-nums min-w-[140px] text-center">{periodLabel(histPeriod, histRef)}</span>
              <button onClick={() => shiftRef(1)} className="p-1.5 rounded-lg hover:bg-muted transition-smooth"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 mt-2 space-y-4 pr-1">
            {histLoading ? (
              <p className="text-center py-10 text-muted-foreground text-sm">Chargement…</p>
            ) : histByDay.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm">Aucun pointage sur cette période.</p>
            ) : histByDay.map(([day, punches]) => {
              const dayDate = new Date(day + "T12:00:00");
              let dayHours = 0; let openAt: string | null = null;
              for (const p of punches) {
                if (p.kind === "in" || p.kind === "break_in") openAt = p.at;
                else if (openAt) { dayHours += diffHours(openAt, p.at); openAt = null; }
              }
              return (
                <div key={day} className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold capitalize">{dayDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
                    {dayHours > 0 && <span className="text-xs font-semibold text-primary">{fmtDuration(dayHours)} travaillées</span>}
                  </div>
                  <div className="space-y-1.5">
                    {punches.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm bg-card rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <PunchIcon kind={p.kind} small />
                          <span className="font-medium">{KIND_LABEL[p.kind]}</span>
                          {p.late && <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">Retard</span>}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {p.justification && <span className="text-[10px] max-w-[140px] truncate" title={p.justification}>📝 {p.justification}</span>}
                          <span className="text-xs">{p.location === "onsite" ? "Sur site" : "Télétravail"}</span>
                          <span className="font-semibold text-foreground tabular-nums">{formatHM(p.at)}</span>
                          <button onClick={() => openJustif(p)} className="hover:text-primary transition-smooth"><FileText className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function periodLabel(period: PeriodFilter, ref: string): string {
  const d = new Date(ref + "T12:00:00");
  if (period === "week") {
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} – ${sun.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
  }
  if (period === "month") return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `Sept ${y} – Août ${y + 1}`;
}

function PunchIcon({ kind, small }: { kind: PunchKind; small?: boolean }) {
  const cls = small ? "h-4 w-4" : "h-6 w-6";
  if (kind === "in") return <LogIn className={cls} />;
  if (kind === "out") return <LogOut className={cls} />;
  return <Coffee className={cls} />;
}

function SummaryCard({ label, value, sub, tone, icon }: {
  label: string; value: string; sub: string; tone: "ok" | "warning" | "primary" | "muted"; icon: React.ReactNode;
}) {
  const toneCls = { ok: "text-success", warning: "text-warning", primary: "text-primary", muted: "text-muted-foreground" }[tone];
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-elegant p-5 hover:shadow-floating hover:-translate-y-0.5 transition-smooth">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        <span className={toneCls}>{icon}</span>{label}
      </div>
      <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{value}</p>
      <p className={`text-xs mt-1 font-medium ${toneCls}`}>{sub}</p>
    </div>
  );
}
