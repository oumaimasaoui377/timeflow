import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Check, Pencil, Search, Users, AlertTriangle, TrendingUp, BadgeCheck,
  KeyRound, Copy, UserPlus, Trash2, FileSpreadsheet, Download, MessageSquarePlus,
  Trash, CalendarClock, ChevronRight, Save, Mail, Calendar,
  Filter, Clock, MapPin, Upload, FileText, ShieldAlert, SortAsc, SortDesc,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  listPunchesByTeam, listUsers, PunchRecord, updatePunch, createUser, deleteUser,
  UserRecord, getSchedule, saveSchedule, DaySchedule,
  listRhComments, createRhComment, deleteRhComment, RhComment, TeamId,
  getMemberSchedule, saveMemberSchedule, deleteMemberSchedule, addPunch,
} from "@/lib/store";
import { TEAMS } from "@/lib/teams";
import { formatHM, formatShort, diffHours, fmtDuration } from "@/lib/time";

/* ─── SheetJS (xlsx) chargé dynamiquement ─── */
declare global { interface Window { XLSX?: XLSXStatic } }
interface XLSXStatic {
  read(data: ArrayBuffer, opts: { type: string }): WorkBook;
  utils: {
    sheet_to_json<T>(sheet: WorkSheet, opts?: { header?: number; defval?: unknown }): T[];
    json_to_sheet<T>(data: T[]): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
    aoa_to_sheet(data: unknown[][]): WorkSheet;
  };
  writeFile(wb: WorkBook, name: string): void;
}
interface WorkBook { SheetNames: string[]; Sheets: Record<string, WorkSheet> }
type WorkSheet = Record<string, unknown>;

async function loadXLSX(): Promise<XLSXStatic> {
  if (window.XLSX) return window.XLSX;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("Impossible de charger SheetJS"));
    document.head.appendChild(s);
  });
  return window.XLSX!;
}

/* ─── Types ─── */
const KIND_LABEL: Record<PunchRecord["kind"], string> = {
  in: "Entrée", break_out: "Pause", break_in: "Reprise", out: "Sortie",
};
const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type FilterLieu    = "all" | "onsite" | "remote";
type FilterJustif  = "all" | "justified" | "not_justified";
type FilterStatut  = "all" | "present" | "retard" | "anomalie_tot" | "valide";
type SortField     = "date" | "name" | "statut" | "lieu";
type SortDir       = "asc" | "desc";

interface AnomalyResult {
  kind: "ok" | "trop_tot" | "retard";
  diffMin: number;
}

function computeAnomaly(punch: PunchRecord, sched: DaySchedule | null, earlyMin: number): AnomalyResult {
  if (!sched || punch.kind !== "in") return { kind: "ok", diffMin: 0 };
  const pDate = new Date(punch.at);
  const [sh, sm] = sched.startTime.split(":").map(Number);
  const start = new Date(pDate); start.setHours(sh, sm, 0, 0);
  const diffMin = Math.round((pDate.getTime() - start.getTime()) / 60000);
  const tol = sched.toleranceMinutes ?? 5;
  if (diffMin < -earlyMin) return { kind: "trop_tot", diffMin };
  if (diffMin > tol)       return { kind: "retard",   diffMin };
  return { kind: "ok", diffMin };
}

function schedForPunch(schedules: DaySchedule[], at: string): DaySchedule | null {
  const d = new Date(at); const raw = d.getDay();
  const dow = raw === 0 ? 7 : raw;
  return schedules.find(s => s.dayOfWeek === dow) ?? null;
}

/* ─── Component ─── */
export default function Admin() {
  const { user } = useAuth();
  const [punches,    setPunches]    = useState<PunchRecord[]>([]);
  const [members,    setMembers]    = useState<UserRecord[]>([]);
  const [schedule,   setSchedule]   = useState<DaySchedule[]>([]);
  const [rhComments, setRhComments] = useState<RhComment[]>([]);
  const [loading,    setLoading]    = useState(true);

  /* dialogs */
  const [editing,       setEditing]       = useState<PunchRecord | null>(null);
  const [editTime,      setEditTime]      = useState("");
  const [showCodes,     setShowCodes]     = useState(false);
  const [addOpen,       setAddOpen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [editSchedule,  setEditSchedule]  = useState<DaySchedule[]>([]);
  const [importSchedOpen,        setImportSchedOpen]        = useState(false);
  const [importSchedError,       setImportSchedError]       = useState("");
  const [memberSchedOpen,        setMemberSchedOpen]        = useState(false);
  const [memberSchedTarget,      setMemberSchedTarget]      = useState<UserRecord | null>(null);
  const [memberSchedDays,        setMemberSchedDays]        = useState<(DaySchedule & { active: boolean })[]>([]);
  const [memberSchedLoading,     setMemberSchedLoading]     = useState(false);
  const [importMemberSchedOpen,  setImportMemberSchedOpen]  = useState(false);
  const [importMemberSchedError, setImportMemberSchedError] = useState("");
  const [mailDialog,    setMailDialog]    = useState<{ to: string; subject: string; body: string } | null>(null);
  const [rhComment,     setRhComment]     = useState("");
  const [selectedPunches, setSelectedPunches] = useState<Set<string>>(new Set());

  /* admin self-punch dialog */
  const [adminPunchOpen,   setAdminPunchOpen]   = useState(false);
  const [adminPunchKind,   setAdminPunchKind]   = useState<PunchRecord["kind"]>("in");
  const [adminPunchLoc,    setAdminPunchLoc]     = useState<"onsite"|"remote">("onsite");
  const [adminPunchTime,   setAdminPunchTime]   = useState("");
  const [adminPunchDate,   setAdminPunchDate]   = useState("");

  /* filters */
  const [search,        setSearch]        = useState("");
  const [date,          setDate]          = useState("");
  const [filterLieu,    setFilterLieu]    = useState<FilterLieu>("all");
  const [filterJustif,  setFilterJustif]  = useState<FilterJustif>("all");
  const [filterStatut,  setFilterStatut]  = useState<FilterStatut>("all");
  const [sortField,     setSortField]     = useState<SortField>("date");
  const [sortDir,       setSortDir]       = useState<SortDir>("desc");

  /* anomaly thresholds */
  const [earlyThresh, setEarlyThresh] = useState(30); // -Xmin = trop tôt
  const [lateThresh,  setLateThresh]  = useState(20); // +Xmin = retard affiché

  /* report period */
  const today       = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayIso    = today.toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(firstOfMonth);
  const [reportTo,   setReportTo]   = useState(todayIso);

  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  const team = TEAMS[user.teamId];

  /* ─── Data loading ─── */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, u, s, c] = await Promise.all([
        listPunchesByTeam(user.teamId),
        listUsers(),
        getSchedule(user.teamId),
        listRhComments(user.teamId),
      ]);
      setPunches(p);
      setMembers(u.filter(m => m.teamId === user.teamId && m.role === "member"));
      setSchedule(s);
      setRhComments(c);
    } finally { setLoading(false); }
  }, [user.teamId]);

  useEffect(() => { reload(); }, [reload]);

  /* ─── Anomaly helper ─── */
  const getAnomaly = useCallback((p: PunchRecord) =>
    computeAnomaly(p, schedForPunch(schedule, p.at), earlyThresh),
  [schedule, earlyThresh]);

  /* ─── Report data ─── */
  const reportPunches = useMemo(() =>
    punches.filter(p => {
      const t = new Date(p.at).getTime();
      return t >= new Date(reportFrom + "T00:00:00").getTime()
          && t <= new Date(reportTo   + "T23:59:59").getTime();
    }), [punches, reportFrom, reportTo]);

  const report = useMemo(() => members.map(m => {
    const mp = reportPunches.filter(p => p.userId === m.id)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const days      = new Set(mp.map(p => p.at.slice(0, 10)));
    const lateDays  = new Set(mp.filter(p => p.kind === "in" && p.late).map(p => p.at.slice(0, 10)));
    const earlyDays = new Set(mp.filter(p => getAnomaly(p).kind === "trop_tot").map(p => p.at.slice(0, 10)));
    let hours = 0;
    const byDay = new Map<string, PunchRecord[]>();
    mp.forEach(p => { const k = p.at.slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), p]); });
    for (const dp of byDay.values()) {
      let open: string | null = null;
      for (const p of dp) {
        if (p.kind === "in" || p.kind === "break_in") open = p.at;
        else if (open) { hours += diffHours(open, p.at); open = null; }
      }
    }
    const onsite         = mp.filter(p => p.kind === "in" && p.location === "onsite").length;
    const remote         = mp.filter(p => p.kind === "in" && p.location === "remote").length;
    const validatedCount = mp.filter(p => p.validated).length;
    const lateJustified  = mp.filter(p => p.late && p.justification).length;
    return { id: m.id, name: m.fullName, email: m.email, daysPresent: days.size, lateDays: lateDays.size,
             earlyDays: earlyDays.size, hours, onsite, remote, totalPunches: mp.length, validatedCount, lateJustified };
  }), [members, reportPunches, getAnomaly]);

  const reportTotals = useMemo(() => ({
    days:   report.reduce((s, r) => s + r.daysPresent, 0),
    late:   report.reduce((s, r) => s + r.lateDays,    0),
    early:  report.reduce((s, r) => s + r.earlyDays,   0),
    hours:  report.reduce((s, r) => s + r.hours,       0),
    onsite: report.reduce((s, r) => s + r.onsite,      0),
    remote: report.reduce((s, r) => s + r.remote,      0),
  }), [report]);

  /* ─── Filtered + sorted punches ─── */
  const filtered = useMemo(() => {
    let list = punches
      .filter(p => !search || p.userFullName.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !date   || p.at.slice(0, 10) === date);

    if (filterLieu   === "onsite")       list = list.filter(p => p.location === "onsite");
    if (filterLieu   === "remote")       list = list.filter(p => p.location === "remote");
    if (filterJustif === "justified")    list = list.filter(p => !!p.justification);
    if (filterJustif === "not_justified")list = list.filter(p => !p.justification);
    if (filterStatut === "valide")       list = list.filter(p => p.validated);
    if (filterStatut === "retard")       list = list.filter(p => p.late && p.kind === "in");
    if (filterStatut === "present")      list = list.filter(p => p.kind === "in" && !p.late && !p.validated);
    if (filterStatut === "anomalie_tot") list = list.filter(p => getAnomaly(p).kind === "trop_tot");

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")   cmp = new Date(a.at).getTime() - new Date(b.at).getTime();
      if (sortField === "name")   cmp = a.userFullName.localeCompare(b.userFullName);
      if (sortField === "lieu")   cmp = a.location.localeCompare(b.location);
      if (sortField === "statut") cmp = (a.validated?3:a.late?1:2) - (b.validated?3:b.late?1:2);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [punches, search, date, filterLieu, filterJustif, filterStatut, sortField, sortDir, getAnomaly]);

  /* ─── Today stats ─── */
  const todayStr    = today.toDateString();
  const todayPunches = punches.filter(p => new Date(p.at).toDateString() === todayStr);
  const presentIds   = new Set(todayPunches.filter(p => p.kind === "in").map(p => p.userId));
  const lateCount    = todayPunches.filter(p => p.kind === "in" && p.late).length;
  const earlyToday   = todayPunches.filter(p => getAnomaly(p).kind === "trop_tot").length;
  const presence     = members.length ? Math.round((presentIds.size / members.length) * 100) : 0;
  const validated    = punches.filter(p => p.validated).length;

  /* ─── Edit punch ─── */
  const openEdit = (p: PunchRecord) => {
    setEditing(p);
    const d = new Date(p.at);
    setEditTime(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
  };
  const saveEdit = async () => {
    if (!editing) return;
    const [h, m] = editTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) { toast.error("Heure invalide"); return; }
    const d = new Date(editing.at); d.setHours(h, m, 0, 0);
    await updatePunch(editing.id, { at: d.toISOString() });
    toast.success(`Pointage de ${editing.userFullName} mis à jour`);
    setEditing(null); await reload();
  };
  const validate = async (p: PunchRecord) => {
    const scrollY = window.scrollY;
    await updatePunch(p.id, { validated: true });
    toast.success("Pointage validé", { description: `${p.userFullName} · ${formatHM(p.at)}` });
    await reload();
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
  };
  const validateSelected = async () => {
    if (!selectedPunches.size) return;
    const scrollY = window.scrollY;
    await Promise.all([...selectedPunches].map(id => updatePunch(id, { validated: true })));
    toast.success(`${selectedPunches.size} pointage(s) validés`);
    setSelectedPunches(new Set()); await reload();
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
  };

  /* ─── Admin self-punch ─── */
  const openAdminPunch = () => {
    const now = new Date();
    setAdminPunchDate(now.toISOString().slice(0, 10));
    setAdminPunchTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
    setAdminPunchKind("in"); setAdminPunchLoc("onsite");
    setAdminPunchOpen(true);
  };
  const saveAdminPunch = async () => {
    const [h, m] = adminPunchTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) { toast.error("Heure invalide"); return; }
    const at = new Date(`${adminPunchDate}T${adminPunchTime}:00`).toISOString();
    const sched = schedForPunch(schedule, at);
    const late = sched && adminPunchKind === "in"
      ? computeAnomaly({ at } as PunchRecord, sched, 0).kind === "retard"
      : false;
    await addPunch({
      userId: user.id, userFullName: user.fullName,
      teamId: user.teamId as TeamId,
      kind: adminPunchKind, location: adminPunchLoc,
      at, validated: false, late, justification: null,
    });
    toast.success(`Pointage admin enregistré (${KIND_LABEL[adminPunchKind]})`);
    setAdminPunchOpen(false); await reload();
  };

  /* ─── Add member ─── */
  const [newMember, setNewMember] = useState({ fullName: "", email: "", password: "" });
  const handleAddMember = async () => {
    if (!newMember.fullName || !newMember.email || !newMember.password) { toast.error("Tous les champs requis"); return; }
    if (newMember.password.length < 6) { toast.error("Mot de passe trop court (min. 6 car.)"); return; }
    try {
      await createUser({ ...newMember, teamId: user.teamId as TeamId, role: "member" });
      toast.success(`${newMember.fullName} ajouté(e)`);
      const subj = `[TimeFlow] Bienvenue dans l'équipe ${team.name} !`;
      const body = `Bonjour ${newMember.fullName},\n\nVotre compte TimeFlow a été créé.\n\nEmail : ${newMember.email}\nMot de passe : ${newMember.password}\n\n⚠️ Modifiez votre mot de passe à la première connexion.\n\nCordialement,\n${user.fullName} — ${team.name}`;
      window.location.href = `mailto:${newMember.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
      setAddOpen(false); setNewMember({ fullName: "", email: "", password: "" }); await reload();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Erreur création"); }
  };
  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteUser(confirmDelete.id);
    toast.success(`${confirmDelete.name} retiré(e)`);
    setConfirmDelete(null); await reload();
  };
  const copyCode = (code: string, label: string) => { navigator.clipboard.writeText(code); toast.success(`${label} copié`); };

  /* ─── CSV export (avec commentaires) ─── */
  const exportCsv = () => {
    const hdrs = ["Nom","Email","Equipe","Debut","Fin","Jours","Retards","Ret_just","Trop_tot","Heures","Sur_site","Teletravail","Pointages","Valides"];
    const rows = report.map(r => [r.name,r.email,team.name,reportFrom,reportTo,r.daysPresent,r.lateDays,r.lateJustified,r.earlyDays,r.hours.toFixed(2),r.onsite,r.remote,r.totalPunches,r.validatedCount]);
    const commentRows: unknown[][] = rhComments.length
      ? [[], ["=== COMMENTAIRES RH ==="], ["Date","Responsable","Periode","Commentaire"],
         ...rhComments.map(c => [new Date(c.createdAt).toLocaleDateString("fr-FR"), c.adminName, `${c.periodFrom}->${c.periodTo}`, c.comment])]
      : [];
    const all = [[...hdrs], ...rows, ...commentRows];
    const csv = all.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bilan_${team.name}_${reportFrom}_${reportTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé ✓");
  };

  /* ─── Excel export (3 onglets) ─── */
  const exportExcel = async () => {
    try {
      const XLSX = await loadXLSX();
      /* Onglet 1 – Bilan */
      const bilanRows = [
        ["Nom","Email","Equipe","Début","Fin","Jours","Retards","Ret. justifiés","Trop tôt","Heures","Sur site","Télétravail","Pointages","Validés"],
        ...report.map(r => [r.name,r.email,team.name,reportFrom,reportTo,r.daysPresent,r.lateDays,r.lateJustified,r.earlyDays,+r.hours.toFixed(2),r.onsite,r.remote,r.totalPunches,r.validatedCount]),
        [],
        ["TOTAUX","","","","",reportTotals.days,reportTotals.late,"",reportTotals.early,+reportTotals.hours.toFixed(2),reportTotals.onsite,reportTotals.remote,"",""],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(bilanRows);

      /* Onglet 2 – Commentaires */
      const commRows = [
        ["Date","Responsable","Période","Commentaire"],
        ...rhComments.map(c => [new Date(c.createdAt).toLocaleDateString("fr-FR"), c.adminName, `${c.periodFrom} → ${c.periodTo}`, c.comment]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(commRows.length > 1 ? commRows : [commRows[0], ["Aucun commentaire","","",""]]);

      /* Onglet 3 – Anomalies détaillées */
      const anomRows = [
        ["Employé","Date","Heure","Type","Lieu","Anomalie","Δ min","Justification","Validé"],
        ...reportPunches.filter(p => p.kind === "in").map(p => {
          const a = getAnomaly(p);
          return [p.userFullName, p.at.slice(0,10), formatHM(p.at),
            KIND_LABEL[p.kind], p.location === "onsite" ? "Sur site" : "Télétravail",
            a.kind === "trop_tot" ? "Trop tôt" : a.kind === "retard" ? "Retard" : "OK",
            a.diffMin, p.justification || "—", p.validated ? "Oui" : "Non"];
        }),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(anomRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Bilan RH");
      XLSX.utils.book_append_sheet(wb, ws2, "Commentaires");
      XLSX.utils.book_append_sheet(wb, ws3, "Anomalies");
      XLSX.writeFile(wb, `bilan_${team.name}_${reportFrom}_${reportTo}.xlsx`);
      toast.success("Export Excel téléchargé (3 onglets) ✓");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur export Excel"); }
  };

  /* ─── Schedule helpers ─── */
  const openSchedule = () => {
    const defaults: DaySchedule[] = [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" }));
    setEditSchedule(defaults.map(def => schedule.find(s => s.dayOfWeek === def.dayOfWeek) ?? def));
    setScheduleOpen(true);
  };
  const saveScheduleHandler = async () => {
    await saveSchedule(user.teamId as TeamId, user.id, editSchedule);
    toast.success("Planning mis à jour"); setScheduleOpen(false); await reload();
  };
  const updateDay = (dow: number, field: keyof DaySchedule, val: string | number) =>
    setEditSchedule(prev => prev.map(d => d.dayOfWeek === dow ? { ...d, [field]: val } : d));

  /* ─── Parse imported schedule file (CSV / Excel / JSON — pas PDF) ─── */
  const parseScheduleFile = async (
    file: File,
    setErr: (e: string) => void,
    onOk: (days: DaySchedule[]) => void
  ) => {
    setErr("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") { setErr("Import PDF non supporté pour le planning. Utilisez CSV, Excel ou JSON."); return; }

    const parseLine = (cols: string[], i: number): DaySchedule => {
      const dow = parseInt(cols[0]);
      if (isNaN(dow) || dow < 1 || dow > 7) throw new Error(`Jour invalide ligne ${i+1}: "${cols[0]}"`);
      return { dayOfWeek: dow, startTime: cols[1]||"09:00", endTime: cols[2]||"17:00",
               breakStart: cols[3]||undefined, breakEnd: cols[4]||undefined,
               toleranceMinutes: cols[5] ? parseInt(cols[5]) : 5 };
    };

    if (ext === "xlsx" || ext === "xls") {
      try {
        const XLSX = await loadXLSX();
        const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        const data  = (rows as string[][]).filter(r => /^\d$/.test(String(r[0]).trim()));
        onOk(data.map((r, i) => parseLine(r.map(String), i)));
        toast.success(`Planning importé depuis ${file.name}`);
      } catch (e) { setErr(e instanceof Error ? e.message : "Fichier Excel invalide"); }
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) ?? "";
      try {
        let parsed: DaySchedule[] = [];
        if (ext === "json") {
          parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error("JSON doit être un tableau");
        } else {
          const lines = text.split(/\r?\n/).filter(l => l.trim() && !/^jour/i.test(l));
          parsed = lines.map((l, i) => parseLine(l.split(";").map(c => c.trim()), i));
        }
        onOk(parsed); toast.success(`Planning importé depuis ${file.name}`);
      } catch (e) { setErr(e instanceof Error ? e.message : "Fichier invalide"); }
    };
    reader.readAsText(file, "UTF-8");
  };

  /* ─── Member schedule ─── */
  const openMemberSchedule = async (member: UserRecord) => {
    setMemberSchedTarget(member); setMemberSchedLoading(true); setMemberSchedOpen(true);
    const base = [1,2,3,4,5].map(dow => {
      const td = schedule.find(s => s.dayOfWeek === dow);
      return { dayOfWeek: dow, startTime: td?.startTime ?? "09:00", endTime: td?.endTime ?? "17:00",
               breakStart: td?.breakStart, breakEnd: td?.breakEnd, toleranceMinutes: td?.toleranceMinutes ?? 5, active: true };
    });
    try {
      const ex = await getMemberSchedule(member.id);
      if (ex.length > 0) {
        setMemberSchedDays([1,2,3,4,5].map(dow => {
          const td = schedule.find(s => s.dayOfWeek === dow);
          const md = ex.find(s => s.dayOfWeek === dow);
          return { dayOfWeek: dow,
            startTime: md?.startTime ?? td?.startTime ?? "09:00", endTime: md?.endTime ?? td?.endTime ?? "17:00",
            breakStart: md?.breakStart ?? td?.breakStart, breakEnd: md?.breakEnd ?? td?.breakEnd,
            toleranceMinutes: md?.toleranceMinutes ?? td?.toleranceMinutes ?? 5, active: !!md };
        }));
      } else setMemberSchedDays(base);
    } catch { setMemberSchedDays(base); }
    finally { setMemberSchedLoading(false); }
  };
  const saveMemberSchedHandler = async () => {
    if (!memberSchedTarget) return;
    const active = memberSchedDays.filter(d => d.active);
    if (!active.length) { await deleteMemberSchedule(memberSchedTarget.id); toast.success("Planning individuel supprimé → suit le planning équipe"); }
    else { await saveMemberSchedule(memberSchedTarget.id, active); toast.success(`Planning individuel sauvegardé pour ${memberSchedTarget.fullName}`); }
    setMemberSchedOpen(false);
  };
  const updateMemberDay = (dow: number, field: keyof DaySchedule | "active", val: string | number | boolean) =>
    setMemberSchedDays(prev => prev.map(d => d.dayOfWeek === dow ? { ...d, [field]: val } : d));

  /* ─── RH comment ─── */
  const submitRhComment = async () => {
    if (!rhComment.trim()) { toast.error("Commentaire vide"); return; }
    await createRhComment({ adminId: user.id, teamId: user.teamId as TeamId, periodFrom: reportFrom, periodTo: reportTo, comment: rhComment.trim() });
    toast.success("Commentaire enregistré"); setRhComment(""); await reload();
  };

  /* ─── Today schedule ─── */
  const todaySched = (() => { const dow = today.getDay() || 7; return schedule.find(s => s.dayOfWeek === dow) ?? null; })();

  const toggleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(f); setSortDir("desc"); } };

  /* ─── Reset filters ─── */
  const hasFilters = filterLieu !== "all" || filterJustif !== "all" || filterStatut !== "all" || search || date;
  const resetFilters = () => { setFilterLieu("all"); setFilterJustif("all"); setFilterStatut("all"); setSearch(""); setDate(""); };

  if (loading) return <div className="min-h-screen bg-gradient-subtle flex items-center justify-center"><p className="text-muted-foreground animate-pulse">Chargement…</p></div>;

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8 max-w-7xl animate-fade-in space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Administration — <span className={team.color}>{team.name}</span></h1>
            <p className="text-sm text-muted-foreground mt-0.5">{team.label}</p>
            {todaySched && (
              <button type="button" onClick={openSchedule}
                className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-1 hover:text-primary transition-colors cursor-pointer">
                📅 Aujourd'hui :
                <span className="font-semibold text-foreground group-hover:text-primary">{todaySched.startTime} → {todaySched.endTime}</span>
                {todaySched.breakStart && todaySched.breakEnd && <span className="ml-1 text-amber-600 dark:text-amber-400">☕ {todaySched.breakStart}–{todaySched.breakEnd}</span>}
                <span className="opacity-0 group-hover:opacity-60 text-[10px]">✏️</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openAdminPunch}><Clock className="h-4 w-4 mr-1.5"/>Mon pointage</Button>
            <Button variant="outline" size="sm" onClick={openSchedule}><CalendarClock className="h-4 w-4 mr-1.5"/>Planning</Button>
            <Button variant="outline" size="sm" onClick={() => setShowCodes(true)}><KeyRound className="h-4 w-4 mr-1.5"/>Codes</Button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={<Users className="h-5 w-5"/>} label="Présence aujourd'hui" value={`${presentIds.size}/${members.length}`} sub={`${presence}% de l'équipe`} tone="primary"/>
          <Stat icon={<AlertTriangle className="h-5 w-5"/>} label="Retards aujourd'hui" value={String(lateCount)} sub="Arrivées en retard" tone="warning"/>
          <Stat icon={<ShieldAlert className="h-5 w-5"/>} label={`Anomalies (>${earlyThresh} min tôt)`} value={String(earlyToday)} sub="Avant l'heure prévue" tone="info"/>
          <Stat icon={<BadgeCheck className="h-5 w-5"/>} label="Validés (total)" value={String(validated)} sub="Pointages validés" tone="ok"/>
        </div>

        {/* ── Config anomalies ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-elegant p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-4 w-4 text-primary"/>
            <h2 className="font-semibold">Seuils de détection des anomalies</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">🔵 Trop tôt — anomalie si &gt; X min avant planning</Label>
              <p className="text-xs text-muted-foreground">Ex. avec {earlyThresh} min : un pointage à {
                (() => { const s = todaySched?.startTime ?? "09:00"; const [h,m] = s.split(":").map(Number); const d = new Date(); d.setHours(h,m-earlyThresh,0,0); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })()
              } sera une anomalie.</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={120} value={earlyThresh} onChange={e => setEarlyThresh(Math.max(0,Math.min(120,+e.target.value)))} className="w-20 tabular-nums"/>
                <span className="text-sm text-muted-foreground">minutes</span>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-950 px-2 py-0.5 rounded-full">−{earlyThresh} min</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">🟡 Retard — tolérance du planning + X min</Label>
              <p className="text-xs text-muted-foreground">Avec +{lateThresh} min supplémentaires au-delà de la tolérance, le statut passe à « retard ».</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={120} value={lateThresh} onChange={e => setLateThresh(Math.max(0,Math.min(120,+e.target.value)))} className="w-20 tabular-nums"/>
                <span className="text-sm text-muted-foreground">minutes</span>
                <span className="text-[11px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">+{lateThresh} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bilan RH ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-elegant overflow-hidden">
          <div className="p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2"><FileSpreadsheet className="h-4 w-4"/>Bilan RH</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-36 text-xs"/>
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={reportTo}   onChange={e => setReportTo(e.target.value)}   className="w-36 text-xs"/>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5"/>CSV</Button>
              <Button size="sm" variant="outline" onClick={exportExcel}
                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950">
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5"/>Excel
              </Button>
              <RhMailButton team={team} report={report} reportFrom={reportFrom} reportTo={reportTo}
                rhComment={rhComment} rhComments={rhComments} schedule={schedule} onMailReady={setMailDialog}/>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{["Employé","Email","Jours","Retards","Ret. just.","Trop tôt","Heures","Sur site","Télétravail","Validés"]
                  .map(h => <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {report.length === 0
                  ? <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">Aucun pointage sur cette période</td></tr>
                  : report.map(r => (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30 transition-smooth">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.email}</td>
                    <td className="px-4 py-3 tabular-nums">{r.daysPresent}</td>
                    <td className="px-4 py-3 tabular-nums">{r.lateDays > 0 ? <span className="text-warning font-bold">{r.lateDays}</span> : "0"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.lateJustified}</td>
                    <td className="px-4 py-3 tabular-nums">{r.earlyDays > 0 ? <span className="font-bold text-blue-600 dark:text-blue-400">{r.earlyDays}</span> : "0"}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{fmtDuration(r.hours)}</td>
                    <td className="px-4 py-3 tabular-nums">{r.onsite}</td>
                    <td className="px-4 py-3 tabular-nums">{r.remote}</td>
                    <td className="px-4 py-3 tabular-nums">{r.validatedCount}/{r.totalPunches}</td>
                  </tr>
                ))}
              </tbody>
              {report.length > 0 && (
                <tfoot className="bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                  <tr className="border-t-2 border-border/60">
                    <td className="px-4 py-3" colSpan={2}>Totaux</td>
                    <td className="px-4 py-3 tabular-nums">{reportTotals.days}</td>
                    <td className="px-4 py-3 tabular-nums text-warning">{reportTotals.late}</td>
                    <td className="px-4 py-3"/>
                    <td className="px-4 py-3 tabular-nums text-blue-600 dark:text-blue-400">{reportTotals.early}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDuration(reportTotals.hours)}</td>
                    <td className="px-4 py-3 tabular-nums">{reportTotals.onsite}</td>
                    <td className="px-4 py-3 tabular-nums">{reportTotals.remote}</td>
                    <td className="px-4 py-3"/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Commentaire RH — inclus dans CSV + Excel + mail */}
          <div className="p-5 border-t border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground"/>
              <h3 className="text-sm font-semibold">Commentaire RH</h3>
              <span className="text-xs text-muted-foreground italic">(inclus automatiquement dans CSV, Excel et mail)</span>
            </div>
            <Textarea placeholder={`Observations ${reportFrom} → ${reportTo}…`} value={rhComment}
              onChange={e => setRhComment(e.target.value)} rows={3} className="w-full mb-3"/>
            <Button onClick={submitRhComment} className="bg-gradient-primary" disabled={!rhComment.trim()}>
              <Save className="h-4 w-4 mr-1.5"/>Enregistrer
            </Button>
            {rhComments.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Commentaires enregistrés</p>
                {rhComments.map(c => (
                  <div key={c.id} className="bg-muted/40 rounded-xl p-4 text-sm flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">{c.adminName} · {c.periodFrom} → {c.periodTo} · <span className="text-[10px]">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</span></p>
                      <p className="whitespace-pre-wrap">{c.comment}</p>
                    </div>
                    <button onClick={() => { deleteRhComment(c.id).then(reload); toast.success("Commentaire supprimé"); }} className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"><Trash className="h-4 w-4"/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Membres ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-elegant overflow-hidden">
          <div className="p-5 border-b border-border/60 flex items-center justify-between">
            <div><h2 className="font-semibold">Membres de l'équipe</h2><p className="text-xs text-muted-foreground mt-0.5">{members.length} membre(s)</p></div>
            <Button onClick={() => setAddOpen(true)} className="bg-gradient-primary"><UserPlus className="h-4 w-4 mr-1.5"/>Ajouter</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{["Nom","Email","Inscrit le","Planning perso","Actions"].map((h,i) =>
                  <th key={h} className={`font-semibold px-5 py-3 ${i===4?"text-right":"text-left"}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {members.length === 0
                  ? <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun membre</td></tr>
                  : members.map(m => (
                  <tr key={m.id} className="border-t border-border/40 hover:bg-muted/30 transition-smooth">
                    <td className="px-5 py-3 font-medium">{m.fullName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{formatShort(m.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm" onClick={() => openMemberSchedule(m)} className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10">
                        <Calendar className="h-3.5 w-3.5 mr-1"/>Planning perso
                      </Button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({id:m.id,name:m.fullName})} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 mr-1"/>Retirer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Registre pointages ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-elegant overflow-hidden">
          <div className="p-5 border-b border-border/60 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-semibold">Registre des pointages</h2>
                {selectedPunches.size > 0 && (
                  <Button size="sm" onClick={validateSelected} className="h-8 text-xs bg-success text-success-foreground hover:bg-success/90 gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5"/>Valider sélection ({selectedPunches.size})
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9 sm:w-52"/>
                </div>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="sm:w-40"/>
              </div>
            </div>

            {/* ── Filtres & tri ── */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0"/>

              {/* Lieu */}
              <Select value={filterLieu} onValueChange={v => setFilterLieu(v as FilterLieu)}>
                <SelectTrigger className="h-8 w-auto px-2.5 gap-1.5 text-xs border-dashed">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground"/><SelectValue placeholder="Lieu"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les lieux</SelectItem>
                  <SelectItem value="onsite">🏢 Sur site</SelectItem>
                  <SelectItem value="remote">🏠 Télétravail</SelectItem>
                </SelectContent>
              </Select>

              {/* Justification */}
              <Select value={filterJustif} onValueChange={v => setFilterJustif(v as FilterJustif)}>
                <SelectTrigger className="h-8 w-auto px-2.5 gap-1.5 text-xs border-dashed">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground"/><SelectValue placeholder="Justification"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes justifications</SelectItem>
                  <SelectItem value="justified">✅ Justifié</SelectItem>
                  <SelectItem value="not_justified">❌ Non justifié</SelectItem>
                </SelectContent>
              </Select>

              {/* Statut */}
              <Select value={filterStatut} onValueChange={v => setFilterStatut(v as FilterStatut)}>
                <SelectTrigger className="h-8 w-auto px-2.5 gap-1.5 text-xs border-dashed">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground"/><SelectValue placeholder="Statut"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="present">🟢 Présent (à l'heure)</SelectItem>
                  <SelectItem value="retard">🟡 En retard</SelectItem>
                  <SelectItem value="anomalie_tot">🔵 Anomalie trop tôt (−{earlyThresh} min)</SelectItem>
                  <SelectItem value="valide">✅ Validé</SelectItem>
                </SelectContent>
              </Select>

              {/* Tri */}
              <span className="text-xs text-muted-foreground font-semibold ml-1 hidden sm:inline">Tri :</span>
              {(["date","name","lieu","statut"] as SortField[]).map(f => (
                <button key={f} onClick={() => toggleSort(f)}
                  className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors ${
                    sortField === f ? "bg-primary/10 border-primary/40 text-primary" : "border-dashed border-border/60 text-muted-foreground hover:text-foreground"}`}>
                  {sortField === f && sortDir === "desc" ? <SortDesc className="h-3.5 w-3.5"/> : <SortAsc className="h-3.5 w-3.5"/>}
                  {f === "date" ? "Date" : f === "name" ? "Nom" : f === "lieu" ? "Lieu" : "Statut"}
                </button>
              ))}

              {hasFilters && (
                <button onClick={resetFilters} className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive border border-dashed border-border/60 hover:border-destructive/40 rounded-md transition-colors">
                  ✕ Réinitialiser
                </button>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{filtered.length} résultat(s)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="w-4 h-4 rounded accent-primary cursor-pointer"
                      checked={filtered.filter(p=>!p.validated).length>0 && filtered.filter(p=>!p.validated).every(p=>selectedPunches.has(p.id))}
                      onChange={e => {
                        const nv = filtered.filter(p=>!p.validated);
                        setSelectedPunches(e.target.checked ? new Set(nv.map(p=>p.id)) : new Set());
                      }}/>
                  </th>
                  {["Employé","Date","Heure","Type","Lieu","Justification","Statut","Anomalie","Actions"].map((h,i) =>
                    <th key={h} className={`font-semibold px-4 py-3 ${i===8?"text-right":"text-left"}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Aucun pointage trouvé</td></tr>
                  : filtered.map(p => {
                  const an = getAnomaly(p);
                  const rowCls = selectedPunches.has(p.id) ? "bg-success/5" : an.kind === "trop_tot" ? "bg-blue-50/40 dark:bg-blue-950/20" : "";
                  return (
                    <tr key={p.id} className={`border-t border-border/40 hover:bg-muted/30 transition-smooth ${rowCls}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-4 h-4 rounded accent-primary cursor-pointer disabled:opacity-30"
                          checked={selectedPunches.has(p.id)} disabled={p.validated}
                          onChange={e => setSelectedPunches(prev => { const n=new Set(prev); e.target.checked?n.add(p.id):n.delete(p.id); return n; })}/>
                      </td>
                      <td className="px-4 py-3 font-medium">{p.userFullName}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatShort(p.at)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{formatHM(p.at)}</td>
                      <td className="px-4 py-3">{KIND_LABEL[p.kind]}</td>
                      <td className="px-4 py-3 text-xs">{p.location==="onsite"?"🏢 Sur site":"🏠 Télétravail"}</td>
                      <td className="px-4 py-3 max-w-[150px]">
                        {p.justification
                          ? <span className="text-xs text-muted-foreground truncate block" title={p.justification}>📝 {p.justification}</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.validated
                          ? <Badge color="success"><Check className="h-3 w-3"/>Validé</Badge>
                          : p.late
                          ? <Badge color="warning"><AlertTriangle className="h-3 w-3"/>Retard</Badge>
                          : <Badge color="muted">En attente</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {p.kind === "in" ? (
                          an.kind === "trop_tot"
                            ? <AnomalyBadge color="blue" label={`−${Math.abs(an.diffMin)} min`} title="Trop tôt"/>
                            : an.kind === "retard"
                            ? <AnomalyBadge color="orange" label={`+${an.diffMin} min`} title="Retard"/>
                            : <AnomalyBadge color="green" label="OK" title="À l'heure"/>
                        ) : <span className="text-xs text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-7 text-xs"><Pencil className="h-3 w-3 mr-1"/>Modifier</Button>
                          <Button variant="ghost" size="sm" onClick={() => validate(p)} disabled={p.validated} className="h-7 text-xs text-success hover:text-success hover:bg-success/10">
                            <Check className="h-3 w-3 mr-1"/>Valider
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ════ DIALOGS ════ */}

      {/* Modifier heure */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le pointage</DialogTitle></DialogHeader>
          {editing && <div className="space-y-4 py-2">
            <div className="text-sm"><p className="text-muted-foreground">Employé</p><p className="font-semibold">{editing.userFullName}</p></div>
            <div className="text-sm"><p className="text-muted-foreground">Type</p><p className="font-semibold">{KIND_LABEL[editing.kind]} · {formatShort(editing.at)}</p></div>
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-2 block">Nouvelle heure</Label>
              <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}/></div>
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin self-punch */}
      <Dialog open={adminPunchOpen} onOpenChange={setAdminPunchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary"/>Mon pointage (Admin)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-3 border border-primary/20">
              En tant qu'admin, vous pouvez pointer manuellement votre présence. Le planning sera analysé pour détecter les anomalies.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Date</Label>
                <Input type="date" value={adminPunchDate} onChange={e => setAdminPunchDate(e.target.value)}/></div>
              <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Heure</Label>
                <Input type="time" value={adminPunchTime} onChange={e => setAdminPunchTime(e.target.value)}/></div>
            </div>
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Type</Label>
              <Select value={adminPunchKind} onValueChange={v => setAdminPunchKind(v as PunchRecord["kind"])}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrée</SelectItem>
                  <SelectItem value="break_out">Pause</SelectItem>
                  <SelectItem value="break_in">Reprise</SelectItem>
                  <SelectItem value="out">Sortie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Lieu</Label>
              <Select value={adminPunchLoc} onValueChange={v => setAdminPunchLoc(v as "onsite"|"remote")}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">🏢 Sur site</SelectItem>
                  <SelectItem value="remote">🏠 Télétravail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Prévisualisation anomalie */}
            {adminPunchKind === "in" && adminPunchDate && adminPunchTime && (() => {
              const at = `${adminPunchDate}T${adminPunchTime}:00`;
              const sched = schedForPunch(schedule, at);
              if (!sched) return null;
              const a = computeAnomaly({ at } as PunchRecord, sched, earlyThresh);
              return (
                <div className={`rounded-lg px-3 py-2.5 text-xs font-medium border ${
                  a.kind === "trop_tot" ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                  : a.kind === "retard" ? "bg-warning/10 border-warning/30 text-warning"
                  : "bg-success/10 border-success/30 text-success"}`}>
                  {a.kind === "trop_tot" && `⚡ Anomalie : ${Math.abs(a.diffMin)} min avant l'heure prévue (seuil : ${earlyThresh} min)`}
                  {a.kind === "retard"   && `⏰ Retard détecté : +${a.diffMin} min après l'heure de début`}
                  {a.kind === "ok"       && `✓ Pointage dans les délais (planning : ${sched.startTime})`}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminPunchOpen(false)}>Annuler</Button>
            <Button onClick={saveAdminPunch} className="bg-gradient-primary"><Clock className="h-4 w-4 mr-1.5"/>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajouter membre */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un membre — {team.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Nom complet</Label>
              <Input value={newMember.fullName} placeholder="Jean Dupont" onChange={e => setNewMember({...newMember,fullName:e.target.value})}/></div>
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Email</Label>
              <Input type="email" value={newMember.email} placeholder="jean.dupont@entreprise.fr" onChange={e => setNewMember({...newMember,email:e.target.value})}/></div>
            <div><Label className="text-xs uppercase tracking-wider font-semibold mb-1.5 block">Mot de passe initial</Label>
              <Input type="text" value={newMember.password} placeholder="Min. 6 caractères" onChange={e => setNewMember({...newMember,password:e.target.value})}/>
              <p className="text-xs text-muted-foreground italic mt-1.5">Le membre devra le modifier à la première connexion.</p></div>
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
              <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"/>
              <span className="text-xs text-amber-700 dark:text-amber-400">Après la création, votre messagerie s'ouvrira avec l'e-mail d'invitation pré-rempli.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={handleAddMember} className="bg-gradient-primary"><UserPlus className="h-4 w-4 mr-1.5"/>Créer &amp; Inviter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmer suppression */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retirer ce membre ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2"><span className="font-semibold text-foreground">{confirmDelete?.name}</span> n'aura plus accès. L'historique est conservé.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
            <Button onClick={handleDelete} className="bg-destructive text-destructive-foreground"><Trash2 className="h-4 w-4 mr-1.5"/>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Codes */}
      <Dialog open={showCodes} onOpenChange={setShowCodes}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>Codes d'accès — {team.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <CodeRow label="Code membre" code={team.memberCode} onCopy={copyCode}/>
            <CodeRow label="Code administrateur" code={team.adminCode} onCopy={copyCode} highlight/>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCodes(false)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Planning semaine */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary"/>Planning général — <span className={team.color}>{team.name}</span></DialogTitle>
          </DialogHeader>
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start gap-3">
            <CalendarClock className="h-4 w-4 text-primary mt-0.5 shrink-0"/>
            <div className="flex-1">
              <p className="text-xs font-semibold text-primary mb-0.5">Planning par défaut de l'équipe</p>
              <p className="text-xs text-muted-foreground">S'applique à tous les membres sans planning individuel.</p>
            </div>
            <button type="button" onClick={() => { setImportSchedError(""); setImportSchedOpen(true); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/10 font-medium shrink-0">
              <Upload className="h-3.5 w-3.5"/>Importer
            </button>
          </div>
          {editSchedule.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground">Appliquer les horaires du Lundi à tous :</span>
              <button type="button" onClick={() => {
                const mon = editSchedule.find(d => d.dayOfWeek === 1); if (!mon) return;
                setEditSchedule(prev => prev.map(d => ({...d,startTime:mon.startTime,endTime:mon.endTime,breakStart:mon.breakStart,breakEnd:mon.breakEnd,toleranceMinutes:mon.toleranceMinutes})));
                toast.success("Horaires lundi appliqués à toute la semaine");
              }} className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-semibold">
                <Check className="h-3 w-3 inline mr-1"/>Appliquer à tous
              </button>
            </div>
          )}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {editSchedule.map(d => {
              const isToday = (new Date().getDay()||7) === d.dayOfWeek;
              return (
                <div key={d.dayOfWeek} className={`rounded-xl border px-4 py-3 space-y-2 ${isToday?"border-primary/40 bg-primary/5 shadow-sm":"border-border/60 bg-card"}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 w-24 shrink-0">
                      {isToday && <span className="h-1.5 w-1.5 rounded-full bg-primary"/>}
                      <span className={`text-sm font-bold ${isToday?"text-primary":""}`}>{DAY_NAMES[d.dayOfWeek]}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Début</span>
                      <Input type="time" value={d.startTime} onChange={e => updateDay(d.dayOfWeek,"startTime",e.target.value)} className="w-28 h-9 text-sm font-semibold tabular-nums"/>
                      <ChevronRight className="h-3 w-3 text-muted-foreground"/>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Fin</span>
                      <Input type="time" value={d.endTime} onChange={e => updateDay(d.dayOfWeek,"endTime",e.target.value)} className="w-28 h-9 text-sm font-semibold tabular-nums"/>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[10px] text-muted-foreground font-semibold">Tol.</span>
                      <Input type="number" min={0} max={60} value={d.toleranceMinutes??5} onChange={e => updateDay(d.dayOfWeek,"toleranceMinutes",Math.max(0,Math.min(60,+e.target.value)))} className="w-14 h-9 text-sm tabular-nums px-2"/>
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap border-t border-dashed border-border/40 pt-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">☕ Pause</span>
                    <Input type="time" value={d.breakStart??""} placeholder="--:--" onChange={e => updateDay(d.dayOfWeek,"breakStart",e.target.value)} className="h-8 text-xs w-28 tabular-nums"/>
                    <ChevronRight className="h-3 w-3 text-muted-foreground"/>
                    <Input type="time" value={d.breakEnd??""} placeholder="--:--" onChange={e => updateDay(d.dayOfWeek,"breakEnd",e.target.value)} className="h-8 text-xs w-28 tabular-nums"/>
                    {(d.breakStart||d.breakEnd) && <button onClick={() => { updateDay(d.dayOfWeek,"breakStart",""); updateDay(d.dayOfWeek,"breakEnd",""); }} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded">✕ Supprimer</button>}
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground italic px-1">Tolérance = minutes après l'heure de début avant d'être en retard.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Annuler</Button>
            <Button onClick={saveScheduleHandler} className="bg-gradient-primary"><Save className="h-4 w-4 mr-1.5"/>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import planning équipe — CSV / Excel / JSON */}
      <ImportScheduleDialog
        open={importSchedOpen} onOpenChange={setImportSchedOpen}
        title="Importer un planning équipe"
        error={importSchedError} setError={setImportSchedError}
        onFile={(file) => parseScheduleFile(file, setImportSchedError, (parsed) => {
          setEditSchedule(prev => prev.map(def => { const imp = parsed.find(p => p.dayOfWeek===def.dayOfWeek); return imp ? {...def,...imp} : def; }));
          setImportSchedOpen(false);
        })}
      />

      {/* Planning individuel membre */}
      <Dialog open={memberSchedOpen} onOpenChange={o => !o && setMemberSchedOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5"/>Planning individuel — {memberSchedTarget?.fullName}</DialogTitle>
          </DialogHeader>
          {memberSchedLoading
            ? <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground text-sm"><div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"/>Chargement…</div>
            : <div className="space-y-2 py-2">
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0"/>
                  <div className="flex-1"><p className="text-xs font-semibold text-primary mb-0.5">Planning personnalisé</p>
                    <p className="text-xs text-muted-foreground">Cochez les jours travaillés. Jours non cochés = planning équipe.</p></div>
                  <button type="button" onClick={() => { setImportMemberSchedError(""); setImportMemberSchedOpen(true); }}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/10 font-medium shrink-0">
                    <Upload className="h-3.5 w-3.5"/>Importer
                  </button>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {memberSchedDays.map(d => {
                    const isTodayMember = (new Date().getDay()||7) === d.dayOfWeek;
                    return (
                      <div key={d.dayOfWeek} className={`rounded-xl border px-4 py-3 space-y-2 transition-all ${!d.active?"border-border/30 bg-muted/20 opacity-50":isTodayMember?"border-primary/40 bg-primary/5 shadow-sm":"border-border/60 bg-card"}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                            <input type="checkbox" checked={d.active} onChange={e => updateMemberDay(d.dayOfWeek,"active",e.target.checked)} className="w-4 h-4 rounded accent-primary cursor-pointer"/>
                            {isTodayMember && <span className="h-1.5 w-1.5 rounded-full bg-primary"/>}
                            <span className={`text-sm font-bold ${isTodayMember?"text-primary":""}`}>{DAY_NAMES[d.dayOfWeek]}</span>
                          </label>
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <Input type="time" value={d.startTime} disabled={!d.active} onChange={e => updateMemberDay(d.dayOfWeek,"startTime",e.target.value)} className="w-28 h-9 text-sm font-semibold tabular-nums"/>
                            <ChevronRight className="h-3 w-3 text-muted-foreground"/>
                            <Input type="time" value={d.endTime} disabled={!d.active} onChange={e => updateMemberDay(d.dayOfWeek,"endTime",e.target.value)} className="w-28 h-9 text-sm font-semibold tabular-nums"/>
                          </div>
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-muted-foreground font-semibold">Tol.</span>
                            <Input type="number" min={0} max={60} value={d.toleranceMinutes??5} disabled={!d.active} onChange={e => updateMemberDay(d.dayOfWeek,"toleranceMinutes",Math.max(0,Math.min(60,+e.target.value)))} className="w-14 h-9 text-sm tabular-nums px-2"/>
                            <span className="text-xs text-muted-foreground">min</span>
                          </div>
                        </div>
                        <div className={`flex items-center gap-3 flex-wrap border-t border-dashed border-border/40 pt-2 ${!d.active?"opacity-40 pointer-events-none":""}`}>
                          <span className="text-xs text-muted-foreground w-16">☕ Pause</span>
                          <Input type="time" value={d.breakStart??""} placeholder="--:--" disabled={!d.active} onChange={e => updateMemberDay(d.dayOfWeek,"breakStart",e.target.value)} className="h-8 text-xs w-28 tabular-nums"/>
                          <ChevronRight className="h-3 w-3 text-muted-foreground"/>
                          <Input type="time" value={d.breakEnd??""} placeholder="--:--" disabled={!d.active} onChange={e => updateMemberDay(d.dayOfWeek,"breakEnd",e.target.value)} className="h-8 text-xs w-28 tabular-nums"/>
                          {(d.breakStart||d.breakEnd)&&d.active&&<button onClick={()=>{updateMemberDay(d.dayOfWeek,"breakStart","");updateMemberDay(d.dayOfWeek,"breakEnd","");}} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded">✕</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          }
          <DialogFooter className="flex-wrap gap-2 mt-2">
            <Button variant="outline" onClick={() => setMemberSchedOpen(false)}>Annuler</Button>
            <Button variant="outline" className="text-muted-foreground border-dashed" onClick={async () => {
              if (!memberSchedTarget) return;
              await deleteMemberSchedule(memberSchedTarget.id);
              toast.success(`${memberSchedTarget.fullName} → planning équipe restauré`); setMemberSchedOpen(false);
            }}>↩ Par défaut</Button>
            <Button onClick={saveMemberSchedHandler} className="bg-gradient-primary" disabled={memberSchedLoading}><Save className="h-4 w-4 mr-1.5"/>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import planning individuel */}
      <ImportScheduleDialog
        open={importMemberSchedOpen} onOpenChange={setImportMemberSchedOpen}
        title={`Importer planning — ${memberSchedTarget?.fullName}`}
        error={importMemberSchedError} setError={setImportMemberSchedError}
        onFile={(file) => parseScheduleFile(file, setImportMemberSchedError, (parsed) => {
          setMemberSchedDays(prev => prev.map(def => { const imp = parsed.find(p => p.dayOfWeek===def.dayOfWeek); return imp ? {...def,...imp,active:true} : def; }));
          setImportMemberSchedOpen(false);
        })}
      />

      {/* Mail */}
      <MailDialog mail={mailDialog} onClose={() => setMailDialog(null)}/>
    </div>
  );
}

/* ══════════════ SUB-COMPONENTS ══════════════ */

function Badge({ color, children }: { color: "success"|"warning"|"muted"; children: React.ReactNode }) {
  const cls = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    muted:   "text-muted-foreground bg-muted",
  }[color];
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function AnomalyBadge({ color, label, title }: { color:"blue"|"orange"|"green"; label:string; title:string }) {
  const cls = {
    blue:   "text-blue-700 bg-blue-100 border border-blue-200 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-800",
    orange: "text-orange-700 bg-orange-100 border border-orange-200 dark:text-orange-300 dark:bg-orange-950/50",
    green:  "text-success bg-success/10",
  }[color];
  const icon = color==="blue"?"⚡":color==="orange"?"⏰":"✓";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`} title={title}>
      {icon} {label}
    </span>
  );
}

function CodeRow({ label, code, onCopy, highlight }: { label:string; code:string; onCopy:(c:string,l:string)=>void; highlight?:boolean }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${highlight?"bg-accent-soft border-accent/30":"bg-muted/40 border-border/60"}`}>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
        <p className="font-mono text-sm font-semibold text-foreground truncate">{code}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onCopy(code,label)}><Copy className="h-3.5 w-3.5 mr-1"/>Copier</Button>
    </div>
  );
}

function ImportScheduleDialog({ open, onOpenChange, title, error, setError, onFile }: {
  open: boolean; onOpenChange: (v:boolean)=>void; title: string;
  error: string; setError: (e:string)=>void; onFile: (f:File)=>void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5"/>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">Importez un fichier <strong>CSV</strong>, <strong>Excel (.xlsx/.xls)</strong> ou <strong>JSON</strong>. Le PDF n'est pas supporté pour le planning.</p>
          <div className="bg-muted/40 rounded-xl p-3 text-xs font-mono text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">Format CSV/Excel attendu</p>
            <p>jour;debut;fin;pause_debut;pause_fin;tolerance</p>
            <p>1;08:00;16:00;12:00;13:00;5</p>
            <p>2;08:00;16:00;;;5</p>
            <p className="text-[10px] mt-1 opacity-70">jour: 1=Lun … 5=Ven | pause + tolérance optionnels</p>
          </div>
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <Label className="text-xs uppercase tracking-wider font-semibold mb-2 block">Choisir un fichier</Label>
            <input type="file" accept=".csv,.json,.xlsx,.xls,.pdf"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              onChange={e => { const f=e.target.files?.[0]; if(f){setError("");onFile(f);} }}/>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RhMailButton({ team, report, reportFrom, reportTo, rhComment, rhComments, schedule, onMailReady }: {
  team: { name: string };
  report: { name:string; email?:string; daysPresent:number; lateDays:number; hours:number; lateJustified:number; earlyDays:number; onsite:number; remote:number; totalPunches:number; validatedCount:number }[];
  reportFrom:string; reportTo:string; rhComment:string; rhComments:RhComment[];
  schedule: DaySchedule[]; onMailReady:(m:{to:string;subject:string;body:string})=>void;
}) {
  const DAY = ["","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
  const handle = () => {
    const subject = `[TimeFlow] Bilan RH - ${team.name} - ${reportFrom} au ${reportTo}`;
    const sep = "+----------------------+-------+-------+----------+-------+--------+";
    const hdr = "| Employe              | Jours |Retard | Ret.just | Tot   | Heures |";
    const rows = report.map(r => {
      const n=r.name.substring(0,20).padEnd(20); const j=String(r.daysPresent).padStart(5);
      const l=String(r.lateDays).padStart(5); const lj=String(r.lateJustified).padStart(8);
      const e=String(r.earlyDays).padStart(5); const h=r.hours.toFixed(1).padStart(6);
      return `| ${n} |${j} |${l} |${lj} |${e} |${h} |`;
    });
    const tot = `| ${"TOTAL".padEnd(20)} | ${String(report.reduce((s,r)=>s+r.daysPresent,0)).padStart(4)} | ${String(report.reduce((s,r)=>s+r.lateDays,0)).padStart(5)} | ${String(report.reduce((s,r)=>s+r.lateJustified,0)).padStart(8)} | ${String(report.reduce((s,r)=>s+r.earlyDays,0)).padStart(5)} | ${report.reduce((s,r)=>s+r.hours,0).toFixed(1).padStart(6)} |`;
    const tableau = [sep,hdr,sep,...rows,sep,tot,sep].join("\n");
    const planning = schedule.filter(s=>s.dayOfWeek>=1&&s.dayOfWeek<=5).sort((a,b)=>a.dayOfWeek-b.dayOfWeek)
      .map(s=>`  ${DAY[s.dayOfWeek].padEnd(10)}: ${s.startTime} -> ${s.endTime}${s.breakStart&&s.breakEnd?`  (Pause: ${s.breakStart}-${s.breakEnd})`:""}`)
      .join("\n") || "  (Aucun planning défini)";
    const commentSection = rhComment.trim()
      ? `\n\n================================================\nCOMMENTAIRE DU RESPONSABLE\n================================================\n${rhComment.trim()}` : "";
    const savedComments = rhComments.length
      ? `\n\n================================================\nCOMMENTAIRES ENREGISTRÉS\n================================================\n` +
        rhComments.map(c=>`[${new Date(c.createdAt).toLocaleDateString("fr-FR")}] ${c.adminName} (${c.periodFrom}→${c.periodTo}):\n${c.comment}`).join("\n\n")
      : "";
    const body = `Bonjour,\n\nBilan RH — ${team.name} — ${reportFrom} au ${reportTo}\n\n` +
      `================================================\nRÉSUMÉ\n================================================\n` + tableau +
      `\n\n================================================\nPLANNING\n================================================\n` + planning +
      commentSection + savedComments + `\n\n-- TimeFlow`;

    /* CSV auto-download avec commentaires */
    const hdrs = ["Nom","Email","Equipe","Debut","Fin","Jours","Retards","Ret_just","Trop_tot","Heures","Sur_site","Teletravail","Pointages","Valides"];
    const csvRows = report.map(r=>[r.name,r.email??"",team.name,reportFrom,reportTo,r.daysPresent,r.lateDays,r.lateJustified,r.earlyDays,r.hours.toFixed(2),r.onsite,r.remote,r.totalPunches,r.validatedCount]);
    const commRows: unknown[][] = rhComments.length ? [[], ["=== COMMENTAIRES RH ==="], ["Date","Responsable","Periode","Commentaire"],
      ...rhComments.map(c=>[new Date(c.createdAt).toLocaleDateString("fr-FR"),c.adminName,`${c.periodFrom}->${c.periodTo}`,c.comment])] : [];
    const csv = [[...hdrs],...csvRows,...commRows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`bilan_${team.name}_${reportFrom}_${reportTo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1000);

    onMailReady({ to:"rh@entreprise.fr", subject, body });
  };
  return (
    <button type="button" onClick={handle}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-amber-300 text-amber-700 bg-transparent hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 text-sm font-medium transition-colors">
      <Mail className="h-3.5 w-3.5"/>Envoyer aux RH
    </button>
  );
}

function MailDialog({ mail, onClose }: { mail:{to:string;subject:string;body:string}|null; onClose:()=>void }) {
  if (!mail) return null;
  return (
    <Dialog open={!!mail} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary"/>E-mail à envoyer</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-[56px_1fr] gap-2 text-sm">
            <span className="font-semibold text-muted-foreground pt-1">À :</span>
            <span className="bg-muted/40 rounded-lg px-3 py-1.5 font-mono text-xs">{mail.to}</span>
            <span className="font-semibold text-muted-foreground pt-1">Objet :</span>
            <span className="bg-muted/40 rounded-lg px-3 py-1.5 text-xs">{mail.subject}</span>
          </div>
          <div className="bg-muted/40 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">{mail.body}</div>
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"/>
            <span className="text-xs text-blue-700 dark:text-blue-400">Le fichier <strong>CSV</strong> a été téléchargé automatiquement (avec commentaires). Joignez-le dans Outlook.</span>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`À : ${mail.to}\nObjet : ${mail.subject}\n\n${mail.body}`); toast.success("Mail copié"); }}><Copy className="h-4 w-4 mr-1.5"/>Copier</Button>
          <Button onClick={() => { window.location.href=`mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`; }} className="bg-gradient-primary"><Mail className="h-4 w-4 mr-1.5"/>Ouvrir dans Outlook</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon:React.ReactNode; label:string; value:string; sub:string; tone:"primary"|"ok"|"warning"|"muted"|"info" }) {
  const cls = {
    primary: "text-primary bg-primary/10",
    ok:      "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    muted:   "text-muted-foreground bg-muted",
    info:    "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/50",
  }[tone];
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-elegant p-5 hover:-translate-y-0.5 hover:shadow-floating transition-smooth">
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${cls} mb-3`}>{icon}</div>
      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
